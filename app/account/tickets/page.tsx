"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { agoText, api, dateText } from "@/lib/client/api";
import type { Ticket, TicketThread } from "@/lib/client/types";
import { BODY_MAX, CATEGORIES, checkBody, checkNewTicket, cleanOrderRef, ORDER_REF_MAX, orderShown, TICKET_STATUS, ticketNo, type TicketCategory } from "@/lib/tickets";
import { AccountShell, TICKETS_EVENT } from "../../components/account-shell";
import { Notice } from "../../components/auth-ui";

// Tickets (Handoff v8 C9, C10; Handoff v15 task 3): list, New ticket (?new=1), thread (?id=). Views live in the query string (static export).
// New ticket prefill: &key={id} (key detail "Report a problem") → Order issue + that key's order number; &subject={category id}; &order={order number}.
type View = { kind: "list" } | { kind: "new"; key: string | null; subject: string | null; order: string | null } | { kind: "thread"; id: string };
const readView = (): View => {
  const q = new URLSearchParams(window.location.search);
  if (q.get("id")) return { kind: "thread", id: q.get("id")! };
  if (q.get("new")) return { kind: "new", key: q.get("key"), subject: q.get("subject"), order: q.get("order") };
  return { kind: "list" };
};
const urlOf = (v: View) => v.kind === "thread" ? `?id=${encodeURIComponent(v.id)}` : v.kind === "new" ? "?new=1" : "";
const Chip = ({ t }: { t: Pick<Ticket, "status"> }) => <span className={`chip ${TICKET_STATUS[t.status].chip}`}>{TICKET_STATUS[t.status].label}</span>;

function List({ go }: { go: (v: View) => void }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { api.listTickets().then((r) => (r.ok ? setTickets(r.tickets) : setError(r.error))); }, []);
  return <>
    <div className="acct-actions"><button type="button" className="btn btn-primary" onClick={() => go({ kind: "new", key: null, subject: null, order: null })}>New ticket</button><small className="muted-note">We answer within one working day. Replies show here and by email.</small></div>
    {error && <Notice tone="error">{error}</Notice>}
    {!tickets ? !error && <p className="muted-note">Loading…</p> : !tickets.length ? <div className="empty"><p>No tickets yet.</p><p className="muted-note">Problem with an order or a key? Open a ticket and we will help.</p></div> :
      <table className="dash-table tickets-table">
        <thead><tr><th scope="col">#</th><th scope="col">Subject</th><th scope="col">Order number</th><th scope="col">Status</th><th scope="col">Last reply</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{tickets.map((t) => <tr key={t.id} className={t.customerUnread ? "is-unread" : ""}>
          <td data-label="#"><code>{ticketNo(t.number)}</code></td>
          <td data-label="Subject"><span className="tk-subject"><strong>{t.subject}</strong>{t.customerUnread && <small><b className="tk-new">New reply</b></small>}</span></td>
          <td data-label="Order number">{orderShown(t) ? <code>{orderShown(t)}</code> : "—"}</td>
          <td data-label="Status"><Chip t={t} /></td>
          <td data-label="Last reply"><span className="tk-last">{agoText(t.lastReplyAt)}<small>{t.lastReplyBy === "support" ? "Support" : "You"}</small></span></td>
          <td className="details-cell"><button type="button" className="text-link as-link" onClick={() => go({ kind: "thread", id: t.id })}>View <span aria-hidden="true">›</span><span className="sr-only"> ticket {ticketNo(t.number)}</span></button></td>
        </tr>)}</tbody>
      </table>}
  </>;
}

