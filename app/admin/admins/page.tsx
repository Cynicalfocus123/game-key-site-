"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { auditText, roleLabel } from "@/lib/users";
import { isMasterRole, permsText } from "@/lib/admin-perms";
import type { AdminInfo, AdminList } from "@/lib/client/types";
import { useAuth } from "../../components/auth-provider";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";
import { PermChecks } from "../../components/perm-checks";
import { AddUser } from "../../components/add-user";

// T2 (master admin only; the shell shows "No access" to anyone else and the API answers 403):
// every admin with a checkbox per section (Select all / Clear all, Save), Add admin, Remove admin (→ customer), recent changes.
function Admins() {
  const [data, setData] = useState<AdminList | null>(null); const [error, setError] = useState(""); const [adding, setAdding] = useState(false);
  const load = useCallback(() => { adminApi.admins().then((r) => (r.ok ? setData(r.data) : setError(r.error))); }, []);
  useEffect(load, [load]);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="muted-note">Loading…</p>;
  return <>
    <div className="adm-head adm-head-actions"><span>Only a master admin can add, change or remove admins. Every change is saved in the history below.</span>{!adding && <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>Add admin</button>}</div>
    {adding && <AddUser adminOnly onClose={(created) => { setAdding(false); if (created) load(); }} />}
    {data.admins.map((a) => <AdminCard key={`${a.id}:${a.role}:${a.perms.join()}`} a={a} onSaved={load} />)}
    <section className="adm-panel" aria-labelledby="adm-hist-h"><h2 id="adm-hist-h">Recent admin changes</h2>
      {data.history.length === 0 ? <p className="muted-note">No changes yet.</p> :
        <ul className="adm-list adm-audit">{data.history.map((h, i) => <li key={i}><span>{dateTime(h.createdAt)}</span><span><strong>{h.email}</strong> · {auditText(h)}</span><span>{h.by ?? "Server command"}</span></li>)}</ul>}
    </section>
  </>;
}

function AdminCard({ a, onSaved }: { a: AdminInfo; onSaved: () => void }) {
  const { user } = useAuth(); const self = user?.id === a.id; const master = isMasterRole(a.role);
  const [perms, setPerms] = useState<string[]>(a.perms); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const [removing, setRemoving] = useState(false);
  const changed = permsText(perms) !== permsText(a.perms);
  const save = async () => {
    setBusy(true); setError(""); setSaved(""); const r = await adminApi.setAdminPerms(a.id, perms as AdminInfo["perms"]); setBusy(false);
    if (r.ok) { setSaved(`Saved: ${permsText(r.perms)}.`); onSaved(); } else setError(r.error);
  };
  const remove = async () => {
    setBusy(true); setError(""); const r = await adminApi.setUserRole(a.id, "customer"); setBusy(false); setRemoving(false);
    if (r.ok) onSaved(); else setError(r.error);
  };
  return <section className="adm-panel adm-admin" aria-label={`Admin ${a.email}`}>
    <div className="adm-admin-head">
      <div><h2>{a.name}{self && <small> (you)</small>}</h2><span>{a.email}</span>{!a.emailVerified && <span className="adm-warn"> · email not verified yet (no access until the set-password link is used)</span>}</div>
      <span className="badge badge-admin">{roleLabel(a.role).toLowerCase()}</span>
    </div>
    {master ? <p className="muted-note">Master admin: every section, always. {self ? "" : "To change this, open the user and change the role."}</p> : <>
      <PermChecks label={`Sections for ${a.name}`} value={perms} onChange={(p) => { setPerms(p); setSaved(""); }} disabled={busy} />
      <div className="adm-add-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={!changed || busy} onClick={save}>{busy ? "Saving…" : "Save sections"}</button>
        {changed && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setPerms(a.perms)}>Undo</button>}
      </div>
    </>}
    {error && <Notice tone="error">{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
    <div className="adm-add-actions">
      <Link className="btn btn-outline btn-sm" href={`/admin/user?id=${encodeURIComponent(a.id)}`}>Open user</Link>
      {!self && !removing && <button type="button" className="btn btn-outline btn-sm" onClick={() => setRemoving(true)}>Remove admin</button>}
    </div>
    {removing && <div className="wal-confirm" role="alertdialog" aria-label="Confirm remove admin">
      <p>Remove admin access from {a.email}? The account stays as a customer. They lose admin access at once.</p>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={remove}>{busy ? "Removing…" : "Remove admin"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setRemoving(false)}>Cancel</button></div>
    </div>}
  </section>;
}

export default function AdminAdminsPage() {
  return <AdminShell title="Admins"><Admins /></AdminShell>;
}
