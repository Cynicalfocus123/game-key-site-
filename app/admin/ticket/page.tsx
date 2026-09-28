"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { BODY_MAX, checkBody, orderShown, TICKET_STATUS, ticketNo, type TicketStatus, type TicketThread } from "@/lib/tickets";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice, readQuery } from "../../components/auth-ui";

// Admin ticket thread (Handoff v8 C11): messages + reply left; side panel status / customer / subject / order number / key (revealed time) right.
function Thread() {
  const [t, setT] = useState<TicketThread | null>(null); const [error, setError] = useState("");
  const [reply, setReply] = useState(""); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState(""); const [saved, setSaved] = useState("");
  const [id, setId] = useState<string | null>(null);
  useEffect(() => { const q = readQuery("id"); if (q) setId(q); else setError("Ticket not found"); }, []);
  const load = useCallback(() => { if (id) adminApi.ticket(id).then((r) => (r.ok ? setT(r.ticket) : setError(r.error))); }, [id]);
  useEffect(() => { load(); }, [load]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (!t) return; const err = checkBody(reply); if (err) { setFormError(err); return; }
    setBusy(true); setFormError(""); setSaved(""); const r = await adminApi.replyTicket(t.id, reply); setBusy(false);
    if (r.ok) { setReply(""); setSaved("Reply sent. The customer gets an email."); load(); } else setFormError(r.error);
  };
  const setStatus = async (s: TicketStatus) => { if (!t) return; setSaved(""); setFormError(""); const r = await adminApi.setTicketStatus(t.id, s); if (r.ok) { setSaved(`Status: ${TICKET_STATUS[s].label}.`); load(); } else setFormError(r.error); };
  const back = <Link className="text-link tk-back" href="/admin/tickets">‹ All tickets</Link>;
  if (error) return <>{back}<Notice tone="error">{error}</Notice></>;
  if (!t) return <p className="muted-note">Loading…</p>;
  return <>
    {back}
    <div className="tk-head"><h2>{ticketNo(t.number)} {t.subject}</h2><span className={`chip ${TICKET_STATUS[t.status].chip}`}>{TICKET_STATUS[t.status].label}</span></div>
    <div className="tk-admin">
      <div className="tk-thread">
        <ol className="tk-messages">{t.messages.map((m) => <li key={m.id} className={m.fromSupport ? "tk-msg tk-support" : "tk-msg"}>
          <div className="tk-msg-head"><strong>{m.fromSupport ? "CoreCart support" : m.author || t.customerEmail}</strong><time dateTime={m.createdAt}>{dateTime(m.createdAt)}</time></div>
          <p>{m.body}</p>
        </li>)}</ol>
        <form className="tk-reply" onSubmit={send} noValidate>
          <label className="field"><span>Reply to customer</span><textarea name="reply" rows={5} maxLength={BODY_MAX} value={reply} onChange={(e) => setReply(e.target.value)} /></label>
          {formError && <Notice tone="error">{formError}</Notice>}
          {saved && <Notice tone="success">{saved}</Notice>}
          <div className="tk-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send reply"}</button></div>
        </form>
      </div>
      <aside className="tk-side adm-panel" aria-label="Ticket details">
        <label className="field"><span>Status</span><select value={t.status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>{(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => <option key={s} value={s}>{TICKET_STATUS[s].label}</option>)}</select></label>
        <dl>
          <div><dt>Customer</dt><dd>{t.customerName || "—"}<small>{t.customerEmail}</small></dd></div>
          <div><dt>Subject</dt><dd>{t.subject}</dd></div>
          <div><dt>Order number</dt><dd>{orderShown(t) ? <code>{orderShown(t)}</code> : "—"}{orderShown(t) && <small>{t.orderId ? "Matches this customer's order" : "Not found in this customer's orders"}</small>}</dd></div>
          {t.keyId && <div><dt>Key</dt><dd>{t.keyName}<small>{t.keyRevealedAt ? `Revealed ${dateTime(t.keyRevealedAt)}` : "Not revealed"}</small></dd></div>}
          <div><dt>Opened</dt><dd>{dateTime(t.createdAt)}</dd></div>
          <div><dt>Last reply</dt><dd>{dateTime(t.lastReplyAt)}<small>{t.lastReplyBy === "support" ? "Support" : "Customer"}</small></dd></div>
        </dl>
      </aside>
    </div>
  </>;
}

export default function Page() { return <AdminShell title="Ticket"><Thread /></AdminShell>; }
