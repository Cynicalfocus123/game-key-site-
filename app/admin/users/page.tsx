"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import type { AdminUserPage, AdminUserQuery } from "@/lib/client/types";
import { AdminShell, UserTable } from "../../components/admin-shell";
import { AddUser } from "../../components/add-user";
import { Notice } from "../../components/auth-ui";

const selects: { key: keyof AdminUserQuery; label: string; options: [string, string][] }[] = [
  { key: "method", label: "Method", options: [["", "All methods"], ["credential", "Email"], ["google", "Google"]] },
  { key: "verified", label: "Email", options: [["", "All"], ["yes", "Verified"], ["no", "Not verified"]] },
  { key: "role", label: "Role", options: [["", "All roles"], ["customer", "Customer"], ["seller", "Seller"], ["admin", "Admin"], ["master_admin", "Master admin"]] },
  { key: "sort", label: "Sort", options: [["", "Newest first"], ["oldest", "Oldest first"], ["login", "Last sign-in"], ["balance", "Balance (highest)"]] },
];

function Users() {
  const [query, setQuery] = useState<AdminUserQuery>({ page: 1, status: "active" }); const [search, setSearch] = useState("");
  const [data, setData] = useState<AdminUserPage | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const load = useCallback(async (q: AdminUserQuery) => {
    setLoading(true); setError("");
    const r = await adminApi.users(q); setLoading(false);
    if (r.ok) setData(r.data); else setError(r.error);
  }, []);
  useEffect(() => { load(query); }, [query, load]);
  const update = (patch: AdminUserQuery) => setQuery(q => ({ ...q, ...patch, page: patch.page ?? 1 }));
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const [adding, setAdding] = useState(false); const status = query.status ?? "active";
  return <>
    {/* T3: closed accounts are never deleted; they live under Closed. */}
    <div className="dash-tabs adm-tabs" role="tablist" aria-label="Account status">{(["active", "closed"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={status === t} onClick={() => update({ status: t })}>{t === "active" ? "Active" : "Closed"}</button>)}</div>
    <div className="adm-head adm-head-actions"><span>Users register themselves, or you add them here.</span>{!adding && <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>Add user</button>}</div>
    {adding && <AddUser onClose={(created) => { setAdding(false); if (created) load(query); }} />}
    <form className="adm-filters" onSubmit={e => { e.preventDefault(); update({ q: search }); }}>
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Name or email" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {selects.map(s => <label className="field" key={s.key}><span>{s.label}</span><select value={String(query[s.key] ?? "")} onChange={e => update({ [s.key]: e.target.value || undefined })}>{s.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>)}
      <button className="btn btn-outline">Search</button>
    </form>
    {error && <Notice tone="error">{error}</Notice>}
    {data === null ? <p className="muted-note">Loading…</p> : <>
      <p className="adm-count" aria-live="polite">{loading ? "Loading…" : `${from}–${to} of ${data.total} user${data.total === 1 ? "" : "s"}`}</p>
      <UserTable users={data.users} />
      <div className="adm-pager">
        <button className="btn btn-outline" disabled={data.page <= 1 || loading} onClick={() => update({ page: data.page - 1 })}>← Previous</button>
        <button className="btn btn-outline" disabled={to >= data.total || loading} onClick={() => update({ page: data.page + 1 })}>Next →</button>
      </div>
    </>}
  </>;
}

export default function AdminUsersPage() {
  return <AdminShell title="Users"><Users /></AdminShell>;
}
