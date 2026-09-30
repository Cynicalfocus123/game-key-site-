"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { maxQty, productById, regionWorks, type Product } from "@/lib/catalog";
import { guessCountry } from "@/lib/currency/currencies";
import { countryName } from "@/lib/profile";
import { useAuth } from "./auth-provider";
import { useCart } from "./cart-provider";
import { Price } from "./currency-provider";

// Site files get the Pages base path; uploaded images (data: URL in the demo) are used as they are.
export const assetPath = (path: string) => (path.startsWith("/") ? `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}` : path);
// "Steam · Global" for keys, "Hardware" for parts.
export const productHref = (id: string) => `/product?id=${encodeURIComponent(id)}`;
export const productMeta = (p: Product) => (p.kind === "game_key" ? `${p.platform} · ${p.region}` : "Hardware");

export function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => { const m = window.matchMedia(query); const on = () => setMatch(m.matches); on(); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, [query]);
  return match;
}

// Visitor country for region checks: account country → browser time zone / language guess. null until mounted (static HTML has none).
export function useVisitorCountry() {
  const { user } = useAuth(); const [guess, setGuess] = useState<string | null>(null);
  useEffect(() => { try { setGuess(guessCountry(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages) ?? null); } catch { /* no Intl */ } }, []);
  return user?.country || guess;
}
// Region line: green when the key works in the visitor country, red when it does not. Hardware: shipping line.
export function RegionLine({ p }: { p: Product }) {
  const country = useVisitorCountry();
  if (p.kind !== "game_key") return <p className="region">Ships from Bangkok</p>;
  const works = regionWorks(p, country);
  if (works === null) return <p className="region">{p.region}</p>;
  return <p className={works ? "region" : "region bad"}><span aria-hidden="true">{works ? "✓ " : "⚠ "}</span>{p.region} — {works ? "works" : "does not work"} in {countryName(country!)}</p>;
}

// A4: on every product card. "Added ✓" for 1.5 s; "Limit reached" at 5 keys / hardware stock.
export function AddToCartButton({ productId }: { productId: string }) {
  const { add, items } = useCart(); const [added, setAdded] = useState(false); const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const p = productById(productId); if (!p) return null;
  if (p.soldOut) return <button type="button" className="cart-button" disabled aria-label={`Sold out: ${p.name}`}>Sold out</button>;
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
      <img src={assetPath(p.image)} alt="" width={44} height={55} /><div><strong>{p.name}</strong><span>{productMeta(p)} · ×{e.qty}</span></div><Price thb={p.price * e.qty} /><button type="button" className="x" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>×</button>
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

// Trust block (payment logos: payment-logos.tsx).
// keys / hardware: what is being bought (hardware pages said "Instant key delivery" before step 5).
export const TrustList = ({ keys = true, hardware = false }: { keys?: boolean; hardware?: boolean }) => <ul className="trust"><li><b aria-hidden="true">🔒</b>Secure payment</li>{keys && <li><b aria-hidden="true">⚡</b>Instant key delivery</li>}{hardware && <li><b aria-hidden="true">🚚</b>Free shipping in Thailand</li>}<li><b aria-hidden="true">✉</b>Support tickets 24/7</li></ul>;

// Coupon row inside a summary <dl>: "Coupon SAVE10 (Digital games) −฿…". Green when it discounts; grey dash while it has nothing to discount yet.
export function CouponLine({ removable = false }: { removable?: boolean }) {
  const { totals, removeCoupon } = useCart(); const c = totals.coupon;
  if (!c) return null;
  return <div className={c.issue ? "coupon-line coupon-idle" : "coupon-line"}>
    <dt>Coupon {c.code}{c.scope && <span className="coupon-scope"> ({c.scope})</span>}{removable && <> <button type="button" className="text-link as-link" onClick={removeCoupon}>Remove<span className="sr-only"> coupon {c.code}</span></button></>}</dt>
    <dd>{c.issue ? "—" : <>−<Price thb={totals.discount} /></>}</dd>
  </div>;
}
// Amber notes under the summary: why an applied code gives 0 now, or that a re-check removed it.
export function CouponNotes() {
  const { totals, couponNote, saveNote } = useCart(); const issue = totals.coupon?.issue;
  return <div aria-live="polite">
    {saveNote && <p className="coupon-note" role="alert">{saveNote}</p>}
    {issue?.kind === "scope" && <p className="coupon-note">{totals.coupon!.code} applies to {issue.label} only.</p>}
    {issue?.kind === "min" && <p className="coupon-note">Add <Price thb={issue.missing} /> more to use {totals.coupon!.code}.</p>}
    {couponNote && <p className="coupon-note" role="status">{couponNote}</p>}
  </div>;
}
