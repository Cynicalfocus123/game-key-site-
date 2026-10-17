"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { lineKey, lineMax, lineUnit, productById } from "@/lib/catalog";
import { problemText, walletState, type PayMethod, type StockProblem } from "@/lib/checkout";
import { api } from "@/lib/client/api";
import type { PaymentsConfig } from "@/lib/client/types";
import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";
import { DemoBanner, Notice } from "../../components/auth-ui";
import { useAuth } from "../../components/auth-provider";
import { useCart } from "../../components/cart-provider";
import { assetPath, CouponLine, CouponNotes, productHref, SoldBy } from "../../components/cart-ui";
import { ChargeNotice, Price } from "../../components/currency-provider";
import { PaymentLogos } from "../../components/payment-logos";
import { FavoriteButton } from "../../components/favorites-provider";
import { BillingAddressForm } from "../../components/billing-address";
import { FeeTaxLines, useCharges } from "../../components/fees";
import { billingShort, type BillingAddress } from "@/lib/address-formats";

// Payment page (Handoff v12 2d; step 5 wireframe approved 2026-10-08: Claude outputs/wireframes/order-pay-wireframe.png).
// Wallet first (user 2026-10-08): pays when the balance (top-ups + gift cards) covers the total; $0 → "No available funds", too low → Top up.
// Sign-in first (option A, user 2026-10-16): guests get the sign-in popup at Checkout, and here at once if they open the page directly.
// If they close it, picking the wallet and pressing Pay opens "Sign in required" (other methods open the usual sign-in gate).
// Card / PayPal / Apple Pay / Google Pay: the provider's hosted page once connected; until then only the dev / demo Simulate flow (processing screen).
// Logos = the existing images in public/images/payments (no wallet image exists yet: CoreCart wordmark + wallet icon).
type Method = { id: PayMethod; name: string; text: string; logo: React.ReactNode };
const img = (id: string, alt: string, w: number, h: number) => <img src={assetPath(`/images/payments/${id}.webp`)} alt={alt} width={w} height={h} />;
const METHODS: Method[] = [
  { id: "wallet", name: "CoreCart wallet", text: "Pay with your CoreCart wallet money", logo: <span className="pm-logo pm-wallet" aria-label="CoreCart wallet"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" strokeWidth="2" d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l13-4v4M16 13h2" /></svg><b>core<span>cart</span></b></span> },
  { id: "paypal", name: "PayPal", text: "Pay with your PayPal account", logo: <span className="pm-logo">{img("paypal", "PayPal", 88, 22)}</span> },
  { id: "card", name: "Credit or debit card", text: "Pay with Visa or Mastercard", logo: <span className="pm-logo pm-two">{img("visa", "Visa", 60, 20)}{img("mastercard", "Mastercard", 40, 24)}</span> },
  { id: "apple_pay", name: "Apple Pay", text: "Pay with Apple Pay", logo: <span className="pm-logo">{img("apple-pay", "Apple Pay", 57, 36)}</span> },
  { id: "google_pay", name: "Google Pay", text: "Pay with Google Pay", logo: <span className="pm-logo">{img("google-pay", "Google Pay", 80, 32)}</span> },
];
const METHOD_KEY = "corecart-pay-method"; // keeps the picked method across sign-in
const readMethod = (): PayMethod | null => { try { const v = sessionStorage.getItem(METHOD_KEY); return METHODS.some((m) => m.id === v) ? (v as PayMethod) : null; } catch { return null; } };
const keepMethod = (v: PayMethod) => { try { sessionStorage.setItem(METHOD_KEY, v); } catch { /* storage blocked */ } };

