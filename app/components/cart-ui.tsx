"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { maxQty, productById, type Product } from "@/lib/catalog";
import { useCart } from "./cart-provider";
import { Price } from "./currency-provider";

export const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
// "Steam · Global" for keys, "Hardware" for parts.
export const productMeta = (p: Product) => (p.kind === "game_key" ? `${p.platform} · ${p.region}` : "Hardware");

export function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => { const m = window.matchMedia(query); const on = () => setMatch(m.matches); on(); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, [query]);
  return match;
}

// A4: on every product card. "Added ✓" for 1.5 s; "Limit reached" at 5 keys / hardware stock.
export function AddToCartButton({ productId }: { productId: string }) {
  const { add, items } = useCart(); const [added, setAdded] = useState(false); const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const p = productById(productId); if (!p) return null;
  const atLimit = (items.find((e) => e.productId === productId)?.qty ?? 0) >= maxQty(p);
  const click = () => { if (add(productId) !== "added") return; setAdded(true); clearTimeout(timer.current); timer.current = setTimeout(() => setAdded(false), 1500); };
  return <button type="button" className={`cart-button${added ? " is-added" : ""}`} onClick={click} disabled={atLimit && !added} aria-label={`${added ? "Added" : atLimit ? "Limit reached" : "Add to cart"}: ${p.name}`}>{added ? "Added ✓" : atLimit ? "Limit reached" : "Add to cart"}</button>;
}

// A1–A3: header cart icon with live count, desktop popup under the icon, mobile centered popup.
export function CartHeaderButton() {
  const { totals, popup, openPopup, closePopup } = useCart();
  const mobile = useMedia("(max-width: 767px)"); const wrap = useRef<HTMLDivElement>(null); const [hover, setHover] = useState(false);
  const count = totals.count;
  useEffect(() => {
    if (!popup) return;
    const down = (e: PointerEvent) => { if (!mobile && !wrap.current?.contains(e.target as Node)) closePopup(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closePopup(); };
    document.addEventListener("pointerdown", down); window.addEventListener("keydown", key);
    const idle = !mobile && !hover ? setTimeout(closePopup, 6000) : undefined;
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); clearTimeout(idle); };
  }, [popup, mobile, hover, closePopup]);
  const click = (e: React.MouseEvent) => { if (mobile || !count) return; e.preventDefault(); if (popup) closePopup(); else openPopup("cart"); };
  return <div className="cart-wrap" ref={wrap} onMouseEnter={() => { if (mobile) return; setHover(true); if (count && !popup) openPopup("cart"); }} onMouseLeave={() => setHover(false)}>
    <Link className="cart" href="/cart" onClick={click} aria-label={`Shopping cart, ${count} ${count === 1 ? "item" : "items"}`} aria-expanded={!mobile && Boolean(popup)}><b>🛒</b><span>Cart</span>{count > 0 && <i data-cart-count>{count > 99 ? "99+" : count}</i>}</Link>
    {popup && (mobile ? popup === "added" && <MobileAdded /> : <DesktopPopup />)}
  </div>;
}

function DesktopPopup() {
  const { items, totals, closePopup, remove, checkout, popup } = useCart();
  const rows = items.slice(0, 3);
  return <div className="cart-pop" role="dialog" aria-label={popup === "added" ? "Added to cart" : "Your cart"}>
    <div className="cart-pop-head"><strong>{popup === "added" ? <><span className="ok" aria-hidden="true">✓</span> Added to cart</> : "Your cart"}</strong><button type="button" className="x" aria-label="Close cart popup" onClick={closePopup}>×</button></div>
    {rows.length ? <ul className="cart-pop-rows">{rows.map((e) => { const p = productById(e.productId)!; return <li key={p.id}>
      <img src={assetPath(p.image)} alt="" width={44} height={44} /><div><strong>{p.name}</strong><span>{productMeta(p)} · ×{e.qty}</span></div><Price thb={p.price * e.qty} /><button type="button" className="x" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>×</button>
    </li>; })}</ul> : <p className="cart-pop-empty">Your cart is empty.</p>}
    {items.length > 3 && <p className="cart-pop-more">and {items.length - 3} more</p>}
    <div className="cart-pop-sub"><span>Subtotal ({totals.count} {totals.count === 1 ? "item" : "items"})</span><Price thb={totals.subtotal} /></div>
    <div className="cart-pop-actions"><Link className="btn btn-outline" href="/cart" onClick={closePopup}>View cart</Link><button type="button" className="btn btn-primary" onClick={checkout} disabled={!items.length}>Checkout</button></div>
  </div>;
}

function MobileAdded() {
  const { totals, closePopup } = useCart(); const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return <div className="cart-sheet" role="presentation"><button type="button" className="cart-sheet-bg" aria-label="Close" onClick={closePopup} />
    <div className="cart-sheet-box" role="dialog" aria-modal="true" aria-labelledby="cart-sheet-title"><span className="cart-sheet-icon" aria-hidden="true">✓</span><h2 id="cart-sheet-title">Added to cart</h2><p>You have {totals.count} {totals.count === 1 ? "item" : "items"} in your cart</p>
      <button type="button" ref={first} className="btn btn-primary" onClick={closePopup}>Continue shopping</button><Link className="btn btn-outline" href="/cart" onClick={closePopup}>View cart</Link></div>
  </div>;
}

// A5 payment logos + trust block (text badges, no image files).
export const PaymentLogos = () => <ul className="pay-logos" aria-label="Payment methods">{["VISA", "Mastercard", "AMEX", "PromptPay"].map((x) => <li key={x}>{x}</li>)}</ul>;
export const TrustList = () => <ul className="trust"><li><b aria-hidden="true">🔒</b>Secure payment</li><li><b aria-hidden="true">⚡</b>Instant key delivery</li><li><b aria-hidden="true">✉</b>Support tickets 24/7</li></ul>;
