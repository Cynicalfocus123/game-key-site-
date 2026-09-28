"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { maxQty, productById } from "@/lib/catalog";
import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";
import { DemoBanner, Notice } from "../../components/auth-ui";
import { useAuth } from "../../components/auth-provider";
import { useCart } from "../../components/cart-provider";
import { assetPath, CouponLine, CouponNotes, productHref } from "../../components/cart-ui";
import { ChargeNotice, Price } from "../../components/currency-provider";
import { PaymentLogos } from "../../components/payment-logos";
import { FavoriteButton } from "../../components/favorites-provider";

// Payment page UI (Handoff v12 2d). Provider (Stripe / Omise / 2C2P) not chosen yet: no payment is taken.
// Card fields here are placeholders only; the real ones will be the provider's hosted fields. CoreCart never takes card numbers.
type Method = { id: string; name: string; text: string; logo: React.ReactNode };
const METHODS: Method[] = [
  { id: "paypal", name: "PayPal", text: "Pay with your PayPal account", logo: <span className="pm-logo pm-paypal">PayPal</span> },
  { id: "card", name: "Credit or debit card", text: "Pay with Visa or Mastercard", logo: <span className="pm-logo pm-cards"><b className="pm-visa">VISA</b><b className="pm-mc">Mastercard</b></span> },
  { id: "apple", name: "Apple Pay", text: "Pay with Apple Pay", logo: <span className="pm-logo pm-dark">Apple Pay</span> },
  { id: "google", name: "Google Pay", text: "Pay with Google Pay", logo: <span className="pm-logo">G Pay</span> },
];