// 3 fields: Subject (select), Order number (required for Order issue + Return/refund), Description. keyId stays hidden (prefill only).
const isCategory = (c: string | null): c is TicketCategory => CATEGORIES.some((x) => x.id === c);
function NewTicket({ keyId, subject, order, go }: { keyId: string | null; subject: string | null; order: string | null; go: (v: View) => void }) {
  const [category, setCategory] = useState<TicketCategory | "">(keyId ? "order_issue" : isCategory(subject) ? subject : "");
  const [orderRef, setOrderRef] = useState(cleanOrderRef(order)); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (keyId) api.listKeys().then((k) => { const hit = k.ok && k.keys.find((x) => x.id === keyId); if (hit) setOrderRef((r) => r || hit.orderNumber); }); }, [keyId]);
  const needsOrder = CATEGORIES.find((c) => c.id === category)?.needsOrder ?? false;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { category: category as TicketCategory, orderRef, message, keyId };
    const err = checkNewTicket(input); if (err) { setError(err); return; }
    setBusy(true); setError(""); const r = await api.createTicket(input); setBusy(false);
    if (r.ok) go({ kind: "thread", id: r.id }); else setError(r.error);
  };
  return <form className="tk-form" onSubmit={submit} noValidate aria-label="New ticket">
    <button type="button" className="text-link as-link tk-back" onClick={() => go({ kind: "list" })}>‹ All tickets</button>
    <h2>New ticket</h2>
    <div className="tk-fields">
      <label className="field"><span>Subject</span><select name="subject" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}><option value="">Choose a subject</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label className="field"><span>Order number{needsOrder ? "" : " (optional)"}</span><input name="order" value={orderRef} maxLength={ORDER_REF_MAX} placeholder="e.g. CC-12345678" autoCapitalize="characters" spellCheck={false} onChange={(e) => setOrderRef(e.target.value)} onBlur={() => setOrderRef(cleanOrderRef)} /></label>
    </div>
    <p className="muted-note">Order numbers are on <Link className="text-link" href="/account/orders">Returns &amp; Orders</Link> and in your order email.</p>
    <label className="field"><span>Description</span><textarea name="message" rows={6} maxLength={BODY_MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened? For a key: where you entered it and the exact error." /></label>
    <p className="muted-note">No attachments yet. Never send passwords or card numbers.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="tk-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send"}</button><button type="button" className="btn btn-outline" onClick={() => go({ kind: "list" })}>Cancel</button></div>
  </form>;
}

function Thread({ id, go }: { id: string; go: (v: View) => void }) {
  const [t, setT] = useState<TicketThread | null>(null); const [error, setError] = useState(""); const [reply, setReply] = useState(""); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState("");
  const load = useCallback(() => api.getTicket(id).then((r) => { if (r.ok) { setT(r.ticket); window.dispatchEvent(new Event(TICKETS_EVENT)); } else setError(r.error); }), [id]);
  useEffect(() => { load(); }, [load]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const err = checkBody(reply); if (err) { setFormError(err); return; }
    setBusy(true); setFormError(""); const r = await api.replyTicket(id, reply); setBusy(false);
    if (r.ok) { setReply(""); load(); } else setFormError(r.error);
  };
  const close = async () => { setBusy(true); const r = await api.closeTicket(id); setBusy(false); if (r.ok) load(); else setFormError(r.error); };
  const back = <button type="button" className="text-link as-link tk-back" onClick={() => go({ kind: "list" })}>‹ All tickets</button>;
  if (error) return <>{back}<Notice tone="error">{error}</Notice></>;
  if (!t) return <p className="muted-note">Loading…</p>;
  return <div className="tk-thread">
    {back}
    <div className="tk-head"><h2>{ticketNo(t.number)} {t.subject}</h2><Chip t={t} /></div>
    <p className="tk-meta">{orderShown(t) && <>Order <code>{orderShown(t)}</code> · </>}{t.keyName && <>Key: <Link className="text-link" href={`/account/keys/view?id=${encodeURIComponent(t.keyId!)}`}>{t.keyName}</Link>{t.keyRevealedAt ? ` (revealed ${dateText(t.keyRevealedAt)})` : " (not revealed)"} · </>}Opened {dateText(t.createdAt)}</p>
    <ol className="tk-messages">{t.messages.map((m) => <li key={m.id} className={m.fromSupport ? "tk-msg tk-support" : "tk-msg"}>
      <div className="tk-msg-head"><strong>{m.fromSupport ? "CoreCart support" : "You"}</strong><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>
      <p>{m.body}</p>
    </li>)}</ol>
    {t.status === "closed" && <p className="muted-note">This ticket is closed. Replying opens it again.</p>}
    <form className="tk-reply" onSubmit={send} noValidate>
      <label className="field"><span>Your reply</span><textarea name="reply" rows={4} maxLength={BODY_MAX} value={reply} onChange={(e) => setReply(e.target.value)} /></label>
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="tk-actions"><button className="btn btn-primary" disabled={busy}>Reply</button>{t.status !== "closed" && <button type="button" className="btn btn-outline" onClick={close} disabled={busy}>Close ticket</button>}</div>
    </form>
  </div>;
}

export default function Page() {
  const [view, setView] = useState<View | null>(null);
  useEffect(() => { setView(readView()); const pop = () => setView(readView()); window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop); }, []);
  const go = (v: View) => { window.history.pushState(null, "", `${window.location.pathname}${urlOf(v)}`); setView(v); window.scrollTo(0, 0); };
  return <AccountShell title="Tickets">{() => !view ? null : view.kind === "thread" ? <Thread key={view.id} id={view.id} go={go} />
    : view.kind === "new" ? <NewTicket keyId={view.key} subject={view.subject} order={view.order} go={go} /> : <List go={go} />}</AccountShell>;
}
