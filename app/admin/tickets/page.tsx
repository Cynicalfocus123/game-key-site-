"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { CATEGORIES, orderShown, TICKET_STATUS, ticketNo, type Ticket, type TicketCategory, type TicketStatus } from "@/lib/tickets";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Admin tickets (Handoff v8 C11 + v15 task 3 fields): search, status, subject; # · customer · subject · order number · status · last reply. Row opens /admin/ticket?id=.
const STATUSES = Object.keys(TICKET_STATUS) as TicketStatus[];
const href = (t: Ticket) => `/admin/ticket?id=${encodeURIComponent(t.id)}`;

function Tickets() {
  const router = useRouter();
  const [list, setList] = useState<Ticket[] | null>(null); const [error, setError] = useState("");
  const [q, setQ] = useState(""); const [status, setStatus] = useState<"" | TicketStatus>(""); const [category, setCategory] = useState<"" | TicketCategory>("");
  useEffect(() => { adminApi.tickets().then((r) => (r.ok ? setList(r.tickets) : setError(r.error))); }, []);
  const query = q.trim().toLowerCase().replace(/^#/, "");
  const rows = (list ?? []).filter((t) => (!status || t.status === status) && (!category || t.category === category)
    && (!query || [String(t.number), t.subject, t.customerEmail ?? "", t.customerName ?? "", orderShown(t) ?? ""].some((x) => x.toLowerCase().includes(query))));
  const count = (s: TicketStatus) => (list ?? []).filter((t) => t.status === s).length;
  return <>
    <p className="muted-note">Open = waiting for support. Your reply sets Answered and emails the customer; a customer reply sets Open again.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="#, customer or order number" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label className="field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value as "" | TicketStatus)}>
        <option value="">All ({list?.length ?? 0})</option>{STATUSES.map((s) => <option key={s} value={s}>{TICKET_STATUS[s].label} ({count(s)})</option>)}</select></label>
      <label className="field"><span>Subject</span><select value={category} onChange={(e) => setCategory(e.target.value as "" | TicketCategory)}>
        <option value="">All subjects</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    </div>
    {!list ? !error && <p className="muted-note">Loading…</p> : !rows.length ? <p className="empty">{list.length ? "No tickets match." : "No tickets yet."}</p> : <div className="adm-table-wrap"><table className="adm-table tk-admin-table">
      <thead><tr><th>#</th><th>Customer</th><th>Subject</th><th>Order number</th><th>Status</th><th>Last reply</th></tr></thead>
      <tbody>{rows.map((t) => <tr key={t.id} onClick={() => router.push(href(t))} className={t.status === "open" ? "tk-waiting" : ""}>
        <td><Link href={href(t)} onClick={(e) => e.stopPropagation()}><strong>{ticketNo(t.number)}</strong><span className="sr-only"> {t.subject}</span></Link></td>
        <td>{t.customerName || "—"}<small>{t.customerEmail}</small></td>
        <td>{t.subject}</td>
        <td>{orderShown(t) ? <code>{orderShown(t)}</code> : "—"}</td>
        <td><span className={`chip ${TICKET_STATUS[t.status].chip}`}>{TICKET_STATUS[t.status].label}</span></td>
        <td>{dateTime(t.lastReplyAt)}<small>{t.lastReplyBy === "support" ? "Support" : "Customer"}</small></td>
      </tr>)}</tbody>
    </table></div>}
  </>;
}

export default function Page() { return <AdminShell title="Tickets"><Tickets /></AdminShell>; }
