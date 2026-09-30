"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { maxQty, productById } from "@/lib/catalog";
import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import { DemoBanner, Notice, readQuery } from "../components/auth-ui";
import { useAuth } from "../components/auth-provider";
import { useCart } from "../components/cart-provider";
import { assetPath, CouponLine, CouponNotes, productMeta, RegionLine } from "../components/cart-ui";
import { CatalogNotice } from "../components/catalog";
import { ChargeNotice, Price } from "../components/currency-provider";
import { PaymentLogos } from "../components/payment-logos";
import { FeeTaxLines, useCharges } from "../components/fees";

// A8: order review only. Payment is the next build step. Signed out → checkout gate.
export default function CheckoutPage() {
  const { user } = useAuth(); const { items, ready, totals, openGate } = useCart();
  const { settings: fees, c } = useCharges(totals.total, null); // task 7: tax is known on the payment page (billing country)
  const [verified, setVerified] = useState(false);
  const allowed = Boolean(user?.emailVerified);
  useEffect(() => { setVerified(readQuery("verified") === "1"); }, []);
  useEffect(() => { if (user !== undefined && !user?.emailVerified) openGate("choice", "/checkout"); }, [user, openGate]);

  return <><SiteHeader /><main className="cart-main"><DemoBanner />
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/cart">Cart</Link> <span aria-hidden="true">›</span> <span aria-current="page">Checkout</span></nav>
    <h1 className="cart-title">Checkout</h1>
    {user === undefined || !ready ? <><p className="muted-note">Loading…</p><CatalogNotice /></> : !allowed ? <section className="cart-empty">
      <h2>Sign in to check out</h2><p>Your cart is saved. Create an account or sign in to continue.</p>
      <button type="button" className="btn btn-primary" onClick={() => openGate("choice", "/checkout")}>Continue</button><Link className="text-link" href="/cart">Back to cart</Link>
    </section> : !items.length ? <section className="cart-empty"><h2>Your cart is empty</h2><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link></section> : <div className="cart-layout">
      <section aria-label="Order review">
        {verified && <Notice tone="success">Email verified. Your cart is ready.</Notice>}
        <h2 className="checkout-h">Review your order</h2>
        <ul className="cart-rows review">{items.map((e) => { const p = productById(e.productId)!; return <li className="cart-row" key={p.id}>
          <img className="cover" src={assetPath(p.image)} alt="" width={64} height={80} />
          <div className="cart-row-info"><h3>{p.name}</h3><p>{productMeta(p)} · ×{e.qty}</p><RegionLine p={p} />{p.kind === "game_key" && e.qty >= maxQty(p) && <p className="limit-note">Max {maxQty(p)} per order</p>}</div>
          <div className="cart-row-price"><Price thb={p.price * e.qty} /></div></li>; })}</ul>
        <Notice>Check your items, then continue to payment. Your cart is saved to your account ({user?.email}).</Notice>
        <div className="cart-under"><Link className="text-link" href="/cart">‹ Back to cart</Link></div>
      </section>
      <aside className="cart-summary" aria-label="Order summary"><h2>Order summary</h2>
        <dl><div><dt>Subtotal ({totals.count} {totals.count === 1 ? "item" : "items"})</dt><dd><Price thb={totals.subtotal} /></dd></div><div><dt>Shipping</dt><dd>Free</dd></div>
          <CouponLine /><FeeTaxLines settings={fees} c={c} /></dl><CouponNotes />
        <div className="cart-total"><span>{(c.tax == null ? "Estimated total" : "Total")}</span><strong><Price thb={c.total} /></strong></div>
        <ChargeNotice thb={c.total} />
        <Link className="btn btn-primary cart-checkout" href="/checkout/payment">Continue to payment</Link>
        <PaymentLogos />
      </aside>
    </div>}
  </main><SiteFooter /></>;
}