export default function PaymentPage() {
  const { user } = useAuth(); const { items, ready, totals, openGate, setQty, remove } = useCart();
  const [method, setMethod] = useState<string | null>(null);
  useEffect(() => { if (user !== undefined && !user?.emailVerified) openGate("choice", "/checkout/payment"); }, [user, openGate]);
  const allowed = Boolean(user?.emailVerified);
  const chosen = METHODS.find((m) => m.id === method);

  const summary = <>
    <ul className="pay-items">{items.map((e) => { const p = productById(e.productId)!; const max = maxQty(p); return <li key={p.id}>
      <Link href={productHref(p.id)} tabIndex={-1} aria-hidden="true"><img className="cover" src={assetPath(p.image)} alt="" width={56} height={56} /></Link>
      <div className="pay-item-info">
        <Link className="row-title" href={productHref(p.id)}>{p.name}</Link>
        <span className="pay-item-type">{p.kind === "game_key" ? <>Digital product <span className="tip" tabIndex={0} role="note" aria-label="A key delivered to your Keys library right after payment. Nothing is shipped.">?<span className="tip-box" aria-hidden="true">A key delivered to your Keys library right after payment. Nothing is shipped.</span></span></> : "Hardware · free shipping"}</span>
        <div className="qty qty-sm" role="group" aria-label={`Quantity of ${p.name}`}><button type="button" aria-label={`Decrease quantity of ${p.name}`} disabled={e.qty <= 1} onClick={() => setQty(p.id, e.qty - 1)}>−</button><output aria-live="polite">{e.qty}</output><button type="button" aria-label={`Increase quantity of ${p.name}`} disabled={e.qty >= max} onClick={() => setQty(p.id, e.qty + 1)}>+</button></div>
      </div>
      <div className="pay-item-side"><strong><Price thb={p.price * e.qty} /></strong><div className="cart-row-actions"><FavoriteButton productId={p.id} name={p.name} /><button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>×</button></div></div>
    </li>; })}</ul>
    <dl className="pay-lines">
      <div><dt>Sub-total</dt><dd><Price thb={totals.subtotal} /></dd></div>
      <CouponLine />
      <div><dt>Service fee <span className="tip" tabIndex={0} role="note" aria-label="CoreCart charges no service fee right now.">?<span className="tip-box" aria-hidden="true">CoreCart charges no service fee right now.</span></span></dt><dd><Price thb={0} /></dd></div>
      <div className="pay-email"><dt>Email</dt><dd><span>{user?.email}</span> <Link className="text-link" href="/account/settings#email">Edit</Link></dd></div>
    </dl>
    <CouponNotes />
    <div className="pay-total"><span>Total</span><strong><Price thb={totals.total} /></strong></div>
    <ChargeNotice thb={totals.total} />
    <p className="pay-fraud"><span aria-hidden="true">⚠</span> Know more about online gift card fraud <Link className="text-link" href="/help/gift-card-fraud">here</Link></p>
  </>;
  const payButton = (cls = "") => <button type="button" className={`btn btn-primary pay-btn ${cls}`} disabled>{chosen ? `Pay with ${chosen.name}` : "Pay"}</button>;

  return <><SiteHeader /><main className="cart-main pay-main"><DemoBanner />
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/cart">Cart</Link> <span aria-hidden="true">›</span> <Link href="/checkout">Checkout</Link> <span aria-hidden="true">›</span> <span aria-current="page">Payment</span></nav>
    <h1 className="cart-title">Payment</h1>
    {user === undefined || !ready ? <p className="muted-note">Loading…</p> : !allowed ? <section className="cart-empty">
      <h2>Sign in to pay</h2><p>Your cart is saved. Create an account or sign in to continue.</p>
      <button type="button" className="btn btn-primary" onClick={() => openGate("choice", "/checkout/payment")}>Continue</button><Link className="text-link" href="/cart">Back to cart</Link>
    </section> : !items.length ? <section className="cart-empty"><h2>Your cart is empty</h2><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link></section> : <div className="pay-layout">
      <details className="pay-summary-mobile"><summary><span>Order summary ({totals.count})</span><strong><Price thb={totals.total} /></strong></summary><div className="pay-summary-body">{summary}</div></details>
      <section className="pay-methods" aria-labelledby="pm-h">
        <h2 id="pm-h" className="checkout-h">Choose how to pay</h2>
        <Notice>Payment is coming next. Choose a method to preview it; no money is taken and no card details are sent.</Notice>
        <div role="radiogroup" aria-labelledby="pm-h" className="pm-list">{METHODS.map((m) => <div key={m.id} className={`pm-row${method === m.id ? " is-on" : ""}`}>
          <label className="pm-head">{m.logo}<span className="pm-text"><strong>{m.name}</strong><small>{m.text}</small></span><input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} /></label>
          {m.id === "card" && method === "card" && <div className="pm-card">
            <p className="pm-hosted">These fields will be the payment provider&apos;s secure form. CoreCart never sees or stores your card number.</p>
            <div className="pm-fields" aria-label="Card details (preview, disabled)">
              <label className="field pm-wide"><span>Card number</span><input disabled placeholder="•••• •••• •••• ••••" autoComplete="off" /></label>
              <label className="field pm-wide"><span>Cardholder&apos;s name</span><input disabled autoComplete="off" /></label>
              <label className="field"><span>Exp. date</span><input disabled placeholder="MM / YY" autoComplete="off" /></label>
              <label className="field"><span>CVC</span><input disabled placeholder="•••" autoComplete="off" /></label>
            </div>
            <p className="pm-secure"><span aria-hidden="true">🔒</span> Your payment is secure</p>
          </div>}
          {m.id !== "card" && method === m.id && <p className="pm-next">You will continue to {m.name} to confirm the payment.</p>}
        </div>)}</div>
        <div className="cart-under"><Link className="text-link" href="/checkout">‹ Back to review</Link></div>
      </section>
      <aside className="cart-summary pay-summary" aria-label="Order summary"><h2>Order summary</h2><div className="pay-summary-inner">{summary}</div>
        <div className="pay-aside-btn">{payButton()}</div>
        <p className="pay-hint">{chosen ? "Payment is coming next. Pay is not active yet." : "Choose a payment method to continue."}</p>
        <p className="gate-legal">By clicking Pay you accept the <Link className="text-link" href="/terms">Terms</Link> and <Link className="text-link" href="/privacy">Privacy policy</Link>.</p>
        <p className="pay-trust"><span aria-hidden="true">🔒</span> Secure checkout{items.some((e) => productById(e.productId)?.kind === "game_key") && " · Instant key delivery"}{items.some((e) => productById(e.productId)?.kind === "hardware") && " · Free shipping in Thailand"} · Support tickets 24/7</p>
        <PaymentLogos />
      </aside>
      <div className="cart-sticky pay-sticky"><div><span>Total</span><strong><Price thb={totals.total} /></strong></div>{payButton()}</div>
    </div>}
  </main><SiteFooter /></>;
}
