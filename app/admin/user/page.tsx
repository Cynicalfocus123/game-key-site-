"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import type { AdminUserDetail } from "@/lib/client/types";
import { AdminShell, MethodBadge, dateTime, device } from "../../components/admin-shell";
import { Notice, readQuery } from "../../components/auth-ui";

// Static export cannot pre-render one page per user, so the user id comes from ?id=.
function Detail() {
  const [data, setData] = useState<AdminUserDetail | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    const id = readQuery("id");
    if (!id) { setError("Missing user id."); return; }
    adminApi.user(id).then(r => r.ok ? setData(r.data) : setError(r.error));
  }, []);
  if (error) return <><Notice tone="error">{error}</Notice><Link className="text-link" href="/admin/users">← Back to users</Link></>;
  if (!data) return <p className="muted-note">Loading…</p>;
  const { user: u } = data;
  return <>
    <p className="adm-back"><Link className="text-link" href="/admin/users">← All users</Link></p>
    <div className="adm-head"><h2>{u.name}</h2><span>{u.email}</span></div>
    <div className="acct-tiles">
      <div className="acct-tile"><span>Registered</span><strong>{dateTime(u.createdAt)}</strong><small>Terms accepted {dateTime(u.termsAcceptedAt)}</small></div>
      <div className="acct-tile"><span>Email</span><strong className={u.emailVerified ? "ok" : "warn"}>{u.emailVerified ? "Verified" : "Not verified"}</strong><small>Marketing: {u.marketingOptIn ? "yes" : "no"}</small></div>
      <div className="acct-tile"><span>Role</span><strong>{u.role}</strong><small>Updated {dateTime(u.updatedAt)}</small></div>
      <div className="acct-tile"><span>Orders</span><strong>{data.orders.count}</strong><small>{money(data.orders.totalCents)} total</small></div>
    </div>
    <section className="adm-panel"><h2>Sign-in methods</h2>
      <ul className="adm-list">{data.accounts.length ? data.accounts.map(a => <li key={a.method}><MethodBadge method={a.method} /><span>Linked {dateTime(a.createdAt)}</span></li>) : <li>None</li>}</ul>
    </section>
    <section className="adm-panel"><h2>Active sessions ({data.sessions.length})</h2>
      {data.sessions.length === 0 ? <p className="muted-note">Not signed in on any device.</p> :
        <div className="adm-table-wrap"><table className="adm-table static"><thead><tr><th>Started</th><th>Expires</th><th>IP address</th><th>Device</th></tr></thead>
          <tbody>{data.sessions.map((s, i) => <tr key={i}><td>{dateTime(s.createdAt)}</td><td>{dateTime(s.expiresAt)}</td><td>{s.ipAddress || "—"}</td><td title={s.userAgent ?? ""}>{device(s.userAgent)}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="adm-panel"><h2>Sign-in history (last 50)</h2>
      {data.logins.length === 0 ? <p className="muted-note">No sign-ins recorded yet.</p> :
        <div className="adm-table-wrap"><table className="adm-table static"><thead><tr><th>Time</th><th>Method</th><th>IP address</th><th>Device</th></tr></thead>
          <tbody>{data.logins.map((l, i) => <tr key={i}><td>{dateTime(l.createdAt)}</td><td><MethodBadge method={l.method} /></td><td>{l.ipAddress || "—"}</td><td title={l.userAgent ?? ""}>{device(l.userAgent)}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

export default function AdminUserPage() {
  return <AdminShell title="User details"><Detail /></AdminShell>;
}
