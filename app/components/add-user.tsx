"use client";

import Link from "next/link";
import { useState } from "react";
import { adminApi } from "@/lib/client/api";
import { ROLES, type Role } from "@/lib/users";
import { isAdminRole } from "@/lib/admin-perms";
import { useAdminMe } from "./admin-shell";
import { DemoInbox, Notice } from "./auth-ui";
import { PermChecks } from "./perm-checks";

// S7: Add user (name, email, role) → account without password + set-password email (demo: the link is shown here).
// T2: admin roles only for the master admin; a new admin gets the ticked sections (none by default).
export function AddUser({ onClose, adminOnly }: { onClose: (created: boolean) => void; adminOnly?: boolean }) {
  const me = useAdminMe(); const roles = ROLES.filter((r) => (adminOnly ? isAdminRole(r.id) : me.master || !isAdminRole(r.id)));
  const [f, setF] = useState<{ name: string; email: string; role: Role; perms: string[] }>({ name: "", email: "", role: adminOnly ? "admin" : "customer", perms: [] });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState<{ id: string; email: string; link?: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(""); const r = await adminApi.addUser({ name: f.name, email: f.email, role: f.role, ...(f.role === "admin" ? { perms: f.perms } : {}) }); setBusy(false);
    if (r.ok) setDone({ id: r.id, email: f.email.trim().toLowerCase(), link: r.demoLink }); else setError(r.error);
  };
  if (done) return <section className="adm-panel" aria-label="User added">
    <Notice tone="success">Account created for {done.email}. We sent an email with a link to set a password; the email counts as verified once they use it.</Notice>
    <DemoInbox link={done.link} label="Open set-password link" />
    <div className="adm-add-actions"><Link className="btn btn-outline btn-sm" href={`/admin/user?id=${encodeURIComponent(done.id)}`}>Open user</Link><button type="button" className="btn btn-outline btn-sm" onClick={() => onClose(true)}>Close</button></div>
  </section>;
  return <form className="adm-panel adm-add" onSubmit={submit} noValidate aria-label={adminOnly ? "Add admin" : "Add user"}>
    <h2>{adminOnly ? "Add admin" : "Add user"}</h2>
    <div className="adm-add-fields">
      <label className="field"><span>Name</span><input name="name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="field"><span>Email</span><input name="email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label className="field"><span>Role</span><select name="role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    </div>
    {f.role === "admin" && <><p className="adm-add-warn">Admins see only the sections you tick. Only add people you trust.</p><PermChecks value={f.perms} onChange={(perms) => setF({ ...f, perms })} /></>}
    {f.role === "master_admin" && <p className="adm-add-warn">A master admin has every section and can add, change or remove admins. Only for the owner.</p>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-add-actions"><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Adding…" : adminOnly ? "Add admin" : "Add user"}</button><button type="button" className="btn btn-outline btn-sm" onClick={() => onClose(false)}>Cancel</button></div>
  </form>;
}
