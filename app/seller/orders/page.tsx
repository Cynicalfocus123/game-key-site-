"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { marketApi, money } from "@/lib/client/api";
import { SALE_CHIP, SALE_TAB_LABEL, SALE_TABS, saleLabel, type SellerSalesPage, type SellerSalesQuery } from "@/lib/admin-orders";
import { SellerShell } from "../../components/seller-ui";
import { Notice } from "../../components/auth-ui";

// Seller Orders (wireframe screen C, approved 2026-10-24): only this seller's order lines. Buyer = masked name (J***n); never the buyer's
// email, address, IP, the order total or other lines of the same order. A problem with a sale → CoreCart support ticket with the order number.
const usd = (c: number) => money(c, "USD");
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const report = (n: string) => `/account/tickets?new=1&subject=order_issue&order=${encodeURIComponent(n)}`;

function Sales() {
  const [q, setQ] = useState<SellerSalesQuery>({ q: "", tab: "all", from: "", to: "", page: 1 });
  const [data, setData] = useState<SellerSalesPage | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => marketApi.sales(q).then((r) => { if (!live) return; if (r.ok) { setData(r.data); setError(""); } else setError(r.error); }), q.q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const set = (k: keyof SellerSalesQuery) => (e: React.ChangeEvent<HTMLInputElement>) => setQ({ ...q, [k]: e.target.value, page: 1 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1; const t = data?.tiles;
  const filtered = Boolean(q.q.trim() || q.from || q.to || q.tab !== "all");
  return <>
    {t && <div className="acct-tiles sl-tiles">
      <div className="acct-tile"><span>Sold today</span><strong>{t.soldTodayKeys} key{t.soldTodayKeys === 1 ? "" : "s"}</strong><small>{t.soldTodayOrders} order{t.soldTodayOrders === 1 ? "" : "s"}</small></div>
      <div className="acct-tile"><span>Income today</span><strong>{usd(t.incomeTodayUsdCents)}</strong><small>gross</small></div>
      <div className="acct-tile"><span>You receive today</span><strong>{t.receiveTodayUsdCents === null ? usd(t.incomeTodayUsdCents) : usd(t.receiveTodayUsdCents)}</strong><small>{t.receiveTodayUsdCents === null ? "minus commission (% pending)" : "after commission"}</small></div>
      <div className="acct-tile"><span>Keys held now</span><strong>{t.heldNow}</strong><small>waiting for payment</small></div>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters sl-sales-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Order no. or product" value={q.q} onChange={set("q")} /></label>
      <label className="field"><span>From</span><input type="date" value={q.from} onChange={set("from")} /></label>
      <label className="field"><span>To</span><input type="date" value={q.to} onChange={set("to")} /></label>
    </div>
    <div className="dash-tabs sl-tabs" role="tablist" aria-label="Sale status">{SALE_TABS.map((tab) => <button key={tab} role="tab" type="button" aria-selected={q.tab === tab} onClick={() => setQ({ ...q, tab, page: 1 })}>{SALE_TAB_LABEL[tab]}{data && <small className="adm-tab-n">{data.counts[tab]}</small>}</button>)}</div>
    {!data ? !error && <p className="muted-note">Loading…</p> : !data.rows.length ? <div className="sl-emptybox"><strong>{filtered ? "No sales match." : "No sales yet"}</strong>{!filtered && <p>When a buyer pays for one of your offers, the sale shows here.</p>}</div> : <>
      <div className="ord-wrap"><table className="sl-table sl-sales">
        <thead><tr><th>Order</th><th>Date</th><th>Buyer</th><th>Product</th><th className="num">Qty</th><th className="num">Price</th><th className="num">You receive</th><th>Key status</th><th></th></tr></thead>
        <tbody>{data.rows.map((r) => <tr key={r.itemId}>
          <td data-label="Order"><strong className="mono">{r.orderNumber}</strong></td>
          <td data-label="Date">{when(r.createdAt)}</td>
          <td data-label="Buyer">{r.buyer}</td>
          <td data-label="Product">{r.name}<small>{[r.platform, r.region].filter(Boolean).join(" · ")}</small></td>
          <td data-label="Qty" className="num">{r.quantity}</td>
          <td data-label="Price" className="num">{usd(r.unitUsdCents)}</td>
          <td data-label="You receive" className="num">{r.state === "sold" ? (r.receiveUsdCents === null ? <>{usd(r.unitUsdCents * r.quantity)}<small>minus commission</small></> : usd(r.receiveUsdCents)) : "—"}</td>
          <td data-label="Key status"><span className={`chip ${SALE_CHIP[r.state]}`}>{saleLabel(r)}</span><small>{r.note}{r.last4.length ? ` · key …${r.last4.join(", …")}` : ""}</small></td>
          <td>{r.state === "sold" || r.state === "returned" ? <Link className="text-link" href={report(r.orderNumber)}>Report a problem</Link> : null}</td>
        </tr>)}</tbody>
      </table></div>
      {pages > 1 && <div className="adm-pager"><button type="button" className="btn btn-outline btn-sm" disabled={data.page <= 1} onClick={() => setQ({ ...q, page: data.page - 1 })}>Previous</button>
        <span className="muted-note">Page {data.page} of {pages}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={data.page >= pages} onClick={() => setQ({ ...q, page: data.page + 1 })}>Next</button></div>}
    </>}
    <p className="muted-note">Prices in USD (the price you set). Buyer details stay with CoreCart; a problem with a sale goes through CoreCart support with the order number.</p>
  </>;
}

export default function SellerOrdersPage() {
  return <SellerShell title="Orders" crumb="Orders">{() => <Sales />}</SellerShell>;
}
