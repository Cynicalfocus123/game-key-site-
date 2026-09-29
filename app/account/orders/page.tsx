"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, dateText } from "@/lib/client/api";
import type { Order, ReturnRequest } from "@/lib/client/types";
import { matchesOrder, moreItems, orderTitle, paymentLabel } from "@/lib/orders";
import { reasonLabel, STATUS_CHIP, STATUS_LABEL } from "@/lib/returns";
import { AccountShell } from "../../components/account-shell";
import { Notice, useConfig } from "../../components/auth-ui";
import { useCurrency } from "../../components/currency-provider";
import { orderHref, OrderStatusText } from "../../components/orders-ui";

type Tab = "orders" | "returns";
function ReturnsTable({ returns }: { returns: ReturnRequest[] }) {
  if (!returns.length) return <p className="empty">No returns yet. Open an order to request a return.</p>;
  return <table className="dash-table returns-table">
    <thead><tr><th scope="col">Date</th><th scope="col">Return ID</th><th scope="col">Item</th><th scope="col" className="num">Qty</th><th scope="col">Reason</th><th scope="col">Status</th></tr></thead>
    <tbody>{returns.map((r) => <tr key={r.id}>
      <td data-label="Date">{dateText(r.createdAt)}</td>
      <td data-label="Return ID"><code>{r.number}</code></td>
      <td data-label="Item"><span className="return-item"><strong>{r.itemName}</strong><small>Order <Link className="text-link" href={orderHref({ id: r.orderId })}><code>{r.orderNumber}</code></Link></small></span></td>
      <td data-label="Qty" className="num">{r.quantity}</td>
      <td data-label="Reason">{reasonLabel(r.reason)}</td>
      <td data-label="Status"><span className="return-status"><span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>{r.adminNote && <small className="return-note">{r.adminNote}</small>}{r.status === "refunded" && !r.adminNote && <small className="return-note">Refund sent.</small>}</span></td>
    </tr>)}</tbody>
  </table>;
}

// Orders (email task, Eneba style): Date · Status · Order title · Order ID · Payment method · Total · Details. The whole row opens the order page.
// Desktop = full table; tablet (768–1099) hides Payment method; phones (< 768) = one card per order.
export default function OrdersPage() {
  const config = useConfig(); const router = useRouter(); const { format, price, currency } = useCurrency();
  const approx = (o: Order) => o.baseTotalMinor != null && currency.code !== o.currency ? <small className="order-approx">≈ {price(o.baseTotalMinor)}</small> : null;
  const [orders, setOrders] = useState<Order[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [returns, setReturns] = useState<ReturnRequest[]>([]); const [q, setQ] = useState("");
  const [tab, setTabState] = useState<Tab>("orders"); const [sent, setSent] = useState("");
  const setTab = (t: Tab) => { setTabState(t); const u = new URL(window.location.href); if (t === "returns") u.searchParams.set("tab", "returns"); else u.searchParams.delete("tab"); window.history.replaceState(null, "", u); };
  useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("tab") === "returns") setTabState("returns"); const n = p.get("sent"); if (n && /^RT-[A-Z0-9]{8}$/.test(n)) setSent(`Return ${n} requested. We will reply within 2 working days.`); }, []);
  const load = useCallback(() => Promise.all([api.listOrders(), api.listReturns()]).then(([r, rt]) => { if (r.ok) setOrders(r.orders); else setError(r.error); if (rt.ok) setReturns(rt.returns); }), []);
  useEffect(() => { load(); }, [load]);
  const sample = async () => { setBusy(true); const r = await api.createSampleOrder(); setBusy(false); if (!r.ok) setError(r.error); else load(); };
  const openReturns = returns.filter((r) => r.status === "requested" || r.status === "approved").length;
  const shown = (orders ?? []).filter((o) => matchesOrder(o.number, q));
  // Row click (mouse / touch). Keyboard users use the Details link in the row.
  const rowClick = (e: React.MouseEvent, o: Order) => { if ((e.target as HTMLElement).closest("a, button")) return; router.push(orderHref(o)); };
  return <AccountShell title="Returns & Orders">{() => <>
    <div className="dash-tabs" role="tablist" aria-label="Returns and orders">
      {(["orders", "returns"] as Tab[]).map((t) => <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => setTab(t)}>
        {t === "orders" ? "Orders" : "Returns"}{t === "orders" ? orders && <span className="seg-count">{orders.length}</span> : openReturns > 0 && <span className="nav-badge">{openReturns}</span>}</button>)}
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {sent && <Notice tone="success">{sent}</Notice>}
    {tab === "returns" ? <div role="tabpanel" id="panel-returns" aria-labelledby="tab-returns">
      <p className="muted-note">Hardware can be returned; game keys only while the key was never shown. A faulty key that was shown? <Link className="text-link" href="/account/tickets?new=1&subject=return_refund">Open a ticket</Link>.</p>
      <ReturnsTable returns={returns} />
    </div> : <div role="tabpanel" id="panel-orders" aria-labelledby="tab-orders">
      <div className="ord-tools">
        <label className="ord-search"><span className="sr-only">Search by order ID</span><input type="search" name="order-search" placeholder="Search by order ID" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></label>
        {config?.sampleOrders && <div className="acct-actions"><button className="btn btn-outline" onClick={sample} disabled={busy}>{busy ? "Adding…" : "Add sample order (test only)"}</button><small className="muted-note">Checkout is not built yet. Sample orders let you test this page.</small></div>}
      </div>
      {orders === null ? !error && <p className="muted-note">Loading…</p> : orders.length === 0 ? <p className="empty">No orders yet.</p> : shown.length === 0 ? <p className="empty">No order matches “{q.trim()}”.</p> :
        <div className="ord-wrap"><table className="orders-table ord-list">
          <thead><tr><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Order title</th><th scope="col">Order ID</th><th scope="col" className="col-pay">Payment method</th><th scope="col" className="num">Total amount</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
          <tbody>{shown.map((o) => <tr key={o.id} onClick={(e) => rowClick(e, o)}>
            <td className="c-date">{dateText(o.createdAt)}</td>
            <td className="c-status"><OrderStatusText status={o.status} /></td>
            <td className="c-title"><span className="ord-title">{orderTitle(o.items)}</span>{o.items.length > 1 && <small className="ord-more">{moreItems(o.items)}</small>}</td>
            <td className="c-id"><code>{o.number}</code>{o.isSample && <small className="muted-inline"> sample</small>}</td>
            <td className="c-pay col-pay">{paymentLabel(o.paymentMethod)}</td>
            <td className="c-total num"><span><b>{format(o.totalCents, o.currency)}</b>{approx(o)}</span></td>
            <td className="c-details"><Link className="text-link" href={orderHref(o)}>Details<span className="sr-only"> for order {o.number}</span> <span aria-hidden="true">›</span></Link></td>
          </tr>)}</tbody>
        </table></div>}
    </div>}
  </>}</AccountShell>;
}
