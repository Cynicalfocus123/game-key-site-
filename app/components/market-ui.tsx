"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import { publicMarketApi } from "@/lib/client/api";
import { offerList, ratingText, type PublicOffer, type PublicSeller } from "@/lib/marketplace";
import { useCart } from "./cart-provider";
import { storeHref } from "./cart-ui";
import { Price } from "./currency-provider";

// Buyer side of the seller marketplace (step 4, user answers 2026-10-08; CODEBASE.md section 21). Only the product page lists offers.
// No stat lines, no cashback: logo, name, Verified ✓, Trusted ★ (only once earned), rating or "New seller", Selling since, View store.
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

// Logo in a square frame (rounded corners): the picture is fitted (contain), never stretched or cut. No logo → first letter.
export function SellerLogo({ name, logo, size, own = false }: { name: string; logo: string | null; size: 96 | 56 | 40; own?: boolean }) {
  return <span className={`mk-logo mk-logo-${size}${logo ? "" : own ? " mk-logo-own" : " mk-logo-letter"}`} aria-hidden="true">
    {logo ? <img src={logo} alt="" width={size} height={size} loading="lazy" /> : (name.trim()[0] ?? "?").toUpperCase()}
  </span>;
}
export function SellerTicks({ s }: { s: PublicSeller }) {
  return <>
    {s.verified && <span className="mk-tick" title="Verified seller"><span aria-hidden="true">✓</span> Verified</span>}
    {s.trusted && <span className="mk-trusted" title={`Trusted seller: 5 five-star ratings in the last 30 days`}><span aria-hidden="true">★</span> Trusted</span>}
  </>;
}
export const RatingLine = ({ s }: { s: PublicSeller }) =>
  <span className={s.rating ? "mk-rating" : "mk-new"}>{s.rating && <span aria-hidden="true">★ </span>}{ratingText(s.rating)}</span>;

// Seller name with the seller card: desktop = hover / keyboard focus (the name links to the store); phones (no hover) = tap opens
// the card, ✕ or a tap outside closes it. CoreCart's own stock has no store page.
export function SellerName({ s }: { s: PublicSeller }) {
  const [open, setOpen] = useState(false); const wrap = useRef<HTMLSpanElement>(null); const id = useId();
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down); window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [open]);
  const touch = () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
  const tap = (e: React.MouseEvent) => { if (!touch()) return; e.preventDefault(); setOpen((v) => !v); };
  const hover = (on: boolean) => () => { if (!touch()) setOpen(on); };
  return <span className="mk-who" ref={wrap} onMouseEnter={hover(true)} onMouseLeave={hover(false)} onFocus={hover(true)} onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
    {s.own ? <button type="button" className="mk-name as-link" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>{s.name}</button>
      : <Link className="mk-name" href={storeHref(s.slug)} aria-expanded={open} aria-controls={id} onClick={tap}>{s.name}</Link>}
    {open && <SellerCard s={s} id={id} close={() => setOpen(false)} />}
  </span>;
}
function SellerCard({ s, id, close }: { s: PublicSeller; id: string; close: () => void }) {
  return <span className="mk-card" id={id} role="dialog" aria-label={`Seller ${s.name}`}>
    <button type="button" className="mk-card-x" aria-label="Close seller card" onClick={close}>✕</button>
    <span className="mk-card-head"><SellerLogo name={s.name} logo={s.logo} size={56} own={s.own} /><span><strong>{s.name}</strong><span className="mk-ticks"><SellerTicks s={s} /></span></span></span>
    <span className="mk-card-line"><RatingLine s={s} /></span>
    {s.own ? <span className="mk-card-line muted-note">CoreCart&apos;s own stock</span> : s.since && <span className="mk-card-line muted-note">Selling on CoreCart since {monthYear(s.since)}</span>}
    {!s.own && <Link className="text-link mk-card-store" href={storeHref(s.slug)}>View store <span aria-hidden="true">›</span></Link>}
  </span>;
}

// Product page list (Eneba style, refs from the user 2026-10-08): "Recommended offers" = Featured offer (first after sorting: Trusted
// first, then lowest price), then "N other offers". Nothing is shown when no seller sells this product (normal product page).
// Buy now → that offer goes into the cart → cart page (then the usual checkout).
export function ProductOffers({ p }: { p: Product }) {
  const [offers, setOffers] = useState<PublicOffer[] | null>(null);
  useEffect(() => {
    let live = true; setOffers(null);
    publicMarketApi.offers(p.id).then((r) => { if (live) setOffers(r.ok ? r.offers : []); });
    return () => { live = false; };
  }, [p.id]);
  if (!offers?.some((o) => !o.seller.own)) return null;
  const { featured, others, lowestId } = offerList(offers);
  return <section className="mk-offers" aria-labelledby="mk-offers-h">
    <h2 id="mk-offers-h">Recommended offers</h2>
    <ul className="mk-list">{featured && <OfferRow o={featured} featured lowest={featured.id === lowestId} />}</ul>
    {others.length > 0 && <>
      <h2 className="mk-other-h"><b>{others.length}</b> other offer{others.length === 1 ? "" : "s"}</h2>
      <ul className="mk-list">{others.map((o) => <OfferRow key={o.id} o={o} lowest={o.id === lowestId} />)}</ul>
    </>}
  </section>;
}
function OfferRow({ o, featured = false, lowest }: { o: PublicOffer; featured?: boolean; lowest: boolean }) {
  const { addOffer } = useCart(); const router = useRouter(); const [limit, setLimit] = useState(false);
  const buy = () => { if (addOffer(o) === "limit") { setLimit(true); return; } router.push("/cart"); };
  return <li className={`mk-row${featured ? " mk-featured" : ""}`} data-offer={o.id}>
    <SellerLogo name={o.seller.name} logo={o.seller.logo} size={40} own={o.seller.own} />
    <div className="mk-seller">
      {featured && <span className="mk-feat-label">Featured offer</span>}
      <span className="mk-name-line"><SellerName s={o.seller} /><SellerTicks s={o.seller} /></span>
      <RatingLine s={o.seller} />
    </div>
    <div className="mk-price"><strong><Price thb={o.unit} /></strong>{lowest && <span className="mk-lowest">Lowest price</span>}</div>
    <div className="mk-buy">
      <button type="button" className="btn btn-primary" onClick={buy} disabled={limit} aria-label={`Buy now from ${o.seller.name}`}>{limit ? "Limit reached" : "Buy now"}</button>
      {limit && <span className="mk-limit" role="status">{o.max < 5 ? `Only ${o.max} left from this seller` : "Max 5 per order"} — already in your cart</span>}
    </div>
  </li>;
}
