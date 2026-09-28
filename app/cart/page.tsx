"use client";

import Link from "next/link";
import { useState } from "react";
import { maxQty, productById } from "@/lib/catalog";
import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import { useAuth } from "../components/auth-provider";
import { useCart } from "../components/cart-provider";
import { assetPath, CouponLine, CouponNotes, productHref, RegionLine, TrustList, useMedia } from "../components/cart-ui";
import { PaymentLogos } from "../components/payment-logos";
import { ChargeNotice, Price } from "../components/currency-provider";
import { DemoBanner } from "../components/auth-ui";
import { FavoriteButton } from "../components/favorites-provider";


// A5–A7: cart page. Desktop = rows left, summary right. Mobile = stacked, coupon collapsed, sticky Total + Checkout bar.
export default function CartPage() {
  const { items, ready, totals, setQty, remove, clear, coupon, applyCoupon, checkout, openGate } = useCart();
  const { user } = useAuth(); const mobile = useMedia("(max-width: 767px)");
  const [code, setCode] = useState(""); const [codeError, setCodeError] = useState<React.ReactNode>(""); const [applying, setApplying] = useState(false);
  const apply = async (e: React.FormEvent) => {
    e.preventDefault(); if (applying) return; setApplying(true);
    const r = await applyCoupon(code); setApplying(false);
    if (r.ok) { setCode(""); setCodeError(""); } else setCodeError(r.minOrder ? <>Minimum order <Price thb={r.minOrder} /> for this code.</> : r.error);
  };
  const signIn = (e: React.MouseEvent) => { if (mobile) return; e.preventDefault(); openGate("signin"); };

  return <><SiteHeader /><main className="cart-main"><DemoBanner />
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Cart</span></nav>
    <h1 className="cart-title">Your cart{ready && ` (${totals.count})`}</h1>
    {!ready ? <p className="muted-note">Loading your cart…</p> : !items.length ? <section className="cart-empty">
      <span className="cart-empty-icon" aria-hidden="true">🛒</span><h2>Your cart is empty</h2><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link>
      {user === null && <p>Have an account? <Link className="text-link" href="/login?next=/cart" onClick={signIn}>Sign in</Link> to see your saved cart</p>}
    </section> : <div className="cart-layout">
      <section aria-label="Cart items"><ul className="cart-rows">{items.map((e) => { const p = productById(e.productId)!; const game = p.kind === "game_key"; const max = maxQty(p); const atLimit = e.qty >= max; return <li className="cart-row" key={p.id}>
        <Link href={productHref(p.id)} tabIndex={-1} aria-hidden="true"><img className={game ? "cover game" : "cover"} src={assetPath(p.image)} alt="" width={80} height={80} /></Link>
        <div className="cart-row-info"><h3><Link className="row-title" href={productHref(p.id)}>{p.name}</Link></h3><p>{game ? `${p.platform} · ${p.os} · Instant key` : "In stock · Free shipping"}</p><RegionLine p={p} />
          {atLimit && <p className="limit-note">{game ? `Max ${max} per order` : `Only ${max} in stock`}</p>}</div>
        <div className="qty" role="group" aria-label={`Quantity of ${p.name}`}><button type="button" aria-label={`Decrease quantity of ${p.name}`} disabled={e.qty <= 1} onClick={() => setQty(p.id, e.qty - 1)}>−</button><output aria-live="polite">{e.qty}</output><button type="button" aria-label={`Increase quantity of ${p.name}`} disabled={atLimit} onClick={() => setQty(p.id, e.qty + 1)}>+</button></div>
        <div className="cart-row-price"><Price thb={p.price * e.qty} />{e.qty > 1 && <small><Price thb={p.price} /> each</small>}</div>
        <div className="cart-row-actions"><FavoriteButton productId={p.id} name={p.name} /><button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>×</button></div>
      </li>; })}</ul>
      <div className="cart-under"><Link className="text-link" href="/">‹ Continue shopping</Link><button type="button" className="text-link as-link" onClick={clear}>Remove all</button></div></section>
      <aside className="cart-summary" aria-label="Order summary"><h2>Order summary</h2>
        <dl><div><dt>Subtotal</dt><dd><Price thb={totals.subtotal} /></dd></div><div><dt>Shipping</dt><dd>Free</dd></div>
          <CouponLine removable /></dl><CouponNotes />
        {!coupon && <details className="coupon-box" open={!mobile} key={String(mobile)}><summary>Have a coupon?</summary><form onSubmit={apply}><input aria-label="Coupon code" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn btn-outline" disabled={applying}>{applying ? "Checking…" : "Apply"}</button></form>{codeError && <p className="field-error" role="alert">{codeError}</p>}</details>}
        <div className="cart-total"><span>Total</span><strong><Price thb={totals.total} /></strong></div>
        <ChargeNotice thb={totals.total} />
        <button type="button" className="btn btn-primary cart-checkout" onClick={checkout}>Checkout</button>
        <PaymentLogos /><TrustList />
      </aside>
      <div className="cart-sticky"><div><span>Total</span><strong><Price thb={totals.total} /></strong></div><button type="button" className="btn btn-primary" onClick={checkout}>Checkout</button></div>
    </div>}
  </main><SiteFooter /></>;
}
