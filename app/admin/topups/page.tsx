"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import type { AdminTopUpPage, AdminTopUpQuery } from "@/lib/client/types";
import { STATUS_CHIP, STATUS_LABEL, TOPUP_STATUSES } from "@/lib/topup";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Admin top-ups (future task T1): search (email / TU- number), status, provider, date range (Bangkok days), 50 per page. Row opens /admin/topup?id=.
// Read-only list: money is credited only by the provider webhook; admins can mark a pending top-up failed / cancelled on the detail page.
const PROVIDERS = ["dev", "demo", "stripe", "omise", "2c2p"];
const href = (id: string) => `/admin/topup?id=${encodeURIComponent(id)}`;

function TopUps() {
  const router = useRouter();
  const [q, setQ] = useState<AdminTopUpQuery>({ q: "", status: "", provider: "", from: "", to: "", page: 1 });
  const [data, setData] = useState<AdminTopUpPage | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => adminApi.topUps(q).then((r) => { if (r.ok) { setData(r.data); setError(""); } else setError(r.error); }), q.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);
  const set = (k: keyof AdminTopUpQuery) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setQ({ ...q, [k]: e.target.value, page: 1 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <>
    <p className="muted-note">Wallet top-ups. Only the payment provider&apos;s webhook credits a wallet; to correct a balance use Adjust balance on the user.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Email or TU- number" value={q.q} onChange={set("q")} /></label>
      <label className="field"><span>Status</span><select value={q.status} onChange={set("status")}><option value="">All statuses</option>{TOPUP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
      <label className="field"><span>Provider</span><select value={q.provider} onChange={set("provider")}><option value="">All providers</option>{PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
      <label className="field"><span>From</span><input type="date" value={q.from} onChange={set("from")} /></label>
      <label className="field"><span>To</span><input type="date" value={q.to} onChange={set("to")} /></label>
    </div>
    {!data ? !error && <p className="muted-note">Loading…</p> : !data.topUps.length ? <p className="empty">{data.total ? "No top-ups match." : "No top-ups yet."}</p> : <>
      <p className="muted-note adm-count">{data.total} top-up{data.total === 1 ? "" : "s"}</p>
      <div className="adm-table-wrap"><table className="adm-table tu-admin-table">
        <thead><tr><th>Number</th><th>Customer</th><th className="num">Charged</th><th className="num">Wallet credit</th><th>Status</th><th>Provider</th><th>Created</th></tr></thead>
        <tbody>{data.topUps.map((t) => <tr key={t.id} onClick={() => router.push(href(t.id))}>
          <td><Link href={href(t.id)} onClick={(e) => e.stopPropagation()}><strong>{t.number}</strong></Link></td>
          <td>{t.email}</td>
          <td className="num">{money(t.amountMinor, t.currency)} {t.currency}</td>
          <td className="num">{money(t.creditMinor, "THB")}</td>
          <td><span className={`chip ${STATUS_CHIP[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
          <td>{t.provider}</td>
          <td>{dateTime(t.createdAt)}</td>
        </tr>)}</tbody>
      </table></div>
      {pages > 1 && <div className="adm-pager"><button type="button" className="btn btn-outline btn-sm" disabled={data.page <= 1} onClick={() => setQ({ ...q, page: data.page - 1 })}>Previous</button>
        <span className="muted-note">Page {data.page} of {pages}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={data.page >= pages} onClick={() => setQ({ ...q, page: data.page + 1 })}>Next</button></div>}
    </>}
  </>;
}

export default function Page() { return <AdminShell title="Top-ups"><TopUps /></AdminShell>; }
