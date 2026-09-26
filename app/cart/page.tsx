"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { maxQty, productById } from "@/lib/catalog";
import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import { useAuth } from "../components/auth-provider";
import { useCart } from "../components/cart-provider";
import { assetPath, PaymentLogos, TrustList, useMedia } from "../components/cart-ui";
import { ChargeNotice, Price } from "../components/currency-provider";
import { DemoBanner } from "../components/auth-ui";

// ♡ save for later: this browser only until a wishlist exists.
const SAVED_KEY = "corecart-saved";
function useSaved() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); } catch { /* storage blocked */ } }, []);
  const toggle = (id: string) => setSaved((s) => { const n = s.includes(id) ? s.filter((x) => x !== id) : [...s, id]; try { localStorage.setItem(SAVED_KEY, JSON.stringify(n)); } catch { /* storage blocked */ } return n; });
  return { saved, toggle };
}

// A5–A7: cart page. Desktop = rows left, summary right. Mobile = stacked, coupon collapsed, sticky Total + Checkout bar.
export default function CartPage() {
  const { items, ready, totals, setQty, remove, clear, coupon, applyCoupon, removeCoupon, checkout, openGate } = useCart();
  const { user } = useAuth(); const mobile = useMedia("(max-width: 767px)"); const { saved, toggle } = useSaved();
  const [code, setCode] = useState(""); const [codeError, setCodeError] = useState("");
  const apply = (e: React.FormEvent) => { e.preventDefault(); if (applyCoupon(code)) { setCode(""); setCodeError(""); } else setCodeError("This coupon code is not valid."); };
  const signIn = (e: React.MouseEvent) => { if (mobile) return; e.preventDefault(); openGate("signin"); };

  return <><SiteHeader /><main className="cart-main"><DemoBanner />
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Cart</span></nav>
    <h1 className="cart-title">Your cart{ready && ` (${totals.count})`}</h1>
    {!ready ? <p className="muted-note">Loading your cart…</p> : !items.length ? <section className="cart-empty">
      <span className="cart-empty-icon" aria-hidden="true">🛒</span><h2>Your cart is empty</h2><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link>
      {user === null && <p>Have an account? <Link className="text-link" href="/login?next=/cart" onClick={signIn}>Sign in</Link> to see your saved cart</p>}
    </section> : <div className="cart-layout">
      <section aria-label="Cart items"><ul className="cart-rows">{items.map((e) => { const p = productById(e.productId)!; const game = p.kind === "game_key"; const max = maxQty(p); const atLimit = e.qty >= max; return <li className="cart-row" key={p.id}>
        <img className={game ? "cover game" : "cover"} src={assetPath(p.image)} alt="" width={80} height={80} />
        <div className="cart-row-info"><h3>{p.name}</h3><p>{game ? `${p.platform} · ${p.os} · Instant key` : "In stock · Free shipping"}</p><p className="region">{game ? `${p.region} — works in Thailand` : "Ships from Bangkok"}</p>
          {atLimit && <p className="limit-note">{game ? `Limit ${max} keys per order` : `Only ${max} in stock`}</p>}</div>
        <div className="qty" role="group" aria-label={`Quantity of ${p.name}`}><button type="button" aria-label={`Decrease quantity of ${p.name}`} disabled={e.qty <= 1} onClick={() => setQty(p.id, e.qty - 1)}>−</button><output aria-live="polite">{e.qty}</output><button type="button" aria-label={`Increase quantity of ${p.name}`} disabled={atLimit} onClick={() => setQty(p.id, e.qty + 1)}>+</button></div>
        <div className="cart-row-price"><Price thb={p.price * e.qty} />{e.qty > 1 && <small><Price thb={p.price} /> each</small>}</div>
        <div className="cart-row-actions"><button type="button" aria-pressed={saved.includes(p.id)} aria-label={`Save ${p.name} for later`} onClick={() => toggle(p.id)}>{saved.includes(p.id) ? "♥" : "♡"}</button><button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>×</button></div>
      </li>; })}</ul>
      <div className="cart-under"><Link className="text-link" href="/">‹ Continue shopping</Link><button type="button" className="text-link as-link" onClick={clear}>Remove all</button></div></section>
      <aside className="cart-summary" aria-label="Order summary"><h2>Order summary</h2>
        <dl><div><dt>Subtotal</dt><dd><Price thb={totals.subtotal} /></dd></div><div><dt>Shipping</dt><dd>Free</dd></div>
          {totals.coupon && <div className="coupon-line"><dt>Coupon {totals.coupon.code} <button type="button" className="text-link as-link" onClick={removeCoupon}>Remove</button></dt><dd>−<Price thb={totals.discount} /></dd></div>}</dl>
        {!coupon && <details className="coupon-box" open={!mobile} key={String(mobile)}><summary>Have a coupon?</summary><form onSubmit={apply}><input aria-label="Coupon code" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn btn-outline">Apply</button></form>{codeError && <p className="field-error" role="alert">{codeError}</p>}</details>}
        <div className="cart-total"><span>Total</span><strong><Price thb={totals.total} /></strong></div>
        <ChargeNotice thb={totals.total} />
        <button type="button" className="btn btn-primary cart-checkout" onClick={checkout}>Checkout</button>
        <PaymentLogos /><TrustList />
      </aside>
      <div className="cart-sticky"><div><span>Total</span><strong><Price thb={totals.total} /></strong></div><button type="button" className="btn btn-primary" onClick={checkout}>Checkout</button></div>
    </div>}
  </main><SiteFooter /></>;
}