// "Sign in required" popup (wireframe 1d): centered on every screen size; ✕ / Esc / click outside closes it.
function SignInRequired({ onClose, onPick }: { onClose: () => void; onPick: (v: "signin" | "register") => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLElement>(".btn-primary")?.focus(); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const els = Array.from(box.current?.querySelectorAll<HTMLElement>("button") ?? []); const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return <div className="gate-wrap wl-wrap" role="presentation" onKeyDown={keys}>
    <button type="button" className="gate-bg" aria-label="Close" tabIndex={-1} onClick={onClose} />
    <div className="gate wl-login" role="dialog" aria-modal="true" aria-labelledby="wl-login-h" ref={box}>
      <button type="button" className="gate-x" aria-label="Close" onClick={onClose}>×</button>
      <h2 id="wl-login-h">Sign in required</h2>
      <p>To pay with your CoreCart wallet, you need to be signed in.</p>
      <div className="wl-login-btns"><button type="button" className="btn btn-outline" onClick={() => onPick("register")}>Create account</button><button type="button" className="btn btn-primary" onClick={() => onPick("signin")}>Sign in</button></div>
    </div>
  </div>;
}

export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuth(); const { items, ready, totals, openGate, setQty, remove, clear } = useCart();
  const [method, setMethodState] = useState<PayMethod | null>(null); const [billing, setBilling] = useState<BillingAddress | null>(null); const [billCountry, setBillCountry] = useState("");
  const [balance, setBalance] = useState<number | null>(null); const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [problems, setProblems] = useState<StockProblem[] | null>(null); const [askSignIn, setAskSignIn] = useState(false);
  const setMethod = (v: PayMethod) => { setMethodState(v); keepMethod(v); setError(""); };
  // Task 7: fee + tax from the admin settings. Tax country = the card's billing country (as soon as it is picked), else the account country (no country = "Calculated at payment").
  const { settings: fees, c } = useCharges(totals.total, (method === "card" && billCountry) || user?.country || null);
  useEffect(() => { setMethodState(readMethod()); api.config().then((x) => setPayments(x.payments)).catch(() => setPayments(null)); }, []);
  useEffect(() => { // wallet balance (THB satang: wallet + gift card balance)
    if (!user) { setBalance(null); return; }
    let live = true; api.balance().then((r) => { if (live) setBalance(r.ok ? r.balance.walletMinor + r.balance.giftMinor : 0); }); return () => { live = false; };
  }, [user]);
  // Option A (user 2026-10-16): sign-in is required before paying. Guests normally sign in at Checkout (cart-provider gate); a guest or an
  // unverified account that opens this page directly gets the same sign-in popup at once. Closing it and pressing Pay asks again.
  useEffect(() => { if (user !== undefined && !user?.emailVerified) openGate("choice", "/checkout/payment"); }, [user, openGate]);
  const chosen = METHODS.find((m) => m.id === method);
  const wState = balance === null ? null : walletState(balance, c.total);
  const providerOn = Boolean(payments?.available || payments?.simulate); // card & co: real provider, or the dev / demo Simulate flow
  const testMode = Boolean(payments?.simulate && !payments.available);
  const canPay = Boolean(chosen) && !busy && (method === "wallet" ? !user || wState === "enough" : providerOn);

  const pay = async () => {
    if (!chosen || busy) return;
    if (!user) { if (method === "wallet") setAskSignIn(true); else openGate("choice", "/checkout/payment"); return; }
    if (!user.emailVerified) { openGate("choice", "/checkout/payment"); return; }
    setBusy(true); setError(""); setProblems(null);
    const r = await api.placeOrder({ lines: items.map((e) => ({ productId: e.productId, ...(e.offerId ? { offerId: e.offerId } : {}), qty: e.qty })), method: chosen.id,
      promoCode: totals.coupon?.code ?? null, idempotencyKey: crypto.randomUUID(), billing: method === "card" ? billing : null });
    if (!r.ok) { setBusy(false); if (r.problems?.length) setProblems(r.problems); else setError(r.error); if (method === "wallet") api.balance().then((b) => b.ok && setBalance(b.balance.walletMinor + b.balance.giftMinor)); return; }
    if (!r.paid) { router.push(`/checkout/processing?order=${encodeURIComponent(r.orderId)}`); return; }
    clear(); router.push(`/checkout/processing?order=${encodeURIComponent(r.orderId)}`); // F38: success screen with the cat, then Get your key
  };
  // "Not enough stock": Change to N keeps what is left (0 = remove the line).
  const fixStock = () => { for (const p of problems ?? []) { const k = lineKey({ productId: p.productId, offerId: p.offerId ?? undefined }); if (p.left > 0) setQty(k, p.left); else remove(k); } setProblems(null); };

  const walletBox = method === "wallet" && <div className="wl-box" aria-live="polite">{!user ? null : wState === null ? <p className="muted-note">Loading your balance…</p>
    : wState === "enough" ? <dl className="wl-lines"><div><dt>Order total</dt><dd>− <Price thb={c.total} /></dd></div><div><dt>Balance after paying</dt><dd className="wl-good"><Price thb={(balance ?? 0) - c.total} /></dd></div></dl>
    : <><p className="wl-bad"><span aria-hidden="true">⊘</span> {wState === "empty" ? "No available funds in a wallet" : <>Not enough balance — <Price thb={c.total - (balance ?? 0)} /> short</>}</p>
      <Link className="btn btn-outline wl-top" href="/account/balance/top-up">Top up wallet</Link></>}</div>;

  const summary = <>
    <ul className="pay-items">{items.map((e) => { const p = productById(e.productId)!; const max = lineMax(e); const k = lineKey(e); return <li key={k}>
      <Link href={productHref(p.id)} tabIndex={-1} aria-hidden="true"><img className="cover" src={assetPath(p.image)} alt="" width={56} height={70} /></Link>
      <div className="pay-item-info">
        <Link className="row-title" href={productHref(p.id)}>{p.name}</Link><SoldBy e={e} />
        <span className="pay-item-type">{p.kind === "game_key" ? <>Digital product <span className="tip" tabIndex={0} role="note" aria-label="A key delivered to your Keys library right after payment. Nothing is shipped.">?<span className="tip-box" aria-hidden="true">A key delivered to your Keys library right after payment. Nothing is shipped.</span></span></> : "Hardware · free shipping"}</span>
        <div className="qty qty-sm" role="group" aria-label={`Quantity of ${p.name}`}><button type="button" aria-label={`Decrease quantity of ${p.name}`} disabled={e.qty <= 1} onClick={() => setQty(k, e.qty - 1)}>−</button><output aria-live="polite">{e.qty}</output><button type="button" aria-label={`Increase quantity of ${p.name}`} disabled={e.qty >= max} onClick={() => setQty(k, e.qty + 1)}>+</button></div>
      </div>
      <div className="pay-item-side"><strong><Price thb={lineUnit(e) * e.qty} /></strong><div className="cart-row-actions"><FavoriteButton productId={p.id} name={p.name} /><button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(k)}>×</button></div></div>
    </li>; })}</ul>
    <dl className="pay-lines">
      <div><dt>Sub-total</dt><dd><Price thb={totals.subtotal} /></dd></div>
      <CouponLine />
      <FeeTaxLines settings={fees} c={c} always />
      {method === "card" && billing && <div className="billing-line"><dt>Billing details</dt><dd>{billingShort(billing)}</dd></div>}
      {user && <div className="pay-email"><dt>Email</dt><dd><span>{user.email}</span> <Link className="text-link" href="/account/settings#email">Edit</Link></dd></div>}
    </dl>
    <CouponNotes />
    <div className="pay-total"><span>Total</span><strong><Price thb={c.total} /></strong></div>
    <ChargeNotice thb={c.total} />
    <p className="pay-fraud"><span aria-hidden="true">⚠</span> Know more about online gift card fraud <Link className="text-link" href="/help/gift-card-fraud">here</Link></p>
  </>;
  const payLabel = busy ? "Paying…" : chosen ? (chosen.id === "wallet" ? "Pay with wallet" : `Pay with ${chosen.name}`) : "Pay";
  const payButton = () => <button type="button" className="btn btn-primary pay-btn" disabled={!canPay} onClick={pay}>{payLabel}</button>;
  const hint = !chosen ? "Choose a payment method to continue." : method === "wallet" ? (user && wState && wState !== "enough" ? "Top up your wallet or choose another payment method." : "")
    : !providerOn ? "This payment method is coming soon. Choose CoreCart wallet to pay now." : testMode ? "Test mode: the next screen simulates the payment. No money is taken." : "";

  return <><SiteHeader /><main className="cart-main pay-main"><DemoBanner />
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/cart">Cart</Link> <span aria-hidden="true">›</span> <Link href="/checkout">Checkout</Link> <span aria-hidden="true">›</span> <span aria-current="page">Payment</span></nav>
    <h1 className="cart-title">Payment</h1>
    {user === undefined || !ready ? <p className="muted-note">Loading…</p> : !items.length ? <section className="cart-empty"><h2>Your cart is empty</h2><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link></section> : <div className="pay-layout">
      <details className="pay-summary-mobile"><summary><span>Order summary ({totals.count})</span><strong><Price thb={c.total} /></strong></summary><div className="pay-summary-body">{summary}</div></details>
      <section className="pay-methods" aria-labelledby="pm-h">
        <h2 id="pm-h" className="checkout-h">Choose how to pay</h2>
        {problems && <div className="stock-alert" role="alert"><h3><span aria-hidden="true">⚠</span> Not enough stock</h3>
          <p>Someone just bought these keys:</p><ul>{problems.map((p) => <li key={`${p.productId}@${p.offerId ?? ""}`}>{problemText(p)}</li>)}</ul>
          <p><b>You were not charged.</b> Nothing was taken from your wallet.</p>
          <div className="stock-btns"><button type="button" className="btn btn-primary" onClick={fixStock}>{problems.length === 1 && problems[0].left > 0 ? `Change to ${problems[0].left}` : "Update my cart"}</button><Link className="btn btn-outline" href="/cart">Back to cart</Link></div>
        </div>}
        {error && <Notice tone="error">{error}</Notice>}
        <div role="radiogroup" aria-labelledby="pm-h" className="pm-list">{METHODS.map((m) => <div key={m.id} className={`pm-row${method === m.id ? " is-on" : ""}`}>
          <label className="pm-head">{m.logo}<span className="pm-text"><strong>{m.name}</strong><small>{m.id === "wallet" && user && balance !== null ? <>Total available balance: <b><Price thb={balance} /></b></> : m.text}</small></span><input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} /></label>
          {m.id === "wallet" && walletBox}
          {m.id === "card" && method === "card" && <div className="pm-card">
            <p className="pm-hosted">These fields will be the payment provider&apos;s secure form. CoreCart never sees or stores your card number.</p>
            <div className="pm-fields" aria-label="Card details (preview, disabled)">
              <label className="field pm-wide"><span>Card number</span><input disabled placeholder="•••• •••• •••• ••••" autoComplete="off" /></label>
              <label className="field pm-wide"><span>Cardholder&apos;s name</span><input disabled autoComplete="off" /></label>
              <label className="field"><span>Exp. date</span><input disabled placeholder="MM / YY" autoComplete="off" /></label>
              <label className="field"><span>CVC</span><input disabled placeholder="•••" autoComplete="off" /></label>
            </div>
            <p className="pm-secure"><span aria-hidden="true">🔒</span> Your payment is secure</p>
            {/* Task 5: shown with the card form. With the provider's hosted fields it will wait for their "card number not empty" event (the number never reaches CoreCart). */}
            <BillingAddressForm onChange={setBilling} onCountry={setBillCountry} idPrefix="pay-ba" />
          </div>}
          {m.id !== "card" && m.id !== "wallet" && method === m.id && <p className="pm-next">You will continue to {m.name} to confirm the payment.</p>}
        </div>)}</div>
        <div className="cart-under"><Link className="text-link" href="/checkout">‹ Back to review</Link></div>
      </section>
      <aside className="cart-summary pay-summary" aria-label="Order summary"><h2>Order summary</h2><div className="pay-summary-inner">{summary}</div>
        <div className="pay-aside-btn">{payButton()}</div>
        {hint && <p className="pay-hint">{hint}</p>}
        <p className="gate-legal">By clicking Pay you accept the <Link className="text-link" href="/terms">Terms</Link> and <Link className="text-link" href="/privacy">Privacy policy</Link>.</p>
        <p className="pay-trust"><span aria-hidden="true">🔒</span> Secure checkout{items.some((e) => productById(e.productId)?.kind === "game_key") && " · Instant key delivery"}{items.some((e) => productById(e.productId)?.kind === "hardware") && " · Free shipping in Thailand"} · Support tickets 24/7</p>
        <PaymentLogos />
      </aside>
      <div className="cart-sticky pay-sticky"><div><span>Total</span><strong><Price thb={c.total} /></strong></div>{payButton()}</div>
    </div>}
    {askSignIn && <SignInRequired onClose={() => setAskSignIn(false)} onPick={(v) => { setAskSignIn(false); openGate(v, "/checkout/payment"); }} />}
  </main><SiteFooter /></>;
}
