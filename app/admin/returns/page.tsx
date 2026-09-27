"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { NEXT_STATUS, NOTE_MAX, reasonLabel, STATUS_CHIP, STATUS_LABEL, type ReturnRequest, type ReturnStatus } from "@/lib/returns";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Admin returns (Handoff v14 task 2): list, search, status filter; row opens detail with message + status change + note.
// Refund = manual until payments exist: "Refunded" records that the money was sent back outside CoreCart.
const STATUSES: ReturnStatus[] = ["requested", "approved", "rejected", "refunded"];
const ACTION: Record<ReturnStatus, string> = { requested: "Requested", approved: "Approve", rejected: "Reject", refunded: "Mark refunded" };

function Detail({ r, onSaved }: { r: ReturnRequest; onSaved: () => void }) {
  const next = NEXT_STATUS[r.status];
  const [status, setStatus] = useState<ReturnStatus | "">(next[0] ?? ""); const [note, setNote] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!status) return;
    setBusy(true); setError(""); const res = await adminApi.updateReturn(r.id, status, note.trim() || null); setBusy(false);
    if (res.ok) { setNote(""); onSaved(); } else setError(res.error);
  };
  return <div className="rt-detail">
    <dl className="rt-facts">
      <div><dt>Customer</dt><dd>{r.customerEmail}</dd></div>
      <div><dt>Order</dt><dd><code>{r.orderNumber}</code></dd></div>
      <div><dt>Item</dt><dd>{r.itemName} · {r.kind === "game_key" ? `Digital key${r.platform ? ` · ${r.platform}` : ""}` : "Hardware"} · Qty {r.quantity}</dd></div>
      <div><dt>Reason</dt><dd>{reasonLabel(r.reason)}</dd></div>
      <div><dt>Message</dt><dd className="rt-msg">{r.message || "—"}</dd></div>
      {r.adminNote && <div><dt>Note to customer</dt><dd className="rt-msg">{r.adminNote}</dd></div>}
      <div><dt>Updated</dt><dd>{dateTime(r.updatedAt)}</dd></div>
    </dl>
    {next.length ? <form className="rt-form" onSubmit={save} noValidate>
      <label className="field"><span>Change status</span><select name="status" value={status} onChange={(e) => setStatus(e.target.value as ReturnStatus)}>{next.map((s) => <option key={s} value={s}>{ACTION[s]}</option>)}</select></label>
      <label className="field"><span>Note to customer {status === "rejected" ? "(required)" : "(optional)"}</span><textarea name="note" rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === "refunded" ? "e.g. Refunded ฿990 to PromptPay on 2 Oct" : "Shown in the customer's Returns tab"} /></label>
      {r.kind === "game_key" && status === "refunded" && <p className="muted-note">The key units stay blocked from reveal. Disable them with the supplier before refunding.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
    </form> : <p className="muted-note">This return is {STATUS_LABEL[r.status].toLowerCase()}. No further changes.</p>}
  </div>;
}

function Returns() {
  const [list, setList] = useState<ReturnRequest[] | null>(null); const [error, setError] = useState("");
  const [q, setQ] = useState(""); const [filter, setFilter] = useState<"" | ReturnStatus>(""); const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await adminApi.returns(); if (r.ok) setList(r.returns); else setError(r.error); }, []);
  useEffect(() => { load(); }, [load]);
  const query = q.trim().toLowerCase();
  const rows = (list ?? []).filter((r) => (!filter || r.status === filter) && (!query || [r.number, r.orderNumber, r.itemName, r.customerEmail ?? ""].some((x) => x.toLowerCase().includes(query))));
  const count = (s: ReturnStatus) => (list ?? []).filter((r) => r.status === s).length;
  return <>
    <p className="muted-note">Customers ask for returns from Returns &amp; Orders. Keys can only be returned while never revealed. Refunds are sent by hand until payments are connected.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Return ID, order ID, item or email" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label className="field"><span>Status</span><select value={filter} onChange={(e) => setFilter(e.target.value as "" | ReturnStatus)}>
        <option value="">All ({list?.length ?? 0})</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]} ({count(s)})</option>)}
      </select></label>
    </div>
    {!list ? !error && <p className="muted-note">Loading…</p> : !rows.length ? <p className="empty">{list.length ? "No returns match." : "No return requests yet."}</p> : <div className="adm-table-wrap"><table className="adm-table static rt-table">
      <thead><tr><th>Date</th><th>Return</th><th>Customer</th><th>Item</th><th className="num">Qty</th><th>Reason</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
      <tbody>{rows.map((r) => <Fragment key={r.id}>
        <tr className={open === r.id ? "is-open" : ""}>
          <td>{dateTime(r.createdAt)}</td>
          <td><code>{r.number}</code><small>Order {r.orderNumber}</small></td>
          <td>{r.customerEmail}</td>
          <td className="rt-item">{r.itemName}<small>{r.kind === "game_key" ? "Digital key" : "Hardware"}</small></td>
          <td className="num">{r.quantity}</td>
          <td>{reasonLabel(r.reason)}</td>
          <td><span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
          <td><button type="button" className="btn btn-outline btn-sm" aria-expanded={open === r.id} aria-controls={`rt-${r.id}`} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Close" : "Open"}<span className="sr-only"> return {r.number}</span></button></td>
        </tr>
        {open === r.id && <tr className="rt-row" id={`rt-${r.id}`}><td colSpan={8}><Detail key={r.updatedAt} r={r} onSaved={load} /></td></tr>}
      </Fragment>)}</tbody>
    </table></div>}
  </>;
}

export default function Page() { return <AdminShell title="Returns"><Returns /></AdminShell>; }
