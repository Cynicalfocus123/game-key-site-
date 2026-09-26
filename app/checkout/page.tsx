"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productById } from "@/lib/catalog";
import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import { DemoBanner, Notice, readQuery } from "../components/auth-ui";
import { useAuth } from "../components/auth-provider";
import { useCart } from "../components/cart-provider";
import { assetPath, productMeta } from "../components/cart-ui";
import { ChargeNotice, Price } from "../components/currency-provider";

// A8: order review only. Payment is the next build step. Signed out → checkout gate.
export default function CheckoutPage() {
  const { user } = useAuth(); const { items, ready, totals, openGate } = useCart();
  const [verified, setVerified] = useState(false);
  const allowed = Boolean(user?.emailVerified);
  useEffect(() => { setVerified(readQuery("verified") === "1"); }, []);
  useEffect(() => { if (user !== undefined && !user?.emailVerified) openGate("choice", "/checkout"); }, [user, openGate]);

  return <><SiteHeader /><main className="cart-main"><DemoBanner />
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/cart">Cart</Link> <span aria-hidden="true">›</span> <span aria-current="page">Checkout</span></nav>
    <h1 className="cart-title">Checkout</h1>
    {user === undefined || !ready ? <p className="muted-note">Loading…</p> : !allowed ? <section className="cart-empty">
      <h2>Sign in to check out</h2><p>Your cart is saved. Create an account or sign in to continue.</p>
      <button type="button" className="btn btn-primary" onClick={() => openGate("choice", "/checkout")}>Continue</button><Link className="text-link" href="/cart">Back to cart</Link>
    </section> : !items.length ? <section className="cart-empty"><h2>Your cart is empty</h2><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link></section> : <div className="cart-layout">
      <section aria-label="Order review">
        {verified && <Notice tone="success">Email verified. Your cart is ready.</Notice>}
        <h2 className="checkout-h">Review your order</h2>
        <ul className="cart-rows review">{items.map((e) => { const p = productById(e.productId)!; return <li className="cart-row" key={p.id}>
          <img className={p.kind === "game_key" ? "cover game" : "cover"} src={assetPath(p.image)} alt="" width={64} height={64} />
          <div className="cart-row-info"><h3>{p.name}</h3><p>{productMeta(p)} · ×{e.qty}</p></div>
          <div className="cart-row-price"><Price thb={p.price * e.qty} /></div></li>; })}</ul>
        <Notice>Payment is coming in the next step. Your cart is saved to your account ({user?.email}).</Notice>
        <div className="cart-under"><Link className="text-link" href="/cart">‹ Back to cart</Link></div>
      </section>
      <aside className="cart-summary" aria-label="Order summary"><h2>Order summary</h2>
        <dl><div><dt>Subtotal ({totals.count} {totals.count === 1 ? "item" : "items"})</dt><dd><Price thb={totals.subtotal} /></dd></div><div><dt>Shipping</dt><dd>Free</dd></div>
          {totals.coupon && <div className="coupon-line"><dt>Coupon {totals.coupon.code}</dt><dd>−<Price thb={totals.discount} /></dd></div>}</dl>
        <div className="cart-total"><span>Total</span><strong><Price thb={totals.total} /></strong></div>
        <ChargeNotice thb={totals.total} />
        <button type="button" className="btn btn-primary cart-checkout" disabled>Pay now (coming next)</button>
      </aside>
    </div>}
  </main><SiteFooter /></>;
}
