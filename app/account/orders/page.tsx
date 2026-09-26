"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, dateText } from "@/lib/client/api";
import type { Order } from "@/lib/client/types";
import { AccountShell, Cover, StatusBadge } from "../../components/account-shell";
import { Notice, useConfig } from "../../components/auth-ui";
import { useCurrency } from "../../components/currency-provider";

function KeyReveal({ value }: { value?: string }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="key-pending">Key delivery arrives with checkout</span>;
  return <span className="key-box">{show ? <code>{value}</code> : <code>•••••-•••••-•••••</code>}<button className="text-link as-link" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Reveal key"}</button></span>;
}

const itemsText = (o: Order) => o.items.length === 1 ? o.items[0].name : `${o.items[0]?.name ?? ""} +${o.items.length - 1} more`;

// Orders (Handoff v8 C4): table Date, Order ID, Items, Total, Status, Details ›. Details opens the item list under the row.
export default function OrdersPage() {
  const config = useConfig(); const { format, price, currency } = useCurrency();
  // Orders show what was charged. If the visitor currency differs, add today's converted value as a reference.
  const approx = (o: Order) => o.baseTotalMinor != null && currency.code !== o.currency ? <small className="order-approx">≈ {price(o.baseTotalMinor)}</small> : null;
  const [orders, setOrders] = useState<Order[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api.listOrders().then((r) => r.ok ? setOrders(r.orders) : setError(r.error)), []);
  useEffect(() => { load(); }, [load]);
  const sample = async () => { setBusy(true); const r = await api.createSampleOrder(); setBusy(false); if (!r.ok) setError(r.error); else load(); };
  return <AccountShell title="Orders">{() => <>
    {config?.sampleOrders && <div className="acct-actions"><button className="btn btn-outline" onClick={sample} disabled={busy}>{busy ? "Adding…" : "Add sample order (test only)"}</button><small className="muted-note">Checkout is not built yet. Sample orders let you test this page.</small></div>}
    {error && <Notice tone="error">{error}</Notice>}
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
            <td className="details-cell"><button className="text-link as-link" aria-expanded={open === o.id} aria-controls={`order-${o.id}`} onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? "Hide details" : <>Details <span aria-hidden="true">›</span></>}<span className="sr-only"> for order {o.number}</span></button></td>
          </tr>
          {open === o.id && <tr className="detail-row" id={`order-${o.id}`}><td colSpan={6}>
            <ul className="order-items">{o.items.map((i) => <li key={i.id}>
              <Cover name={i.name} platform={i.platform} size={40} />
              <div><strong>{i.name}</strong><small>{i.kind === "game_key" ? `Digital key · ${i.platform ?? ""} · ${i.region ?? ""}` : "Hardware · shipping"} · Qty {i.quantity}</small></div>
              {i.kind === "game_key" ? <KeyReveal value={i.demoKey} /> : <span className="key-pending">Tracking arrives with shipping</span>}
              <b>{format(i.unitPriceCents * i.quantity, o.currency)}</b>
            </li>)}</ul>
          </td></tr>}
        </Fragment>)}</tbody>
      </table>}
  </>}</AccountShell>;
}
