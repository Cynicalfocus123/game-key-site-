"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { marketApi } from "@/lib/client/api";
import { MARKET_ERRORS, offerCounts, parseUsd, usdInput, type OfferStatus, type SellerOffer } from "@/lib/marketplace";
import { useCatalog } from "../../components/catalog";
import { Notice } from "../../components/auth-ui";
import { productSub, Receive, SellerShell, StatusChip, usd } from "../../components/seller-ui";

// My offers /seller/offers (wireframe screen 3 desktop, 6 phone): counts, tabs, table (phones: one card per offer, same rows),
// On switch = pause / resume, Edit = price inline (USD), Add keys → /seller/offers/new?offer=. The table scrolls inside its box.
type Tab = "all" | OfferStatus;
const TABS: { id: Tab; label: string }[] = [{ id: "all", label: "All" }, { id: "active", label: "Active" }, { id: "paused", label: "Paused" }, { id: "sold_out", label: "Sold out" }];

export default function SellerOffersPage() {
  return <SellerShell title="My offers" crumb="My offers">{() => <Offers />}</SellerShell>;
}

function Offers() {
  const products = useCatalog(); const [offers, setOffers] = useState<SellerOffer[] | null>(null); const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all"); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  useEffect(() => { marketApi.offers().then((r) => (r.ok ? setOffers(r.offers) : setError(r.error))); }, []);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!offers) return <p className="muted-note">Loading offers…</p>;
  const counts = offerCounts(offers); const tabCount: Record<Tab, number> = { all: counts.all, active: counts.active, paused: counts.paused, sold_out: counts.soldOut };
  const list = tab === "all" ? offers : offers.filter((o) => o.status === tab);
  const put = (o: SellerOffer) => setOffers((cur) => (cur ?? []).map((x) => (x.id === o.id ? o : x)));
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? "Product";
  const toggle = async (o: SellerOffer) => {
    const r = await marketApi.updateOffer(o.id, { active: !o.active });
    if (!r.ok) { setMsg({ tone: "error", text: r.error }); return; }
    put(r.offer); setMsg({ tone: "success", text: `${name(o.productId)}: ${r.offer.active ? "offer is on again" : "offer paused (buyers do not see it)"}.` });
  };
  return <>
    <p className="muted-note sl-lead">Price is what the buyer pays (USD, converted for each buyer); you receive the price minus the commission.</p>
    <dl className="sl-kv" aria-label="Offer numbers">
      <div><dt>Active offers</dt><dd>{counts.active}</dd></div>
      <div><dt>Keys in stock</dt><dd>{counts.keysInStock.toLocaleString("en-US")}</dd></div>
      <div><dt>Sold out</dt><dd className={counts.soldOut ? "sl-red" : undefined}>{counts.soldOut}</dd></div>
    </dl>
    <div className="sl-bar-row">
      <div className="sl-tabs" role="tablist" aria-label="Offers">{TABS.map((t) =>
        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label} {tabCount[t.id]}</button>)}</div>
      <Link className="btn btn-primary" href="/seller/offers/new">+ New offer</Link>
    </div>
    {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    {!offers.length ? <div className="sl-emptybox"><strong>No offers yet</strong><p>Pick a product from the catalog, set your price and paste your keys.</p><Link className="btn btn-primary" href="/seller/offers/new">+ New offer</Link></div>
      : !list.length ? <p className="muted-note sl-empty">No offers in this tab.</p>
      : <div className="ord-wrap sl-scroll"><table className="sl-table sl-offers">
        <thead><tr><th scope="col">Product</th><th scope="col">Your price</th><th scope="col">Lowest other price</th><th scope="col">You receive</th><th scope="col">Stock</th><th scope="col">Status</th><th scope="col">On</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{list.map((o) => <OfferRow key={o.id} o={o} name={name(o.productId)} sub={(() => { const p = products.find((x) => x.id === o.productId); return p ? productSub(p) : ""; })()}
          onSaved={(x) => { put(x); setMsg({ tone: "success", text: `${name(o.productId)}: price saved (${usd(x.priceUsdCents)}).` }); }} onToggle={() => toggle(o)} onError={(t) => setMsg({ tone: "error", text: t })} />)}</tbody>
      </table></div>}
    <p className="muted-note">Sold out = stock 0: hidden from buyers automatically, back by itself when you add keys. Paused = you switched it off.</p>
  </>;
}

function OfferRow({ o, name, sub, onSaved, onToggle, onError }: { o: SellerOffer; name: string; sub: string; onSaved: (o: SellerOffer) => void; onToggle: () => void; onError: (t: string) => void }) {
  const [edit, setEdit] = useState(false); const [price, setPrice] = useState(usdInput(o.priceUsdCents)); const [bad, setBad] = useState(""); const [busy, setBusy] = useState(false);
  const lowest = o.lowestOtherUsdCents; const isLowest = lowest === null || o.priceUsdCents <= lowest;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); const cents = parseUsd(price);
    if (cents === null) { setBad(MARKET_ERRORS.price); return; }
    if (cents === o.priceUsdCents) { setEdit(false); return; }
    setBusy(true); const r = await marketApi.updateOffer(o.id, { priceUsdCents: cents }); setBusy(false);
    if (!r.ok) { onError(r.error); return; }
    setEdit(false); setBad(""); onSaved(r.offer);
  };
  return <tr data-offer={o.productId}>
    <td className="c-name"><b>{name}</b> <span className="sl-m"><StatusChip status={o.status} /></span><span className="muted-note sl-sub">{sub}</span></td>
    <td className="c-price" data-label="Your price">{edit ? <form className="sl-price-edit" onSubmit={save}>
      <label><span className="sr-only">New price for {name} (USD)</span><span aria-hidden="true">$</span><input value={price} onChange={(e) => { setPrice(e.target.value); setBad(""); }} inputMode="decimal" autoFocus aria-invalid={!!bad} /></label>
      <button className="btn btn-primary btn-sm" disabled={busy}>Save</button><button type="button" className="btn btn-outline btn-sm" onClick={() => { setEdit(false); setBad(""); setPrice(usdInput(o.priceUsdCents)); }}>Cancel</button>
      {bad && <span className="sl-err" role="alert">{bad}</span>}
    </form> : usd(o.priceUsdCents)}</td>
    <td className="c-low" data-label="Lowest other price">{lowest === null ? "—" : <>{usd(lowest)} {isLowest ? <span className="chip chip-green">Lowest</span> : <span className="chip chip-amber">You are not lowest</span>}</>}</td>
    <td className="c-get" data-label="You receive"><Receive cents={o.priceUsdCents} /></td>
    <td className="c-qty" data-label="Stock"><b>{o.stock}</b></td>
    <td className="c-status"><StatusChip status={o.status} /></td>
    <td className="c-on"><button type="button" role="switch" aria-checked={o.active} className={`adm-switch${o.active ? " on" : ""}`} aria-label={`Offer on: ${name}`} onClick={onToggle}><i /></button></td>
    <td className="c-act"><div className="sl-actions">
      {!edit && <button type="button" className="btn btn-outline btn-sm" onClick={() => setEdit(true)}>Edit<span className="sr-only"> price of {name}</span></button>}
      <Link className={`btn btn-sm ${o.stock ? "btn-outline" : "btn-primary"}`} href={`/seller/offers/new?offer=${o.id}`}>Add keys<span className="sr-only"> to {name}</span></Link>
    </div></td>
  </tr>;
}
