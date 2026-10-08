"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { marketApi } from "@/lib/client/api";
import type { Product } from "@/lib/catalog";
import { isLowStock, LOW_STOCK_MAX, MARKET_ERRORS, sellableProducts, type SellerHome, type SellerOffer } from "@/lib/marketplace";
import { useCatalog } from "../components/catalog";
import { Notice } from "../components/auth-ui";
import { RevenuePanel } from "../components/seller-revenue";
import { productSub, Receive, SellerCard, SellerShell, SellerTiles, usd } from "../components/seller-ui";

// Seller dashboard home /seller (wireframe screen 3A desktop, 5A phone): Hello + seller card + 4 tiles, Revenue (sample until
// real orders), Offers low on stock (Low stock / Out of stock, 5 per page, low-stock number = seller setting), Add stock.
export default function SellerHomePage() {
  return <SellerShell title={(h) => `Hello, ${h.store.name}`} crumb="Seller dashboard" sub={false}>{(c) => <Dashboard home={c.home} setHome={c.setHome} />}</SellerShell>;
}

function Dashboard({ home, setHome }: { home: SellerHome; setHome: (h: SellerHome) => void }) {
  const products = useCatalog(); const [offers, setOffers] = useState<SellerOffer[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { marketApi.offers().then((r) => (r.ok ? setOffers(r.offers) : setError(r.error))); }, []);
  const ids = offers?.length ? offers.map((o) => o.productId) : sellableProducts(products).slice(0, 3).map((p) => p.id);
  return <>
    <section className="sl-panel" aria-label="Your store">
      <SellerCard home={home} />
      <SellerTiles home={home} />
    </section>
    <RevenuePanel seed={home.store.slug} productIds={ids} products={products} />
    {error ? <Notice tone="error">{error}</Notice> : <LowStock offers={offers} home={home} setHome={setHome} products={products} />}
    <section className="sl-panel sl-add" aria-labelledby="add-h">
      <div className="sl-phead"><h2 id="add-h">Add stock</h2>
        <div className="sl-actions"><Link className="btn btn-primary" href="/seller/offers/new">+ New offer</Link><Link className="btn btn-outline" href="/seller/offers">Add keys to an offer</Link></div></div>
      <p className="muted-note">Only products in the CoreCart catalog can be sold. Can&apos;t find one? <Link className="text-link" href="/seller/requests">Request a new product</Link></p>
    </section>
  </>;
}

const PAGE = 5;
function LowStock({ offers, home, setHome, products }: { offers: SellerOffer[] | null; home: SellerHome; setHome: (h: SellerHome) => void; products: Product[] }) {
  const [tab, setTab] = useState<"low" | "out">("low"); const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(String(home.store.lowStockAt)); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const at = home.store.lowStockAt;
  const low = (offers ?? []).filter((o) => isLowStock(o, at)).sort((a, b) => a.stock - b.stock); const out = (offers ?? []).filter((o) => o.status === "sold_out");
  const list = tab === "low" ? low : out; const pages = Math.max(1, Math.ceil(list.length / PAGE)); const cur = Math.min(page, pages - 1);
  const pick = (t: "low" | "out") => { setTab(t); setPage(0); };
  const prod = (id: string) => products.find((p) => p.id === id);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); const n = Number(limit);
    if (!/^\d+$/.test(limit.trim()) || n > LOW_STOCK_MAX) { setMsg({ tone: "error", text: MARKET_ERRORS.lowStock }); return; }
    setBusy(true); const r = await marketApi.saveStore({ lowStockAt: n }); setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: r.error }); return; }
    setHome({ ...home, store: r.store }); setPage(0); setMsg({ tone: "success", text: `✓ Saved: low stock = ${r.store.lowStockAt} keys or fewer.` });
  };
  return <section className="sl-panel" aria-labelledby="low-h">
    <div className="sl-phead">
      <h2 id="low-h">Offers low on stock</h2>
      <Link className="text-link" href="/seller/offers">See all offers <span aria-hidden="true">›</span></Link>
    </div>
    <div className="sl-tabs" role="tablist" aria-label="Stock">
      <button type="button" role="tab" aria-selected={tab === "low"} onClick={() => pick("low")}>Low stock ({low.length})</button>
      <button type="button" role="tab" aria-selected={tab === "out"} onClick={() => pick("out")}>Out of stock ({out.length})</button>
    </div>
    {offers === null ? <p className="muted-note">Loading offers…</p> : !list.length ? <p className="muted-note sl-empty">{tab === "low" ? `No active offer has ${at} keys or fewer.` : "No offer is sold out."}</p> : <>
      <div className="ord-wrap"><table className="sl-table sl-low">
        <thead><tr><th scope="col">Product name</th><th scope="col">Quantity</th><th scope="col">Your price</th><th scope="col">You receive</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{list.slice(cur * PAGE, cur * PAGE + PAGE).map((o) => { const p = prod(o.productId); return <tr key={o.id}>
          <td className="c-name"><b>{p?.name ?? "Product"}</b>{p && <span className="muted-note sl-inline"> {productSub(p)}</span>}</td>
          <td className="c-qty" data-label="Quantity"><b className={o.stock ? "sl-amber" : "sl-red"}>{o.stock}</b><span className="sl-m"> left</span></td>
          <td className="c-price" data-label="Your price">{usd(o.priceUsdCents)}</td>
          <td className="c-get" data-label="You receive"><Receive cents={o.priceUsdCents} /></td>
          <td className="c-act"><Link className="btn btn-primary btn-sm" href={`/seller/offers/new?offer=${o.id}`}>Add keys<span className="sr-only"> to {p?.name ?? "this offer"}</span></Link></td>
        </tr>; })}</tbody>
      </table></div>
      {pages > 1 && <nav className="sl-pager" aria-label="Pages">
        <button type="button" className="btn btn-outline btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page">‹</button>
        <span>Page {cur + 1} of {pages}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page">›</button>
      </nav>}
    </>}
    <form className="sl-limit" onSubmit={save}>
      <label htmlFor="low-at">Low stock = </label>
      <input id="low-at" inputMode="numeric" value={limit} onChange={(e) => { setLimit(e.target.value); setMsg(null); }} aria-describedby="low-at-hint" />
      <span id="low-at-hint">keys or fewer</span>
      <button className="btn btn-outline btn-sm" disabled={busy || limit.trim() === String(at)}>Save</button>
    </form>
    {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
  </section>;
}
