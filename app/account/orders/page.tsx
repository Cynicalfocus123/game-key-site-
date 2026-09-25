"use client";

import { useCallback, useEffect, useState } from "react";
import { api, dateText, money } from "@/lib/client/api";
import type { Order } from "@/lib/client/types";
import { AccountShell, StatusBadge } from "../../components/account-shell";
import { Notice, useConfig } from "../../components/auth-ui";

function KeyReveal({ value }: { value?: string }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="key-pending">Key delivery arrives with checkout (Step 6)</span>;
  return <span className="key-box">{show ? <code>{value}</code> : <code>•••••-•••••-•••••</code>}<button className="text-link as-link" onClick={() => setShow(s => !s)}>{show ? "Hide" : "Reveal key"}</button></span>;
}

export default function OrdersPage() {
  const config = useConfig();
  const [orders, setOrders] = useState<Order[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.listOrders().then(r => r.ok ? setOrders(r.orders) : setError(r.error)), []);
  useEffect(() => { load(); }, [load]);
  const sample = async () => { setBusy(true); const r = await api.createSampleOrder(); setBusy(false); if (!r.ok) setError(r.error); else load(); };
  return <AccountShell title="Order history">{() => <>
    {config?.sampleOrders && <div className="acct-actions"><button className="btn btn-outline" onClick={sample} disabled={busy}>{busy ? "Adding…" : "Add sample order (test only)"}</button><small className="muted-note">Checkout is not built yet. Sample orders let you test this page.</small></div>}
    {error && <Notice tone="error">{error}</Notice>}
    {orders === null ? <p className="muted-note">Loading…</p> : orders.length === 0 ? <p className="empty">No orders yet.</p> :
      <ul className="order-list">{orders.map(o => <li key={o.id} className="order">
        <header><div><strong>Order {o.number}</strong><span>{dateText(o.createdAt)}{o.isSample ? " · sample" : ""}</span></div><StatusBadge status={o.status} /><b>{money(o.totalCents, o.currency)}</b></header>
        <ul>{o.items.map(i => <li key={i.id}><div><span>{i.name}</span><small>{i.kind === "game_key" ? `Digital key · ${i.platform ?? ""} · ${i.region ?? ""}` : "Hardware · shipping"} · Qty {i.quantity}</small></div>{i.kind === "game_key" ? <KeyReveal value={i.demoKey} /> : <span className="key-pending">Tracking arrives with shipping (Step 7)</span>}<b>{money(i.unitPriceCents * i.quantity, o.currency)}</b></li>)}</ul>
      </li>)}</ul>}
  </>}</AccountShell>;
}
