"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import type { AdminStats } from "@/lib/client/types";
import type { FreezeNotice } from "@/lib/sellers";
import { AdminShell, MethodBadge, UserTable, dateTime, methodLabel } from "../components/admin-shell";
import { Notice, readQuery } from "../components/auth-ui";

// Last 30 days, oldest first, missing days = 0. Day keys are Bangkok dates (YYYY-MM-DD).
function fillDays(daily: AdminStats["daily"]) {
  const map = new Map(daily.map((d) => [d.day, d.count]));
  const today = new Date(Date.now() + 7 * 3600_000);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today.getTime() - (29 - i) * 86400_000).toISOString().slice(0, 10);
    return { day: d, count: map.get(d) ?? 0 };
  });
}

function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null); const [error, setError] = useState(""); const [verified, setVerified] = useState(false);
  useEffect(() => { setVerified(readQuery("verified") === "1"); adminApi.stats().then(r => r.ok ? setStats(r.stats) : setError(r.error)); }, []);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!stats) return <p className="muted-note">Loading…</p>;
  const pct = (n: number) => stats.total ? Math.round((n / stats.total) * 100) : 0;
  const days = fillDays(stats.daily); const peak = Math.max(1, ...days.map(d => d.count));
  const tiles = [
    { label: "Total users", value: stats.total, note: `${stats.admins} admin${stats.admins === 1 ? "" : "s"}` },
    { label: "New today", value: stats.new1, note: "Last 24 hours" },
    { label: "New 7 days", value: stats.new7, note: `${stats.new30} in 30 days` },
    { label: "Verified email", value: `${pct(stats.verified)}%`, note: `${stats.verified} of ${stats.total}` },
    { label: "Active 7 days", value: stats.active7, note: `${stats.logins7} sign-ins` },
    { label: "Marketing opt-in", value: stats.marketing, note: `${pct(stats.marketing)}% of users` },
    ...(stats.owed ? [{ label: "Balance owed", value: money(stats.owed.walletMinor + stats.owed.giftMinor, "THB"), note: `Wallet ${money(stats.owed.walletMinor, "THB")} · Gift ${money(stats.owed.giftMinor, "THB")}` }] : []), // T2: Wallet section only
  ];
  return <>
    {verified && <Notice tone="success">Email verified. Admin access is active.</Notice>}
    <FreezeNotices />
    <div className="acct-tiles adm-tiles">{tiles.map(t => <div className="acct-tile" key={t.label}><span>{t.label}</span><strong>{t.value}</strong><small>{t.note}</small></div>)}</div>
    <div className="adm-grid">
      <section className="adm-panel"><h2>Sign-ups, last 30 days</h2>
        <div className="adm-chart" role="img" aria-label={`Daily sign-ups for the last 30 days, peak ${peak}`}>{days.map(d => <div key={d.day} className="adm-bar" title={`${d.day}: ${d.count}`}><i style={{ height: `${(d.count / peak) * 100}%` }} /></div>)}</div>
        <div className="adm-axis"><span>{days[0].day}</span><span>Today</span></div>
      </section>
      <section className="adm-panel"><h2>Sign-in methods</h2>
        {stats.methods.length === 0 ? <p className="muted-note">No users yet.</p> : <ul className="adm-methods">{stats.methods.map(m => <li key={m.method}><div><MethodBadge method={m.method} /><b>{m.users}</b><small>{pct(m.users)}%</small></div><span><i style={{ width: `${pct(m.users)}%` }} /></span></li>)}</ul>}
        <p className="muted-note">Users with both {methodLabel("credential")} and {methodLabel("google")} count in each.</p>
      </section>
    </div>
    {stats.recent && <><div className="section-title acct-sub"><h2>Newest registrations</h2><Link href="/admin/users">All users →</Link></div>
    <UserTable users={stats.recent} /></>}
    <p className="muted-note">Times shown in Bangkok time ({stats.timezone}). Updated {dateTime(new Date().toISOString())}.</p>
  </>;
}

// Sales freezes that ended by themselves (screen 14). Only admins with the Seller applications section get them (others: nothing shown).
function FreezeNotices() {
  const [list, setList] = useState<FreezeNotice[]>([]);
  useEffect(() => { adminApi.sellerNotices().then((r) => r.ok && setList(r.notices)); }, []);
  const dismiss = async (id: string) => { const r = await adminApi.dismissSellerNotice(id); if (r.ok) setList((l) => l.filter((n) => n.id !== id)); };
  return <>{list.map((n) => <div key={n.id} className="adm-freeze-notice" role="status"><span>✓ Sales freeze ended for <b>{n.merchantName}</b> ({n.number}) on {dateTime(n.releasedAt)}. Sales are released.</span>
    <Link className="text-link" href={`/admin/seller?id=${encodeURIComponent(n.id)}`}>Open</Link><button type="button" className="as-link text-link" onClick={() => dismiss(n.id)}>Dismiss<span className="sr-only"> notice for {n.number}</span></button></div>)}</>;
}

export default function AdminPage() {
  return <AdminShell title="Overview"><Overview /></AdminShell>;
}
