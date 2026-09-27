"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, dateText } from "@/lib/client/api";
import Link from "next/link";
import type { GameKey, Order, OrderItem, ReturnRequest } from "@/lib/client/types";
import { checkNewReturn, eligibility, holdsUnits, MESSAGE_MAX, NOT_ELIGIBLE, reasonLabel, reasonsFor, STATUS_CHIP, STATUS_LABEL, type ReturnReason } from "@/lib/returns";
import { AccountShell, Cover, StatusBadge } from "../../components/account-shell";
import { Notice, useConfig } from "../../components/auth-ui";
import { useCurrency } from "../../components/currency-provider";

// Key items link to the key detail page (one link per key unit). Reveal happens there (ends the refund window).
function KeyLinks({ keys, name }: { keys: GameKey[]; name: string }) {
  if (!keys.length) return <span className="key-pending">Key delivery arrives with checkout</span>;
  return <span className="key-links">{keys.map((k, n) => <Link key={k.id} className="text-link" href={`/account/keys/view?id=${encodeURIComponent(k.id)}`}>
    {k.revealedAt ? "View key" : "Reveal key"}{keys.length > 1 && ` ${n + 1}`} <span aria-hidden="true">›</span><span className="sr-only"> {name}</span></Link>)}</span>;
}

const itemsText = (o: Order) => o.items.length === 1 ? o.items[0].name : `${o.items[0]?.name ?? ""} +${o.items.length - 1} more`;
type Tab = "orders" | "returns";

