"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminMarketApi, money } from "@/lib/client/api";
import { keysText, ORDER_TABS, ORDERS_POLL_MS, TAB_LABEL, VIEW_CHIP, VIEW_LABEL, type AdminOrderPage, type AdminOrderQuery } from "@/lib/admin-orders";
import { PAYMENT_LABEL } from "@/lib/orders";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Admin Orders (section "orders", wireframe orders-admin-seller-wireframe.png screen A, approved 2026-10-24): every order, newest first,
// 50 per page. Today tiles, search (order no., buyer email / name, product), status tabs, payment / sold by / date filters. Checks for new
// orders every 30 s: orders made after the page was opened get a blue dot and a "N new orders" bar. Row opens /admin/orders/view?id=.
const href = (id: string) => `/admin/orders/view?id=${encodeURIComponent(id)}`;
const moneyList = (l: { currency: string; totalMinor: number }[]) => (l.length ? l.map((m) => `${money(m.totalMinor, m.currency)}${m.currency === "THB" ? "" : ` ${m.currency}`}`).join(" · ") : "—");
const usd = (c: number) => money(c, "USD");

function Orders() {
  const router = useRouter();
  const [q, setQ] = useState<AdminOrderQuery>({ q: "", tab: "all", method: "", seller: "", from: "", to: "", page: 1 });
  const [data, setData] = useState<AdminOrderPage | null>(null); const [error, setError] = useState("");
  const opened = useRef(new Date().toISOString()); const [seenAt, setSeenAt] = useState(opened.current);
  useEffect(() => {
    let live = true;
    const load = () => adminMarketApi.orders({ ...q, since: opened.current }).then((r) => { if (!live) return; if (r.ok) { setData(r.data); setError(""); } else setError(r.error); });
    const t = setTimeout(load, q.q ? 250 : 0); const poll = setInterval(load, ORDERS_POLL_MS);
    return () => { live = false; clearTimeout(t); clearInterval(poll); };
  }, [q]);
  const set = (k: keyof AdminOrderQuery) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setQ({ ...q, [k]: e.target.value, page: 1 });
  const showNew = () => { setSeenAt(opened.current); opened.current = new Date().toISOString(); setQ({ ...q, page: 1 }); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1; const t = data?.tiles;
  const filtered = Boolean(q.q.trim() || q.method || q.seller || q.from || q.to || q.tab !== "all");
  return <>
    {t && <div className="acct-tiles ord-tiles">
      <div className="acct-tile"><span>Orders today</span><strong>{t.today}</strong></div>
      <div className="acct-tile"><span>Paid today</span><strong>{moneyList(t.paidTodayMoney)}</strong><small>{t.paidToday} order{t.paidToday === 1 ? "" : "s"}</small></div>
      <div className="acct-tile"><span>Pending now (keys held)</span><strong>{t.pendingNow}</strong></div>
      <div className="acct-tile"><span>Failed / expired today</span><strong>{t.closedToday}</strong></div>
      <div className="acct-tile"><span>Seller sales today</span><strong>{usd(t.sellerToday.usdCents)}</strong><small>{t.sellerToday.lines} line{t.sellerToday.lines === 1 ? "" : "s"} · {t.sellerToday.sellers} seller{t.sellerToday.sellers === 1 ? "" : "s"}</small></div>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Order no. (CC-…), buyer email, name or product" value={q.q} onChange={set("q")} /></label>
      <label className="field"><span>Payment</span><select value={q.method} onChange={set("method")}><option value="">All payments</option>{Object.entries(PAYMENT_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="field"><span>Sold by</span><select value={q.seller} onChange={set("seller")}><option value="">CoreCart + all sellers</option><option value="corecart">CoreCart</option>{data?.sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field"><span>From</span><input type="date" value={q.from} onChange={set("from")} /></label>
      <label className="field"><span>To</span><input type="date" value={q.to} onChange={set("to")} /></label>
    </div>
    {data && data.newSince > 0 && <p className="ord-new" role="status"><span className="ord-dot" aria-hidden="true" /> {data.newSince} new order{data.newSince === 1 ? "" : "s"} since you opened this page — <button type="button" className="as-link text-link" onClick={showNew}>Show</button></p>}
    <div className="dash-tabs adm-tabs" role="tablist" aria-label="Order status">{ORDER_TABS.map((tab) => <button key={tab} role="tab" type="button" aria-selected={q.tab === tab} onClick={() => setQ({ ...q, tab, page: 1 })}>{TAB_LABEL[tab]}{data && <small className="adm-tab-n">{data.counts[tab]}</small>}</button>)}</div>
    {!data ? !error && <p className="muted-note">Loading…</p> : !data.rows.length ? <p className="empty">{filtered ? "No orders match." : "No orders yet."}</p> : <>
      <p className="muted-note adm-count">{data.total} order{data.total === 1 ? "" : "s"} · totals in the currency the buyer paid</p>
      <div className="adm-table-wrap"><table className="adm-table ord-admin-table">
        <thead><tr><th>Order</th><th>Date</th><th>Buyer</th><th>Items</th><th>Sold by</th><th>Payment</th><th className="num">Total</th><th>Status</th><th>Keys</th></tr></thead>
        <tbody>{data.rows.map((r) => { const fresh = r.createdAt > seenAt; return <tr key={r.id} className={fresh ? "ord-fresh" : undefined} onClick={() => router.push(href(r.id))}>
          <td>{fresh && <span className="ord-dot" title="New since you opened this page" />}<Link href={href(r.id)} onClick={(e) => e.stopPropagation()}><strong className="mono">{r.number}</strong></Link></td>
          <td>{dateTime(r.createdAt)}</td>
          <td><strong>{r.buyer.name}</strong><small>{r.buyer.email}</small></td>
          <td>{r.items.map((i, n) => <div key={n}>{i.name}{i.platform ? ` (${i.platform})` : ""} ×{i.quantity}</div>)}</td>
          <td>{r.items.map((i, n) => <div key={n}>{i.seller}</div>)}</td>
          <td>{r.method ? PAYMENT_LABEL[r.method] ?? r.method : "—"}{r.last4 ? ` ••${r.last4}` : ""}</td>
          <td className="num"><strong>{money(r.totalCents, r.currency)}</strong>{r.currency !== "THB" && <small>{r.currency}</small>}</td>
          <td><span className={`chip ${VIEW_CHIP[r.view]}`}>{VIEW_LABEL[r.view]}</span>{r.holdUntil && <small>held until {dateTime(r.holdUntil).split(", ").pop()}</small>}</td>
          <td><small className="ord-keys">{keysText(r)}</small></td>
        </tr>; })}</tbody>
      </table></div>
      {/* Phones: one card per order (the table is hidden under 768 px). */}
      <ul className="ord-cards">{data.rows.map((r) => <li key={r.id} className={r.createdAt > seenAt ? "ord-fresh" : undefined}><Link href={href(r.id)}>
        <span className="ord-card-top"><strong className="mono">{r.number}</strong><span className={`chip ${VIEW_CHIP[r.view]}`}>{VIEW_LABEL[r.view]}</span></span>
        <small>{dateTime(r.createdAt)} · {r.method ? PAYMENT_LABEL[r.method] ?? r.method : "—"}</small>
        <span>{r.buyer.name} · {r.buyer.email}</span>
        <span>{r.items.map((i) => `${i.name} ×${i.quantity} (${i.seller})`).join(", ")}</span>
        <span className="ord-card-top"><strong>{money(r.totalCents, r.currency)}{r.currency !== "THB" ? ` ${r.currency}` : ""}</strong><small>{keysText(r)}</small></span>
      </Link></li>)}</ul>
      {pages > 1 && <div className="adm-pager"><button type="button" className="btn btn-outline btn-sm" disabled={data.page <= 1} onClick={() => setQ({ ...q, page: data.page - 1 })}>Previous</button>
        <span className="muted-note">Page {data.page} of {pages}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={data.page >= pages} onClick={() => setQ({ ...q, page: data.page + 1 })}>Next</button></div>}
    </>}
  </>;
}

export default function Page() { return <AdminShell title="Orders"><Orders /></AdminShell>; }
