"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { ROLES, type Role } from "@/lib/users";
import type { AdminUserPage, AdminUserQuery } from "@/lib/client/types";
import { AdminShell, UserTable } from "../../components/admin-shell";
import { DemoInbox, Notice } from "../../components/auth-ui";

const selects: { key: keyof AdminUserQuery; label: string; options: [string, string][] }[] = [
  { key: "method", label: "Method", options: [["", "All methods"], ["credential", "Email"], ["google", "Google"]] },
  { key: "verified", label: "Email", options: [["", "All"], ["yes", "Verified"], ["no", "Not verified"]] },
  { key: "role", label: "Role", options: [["", "All roles"], ["customer", "Customer"], ["seller", "Seller"], ["admin", "Admin"]] },
  { key: "sort", label: "Sort", options: [["", "Newest first"], ["oldest", "Oldest first"], ["login", "Last sign-in"], ["balance", "Balance (highest)"]] },
];

function Users() {
  const [query, setQuery] = useState<AdminUserQuery>({ page: 1 }); const [search, setSearch] = useState("");
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
  const [adding, setAdding] = useState(false);
  return <>
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

// S7: Add user (name, email, role) → account without password + set-password email (demo: the link is shown here).
function AddUser({ onClose }: { onClose: (created: boolean) => void }) {
  const [f, setF] = useState<{ name: string; email: string; role: Role }>({ name: "", email: "", role: "customer" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState<{ id: string; email: string; link?: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(""); const r = await adminApi.addUser(f); setBusy(false);
    if (r.ok) setDone({ id: r.id, email: f.email.trim().toLowerCase(), link: r.demoLink }); else setError(r.error);
  };
  if (done) return <section className="adm-panel" aria-label="User added">
    <Notice tone="success">Account created for {done.email}. We sent an email with a link to set a password; the email counts as verified once they use it.</Notice>
    <DemoInbox link={done.link} label="Open set-password link" />
    <div className="adm-add-actions"><Link className="btn btn-outline btn-sm" href={`/admin/user?id=${encodeURIComponent(done.id)}`}>Open user</Link><button type="button" className="btn btn-outline btn-sm" onClick={() => onClose(true)}>Close</button></div>
  </section>;
  return <form className="adm-panel adm-add" onSubmit={submit} noValidate aria-label="Add user">
    <h2>Add user</h2>
    <div className="adm-add-fields">
      <label className="field"><span>Name</span><input name="name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field"><span>Email</span><input name="email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label className="field"><span>Role</span><select name="role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    </div>
    {f.role === "admin" && <p className="adm-add-warn">Admins can see every customer and change balances. Only add people you trust.</p>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-add-actions"><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Adding…" : "Add user"}</button><button type="button" className="btn btn-outline btn-sm" onClick={() => onClose(false)}>Cancel</button></div>
  </form>;
}

export default function AdminUsersPage() {
  return <AdminShell title="Users"><Users /></AdminShell>;
}