// Return form under one order line (lib/returns.ts rules; the API checks them again).
function ReturnForm({ order, item, max, onDone, onCancel }: { order: Order; item: OrderItem; max: number; onDone: (r: ReturnRequest) => void; onCancel: () => void }) {
  const reasons = reasonsFor(item.kind, order.createdAt);
  const [qty, setQty] = useState(1); const [reason, setReason] = useState<ReturnReason | "">(""); const [message, setMessage] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { orderItemId: item.id, quantity: qty, reason: reason as ReturnReason, message };
    const err = checkNewReturn(input, item.kind, order.createdAt, max); if (err) { setError(err); return; }
    setBusy(true); setError(""); const r = await api.requestReturn(input); setBusy(false);
    if (r.ok) onDone(r.ret); else setError(r.error);
  };
  return <form className="return-form" onSubmit={submit} noValidate aria-label={`Return ${item.name}`}>
    <strong>Request a return: {item.name}</strong>
    <div className="return-fields">
      <label className="field"><span>Quantity</span><select name="quantity" value={qty} onChange={(e) => setQty(Number(e.target.value))}>{Array.from({ length: max }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
      <label className="field"><span>Reason</span><select name="reason" value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}><option value="">Choose a reason</option>{reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    </div>
    <label className="field"><span>Message {reason === "other" ? "" : "(optional)"}</span><textarea name="message" rows={3} maxLength={MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened?" /></label>
    {item.kind === "game_key" && <p className="coupon-note">Do not reveal the key while the return is open. Keys in a return cannot be shown.</p>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="return-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send return request"}</button><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function ReturnsTable({ returns }: { returns: ReturnRequest[] }) {
  if (!returns.length) return <p className="empty">No returns yet. Open an order&apos;s details to request a return.</p>;
  return <table className="dash-table returns-table">
    <thead><tr><th scope="col">Date</th><th scope="col">Return ID</th><th scope="col">Item</th><th scope="col" className="num">Qty</th><th scope="col">Reason</th><th scope="col">Status</th></tr></thead>
    <tbody>{returns.map((r) => <tr key={r.id}>
      <td data-label="Date">{dateText(r.createdAt)}</td>
      <td data-label="Return ID"><code>{r.number}</code></td>
      <td data-label="Item"><span className="return-item"><strong>{r.itemName}</strong><small>Order <code>{r.orderNumber}</code></small></span></td>
      <td data-label="Qty" className="num">{r.quantity}</td>
      <td data-label="Reason">{reasonLabel(r.reason)}</td>
      <td data-label="Status"><span className="return-status"><span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>{r.adminNote && <small className="return-note">{r.adminNote}</small>}{r.status === "refunded" && !r.adminNote && <small className="return-note">Refund sent.</small>}</span></td>
    </tr>)}</tbody>
  </table>;
}

// Returns & Orders (Handoff v14 task 2): tabs Orders | Returns. Orders = table Date, Order ID, Items, Total, Status, Details › (item rows + Request return).
export default function OrdersPage() {
  const config = useConfig(); const { format, price, currency } = useCurrency();
  // Orders show what was charged. If the visitor currency differs, add today's converted value as a reference.
  const approx = (o: Order) => o.baseTotalMinor != null && currency.code !== o.currency ? <small className="order-approx">≈ {price(o.baseTotalMinor)}</small> : null;
  const [orders, setOrders] = useState<Order[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null); const [form, setForm] = useState<string | null>(null);
  const [keys, setKeys] = useState<GameKey[]>([]); const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [tab, setTabState] = useState<Tab>("orders"); const [sent, setSent] = useState("");
  const setTab = (t: Tab) => { setTabState(t); const u = new URL(window.location.href); if (t === "returns") u.searchParams.set("tab", "returns"); else u.searchParams.delete("tab"); window.history.replaceState(null, "", u); };
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "returns") setTabState("returns"); }, []);
  const load = useCallback(() => Promise.all([api.listOrders(), api.listKeys(), api.listReturns()]).then(([r, k, rt]) => {
    if (r.ok) setOrders(r.orders); else setError(r.error); if (k.ok) setKeys(k.keys); if (rt.ok) setReturns(rt.returns);
  }), []);
  useEffect(() => { load(); }, [load]);
  const sample = async () => { setBusy(true); const r = await api.createSampleOrder(); setBusy(false); if (!r.ok) setError(r.error); else load(); };
  const facts = (o: Order, i: OrderItem) => { const k = keys.filter((x) => x.orderItemId === i.id);
    return eligibility({ kind: i.kind, quantity: i.quantity, orderStatus: o.status, orderCreatedAt: o.createdAt, keyCount: k.length, unrevealedKeys: k.filter((x) => !x.revealedAt).length,
      heldUnits: returns.filter((r) => r.orderItemId === i.id && holdsUnits(r.status)).reduce((t, r) => t + r.quantity, 0) }); };
  const done = (r: ReturnRequest) => { setForm(null); setSent(`Return ${r.number} requested. We will reply within 2 working days.`); load(); setTab("returns"); };
  const openReturns = returns.filter((r) => r.status === "requested" || r.status === "approved").length;
  return <AccountShell title="Returns & Orders">{() => <>
    <div className="dash-tabs" role="tablist" aria-label="Returns and orders">
      {(["orders", "returns"] as Tab[]).map((t) => <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => setTab(t)}>
        {t === "orders" ? "Orders" : "Returns"}{t === "orders" ? orders && <span className="seg-count">{orders.length}</span> : openReturns > 0 && <span className="nav-badge">{openReturns}</span>}</button>)}
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {sent && <Notice tone="success">{sent}</Notice>}
    {tab === "returns" ? <div role="tabpanel" id="panel-returns" aria-labelledby="tab-returns">
      <p className="muted-note">Hardware can be returned; game keys only while the key was never shown. A faulty key that was shown? <Link className="text-link" href="/account/tickets?new=1">Open a ticket</Link>.</p>
      <ReturnsTable returns={returns} />
    </div> : <div role="tabpanel" id="panel-orders" aria-labelledby="tab-orders">
      {config?.sampleOrders && <div className="acct-actions"><button className="btn btn-outline" onClick={sample} disabled={busy}>{busy ? "Adding…" : "Add sample order (test only)"}</button><small className="muted-note">Checkout is not built yet. Sample orders let you test this page.</small></div>}
      {orders === null ? !error && <p className="muted-note">Loading…</p> : orders.length === 0 ? <p className="empty">No orders yet.</p> :
        <table className="dash-table orders-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Order ID</th><th scope="col">Items</th><th scope="col" className="num">Total</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
          <tbody>{orders.map((o) => <Fragment key={o.id}>
            <tr className={open === o.id ? "is-open" : ""}>
              <td data-label="Date">{dateText(o.createdAt)}</td>
              <td data-label="Order ID"><span><code>{o.number}</code>{o.isSample && <small className="muted-inline"> sample</small>}</span></td>
              <td data-label="Items" className="items-cell">{itemsText(o)}</td>
              <td data-label="Total" className="num order-total"><span><b>{format(o.totalCents, o.currency)}</b>{approx(o)}</span></td>
              <td data-label="Status"><StatusBadge status={o.status} /></td>
              <td className="details-cell"><button className="text-link as-link" aria-expanded={open === o.id} aria-controls={`order-${o.id}`} onClick={() => { setOpen(open === o.id ? null : o.id); setForm(null); }}>{open === o.id ? "Hide details" : <>Details <span aria-hidden="true">›</span></>}<span className="sr-only"> for order {o.number}</span></button></td>
            </tr>
            {open === o.id && <tr className="detail-row" id={`order-${o.id}`}><td colSpan={6}>
              <ul className="order-items">{o.items.map((i) => { const e = facts(o, i); const held = returns.filter((r) => r.orderItemId === i.id && holdsUnits(r.status)); return <Fragment key={i.id}><li>
                <Cover name={i.name} platform={i.platform} size={40} />
                <div><strong>{i.name}</strong><small>{i.kind === "game_key" ? `Digital key · ${i.platform ?? ""} · ${i.region ?? ""}` : "Hardware · shipping"} · Qty {i.quantity}</small>
                  <span className="return-line">{e.ok ? <button type="button" className="text-link as-link" aria-expanded={form === i.id} onClick={() => { setForm(form === i.id ? null : i.id); setSent(""); }}>Request return<span className="sr-only"> for {i.name}</span></button>
                    : <small className="return-no">{NOT_ELIGIBLE[e.why]}{e.why === "revealed" && <> Key not working? <Link className="text-link" href={`/account/tickets?new=1&key=${encodeURIComponent(keys.find((k) => k.orderItemId === i.id)?.id ?? "")}`}>Open a ticket</Link></>}</small>}
                    {held.length > 0 && <small className="return-no">{held.map((r) => `${r.number} ${STATUS_LABEL[r.status].toLowerCase()}`).join(" · ")}</small>}</span>
                </div>
                {i.kind === "game_key" ? <KeyLinks keys={keys.filter((k) => k.orderItemId === i.id)} name={i.name} /> : <span className="key-pending">Tracking arrives with shipping</span>}
                <b>{format(i.unitPriceCents * i.quantity, o.currency)}</b>
              </li>
              {form === i.id && e.ok && <li className="return-li"><ReturnForm order={o} item={i} max={e.max} onDone={done} onCancel={() => setForm(null)} /></li>}</Fragment>; })}</ul>
            </td></tr>}
          </Fragment>)}</tbody>
        </table>}
    </div>}
  </>}</AccountShell>;
}
