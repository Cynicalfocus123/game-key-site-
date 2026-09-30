"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { adminApi, api, money } from "@/lib/client/api";
import { pagePerm } from "@/lib/admin-perms";
import { roleLabel } from "@/lib/users";
import type { AdminMe, AdminUserRow, SessionUser } from "@/lib/client/types";
import { useAuth } from "./auth-provider";
import { DemoBanner } from "./auth-ui";

// T2: each link shows only when the admin has its section (pagePerm); "Admins" = master admin only.
const links = [{ href: "/admin", label: "Overview" }, { href: "/admin/admins", label: "Admins" }, { href: "/admin/users", label: "Users" }, { href: "/admin/topups", label: "Top-ups" }, { href: "/admin/products", label: "Products" }, { href: "/admin/purchase-popup", label: "Purchase popup" }, { href: "/admin/currencies", label: "Currencies" }, { href: "/admin/gift-cards", label: "Gift cards" }, { href: "/admin/promo-codes", label: "Promo codes" }, { href: "/admin/returns", label: "Returns" }, { href: "/admin/tickets", label: "Tickets" }, { href: "/admin/filters", label: "Filters" }, { href: "/admin/categories", label: "Menu & categories" }, { href: "/admin/sellers", label: "Seller applications" }, { href: "/admin/emails", label: "Emails" }];

function AdminTop({ user, onSignOut }: { user?: SessionUser | null; onSignOut?: () => void }) {
  return <header className="adm-top"><Link className="logo" href="/admin">core<span>cart</span><em>admin</em></Link><div>{user && <span className="adm-who">{user.email}</span>}<Link href="/">View store</Link>{onSignOut && <button onClick={onSignOut}>Sign out</button>}</div></header>;
}

// Login / register pages: admin top bar, no storefront header.
export function AdminAuthShell({ children }: { children: React.ReactNode }) {
  return <><AdminTop /><main className="auth-main adm-auth"><DemoBanner />{children}</main></>;
}

// T2: what the signed-in admin may open (from /api/admin/me). Pages use it to hide controls they cannot use (the API checks again).
const AdminMeContext = createContext<AdminMe>({ master: false, perms: [] });
export const useAdminMe = () => useContext(AdminMeContext);
export const canOpen = (me: AdminMe, href: string) => { const need = pagePerm(href); return need === null || (need === "master" ? me.master : me.master || me.perms.includes(need)); };

// Guarded admin layout. Access is decided by the server (/api/admin/me); the UI guard only avoids showing empty pages.
export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { user, refresh } = useAuth(); const router = useRouter(); const path = usePathname();
  // checking → yes / no (server says not an admin) / error (server did not answer: never shown as "No admin access").
  const [admin, setAdmin] = useState<"checking" | AdminMe | "no" | "error">("checking"); const leaving = useRef(false);
  const check = useCallback(() => { setAdmin("checking"); adminApi.me().then((a) => setAdmin(a === null ? "error" : a ? a : "no")); }, []);
  useEffect(() => {
    if (user === null && !leaving.current) router.replace(`/admin/login?next=${encodeURIComponent(path)}`);
    if (user) check();
  }, [user, router, path, check]);
  const signOut = async () => { leaving.current = true; await api.signOut(); router.replace("/admin/login"); await refresh(); };
  const clean = path.replace(/\/$/, "") || "/";
  if (!user || admin === "checking") return <><AdminTop /><main className="adm-main"><p className="muted-note">Checking admin access…</p></main></>;
  if (admin === "error") return <><AdminTop user={user} onSignOut={signOut} /><main className="auth-main adm-auth"><section className="auth-card"><h1>Could not check admin access</h1><p className="auth-sub">The server did not answer. It may still be starting, or it stopped. Check that the backend window is open, then try again.</p><button className="btn btn-primary" onClick={check}>Try again</button></section></main></>;
  if (admin === "no") return <><AdminTop user={user} onSignOut={signOut} /><main className="auth-main adm-auth"><section className="auth-card"><h1>No admin access</h1><p className="auth-sub">{user.email} is signed in but is not an admin. Admin access needs a verified email that the site owner approved.</p><button className="btn btn-primary" onClick={signOut}>Sign in with another account</button></section></main></>;
  const me = admin; const shown = links.filter((l) => canOpen(me, l.href)); const allowed = canOpen(me, clean);
  return <AdminMeContext.Provider value={me}><AdminTop user={user} onSignOut={signOut} /><main className="adm-main"><DemoBanner />
    <div className="acct-layout">
      {/* Phones (step 5): one "Admin section" select instead of the full link list above the page. */}
      <div className="acct-picker adm-picker"><label htmlFor="adm-section">Admin section</label>
        <select id="adm-section" value={shown.find((l) => (l.href === "/admin" ? clean === "/admin" : clean === l.href || clean.startsWith(`${l.href}/`)))?.href ?? (clean.startsWith("/admin/user") ? "/admin/users" : clean.startsWith("/admin/ticket") ? "/admin/tickets" : clean.startsWith("/admin/topup") ? "/admin/topups" : clean.startsWith("/admin/seller") ? "/admin/sellers" : "")} onChange={(e) => router.push(e.target.value)}>
          {!allowed && <option value="">No access</option>}
          {shown.map((l) => <option key={l.href} value={l.href}>{l.label}</option>)}
        </select>
      </div>
      <nav className="acct-nav adm-nav" aria-label="Admin navigation">{shown.map(l => <Link key={l.href} href={l.href} aria-current={(l.href === "/admin" ? clean === "/admin" : clean === l.href || clean.startsWith(`${l.href}/`)) ? "page" : undefined}>{l.label}</Link>)}<span className="adm-soon">Orders & payments <small>next step</small></span></nav>
      <section className="acct-content"><h1>{title}</h1>{allowed ? children : <NoAccess master={pagePerm(clean) === "master"} />}</section>
    </div>
  </main></AdminMeContext.Provider>;
}

// T2: page opened without its section (direct link, bookmark). The API refuses the data too (403).
function NoAccess({ master }: { master: boolean }) {
  return <div className="adm-panel adm-noaccess" role="alert"><h2>No access</h2><p>{master ? "Only the master admin can manage admins." : "Your admin account does not have this section. Ask the master admin to turn it on."}</p><Link className="btn btn-outline btn-sm" href="/admin">Go to Overview</Link></div>;
}

export const methodLabel = (m: string) => ({ credential: "Email", email: "Email", google: "Google", "email-verify": "Email link" } as Record<string, string>)[m] ?? m;
export const MethodBadge = ({ method }: { method: string }) => <span className={`badge badge-method badge-${method}`}>{methodLabel(method)}</span>;
export const dateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export function device(ua: string | null) {
  if (!ua) return "—";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  return `${browser} · ${os}`;
}

export function UserTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  if (!users.length) return <p className="empty">No users match.</p>;
  return <div className="adm-table-wrap"><table className="adm-table">
    <thead><tr><th>User</th><th>Method</th><th>Email</th><th>Role</th><th>Registered</th><th>Last sign-in</th><th className="num">Sign-ins</th><th className="num">Balance</th></tr></thead>
    <tbody>{users.map(u => <tr key={u.id} onClick={() => router.push(`/admin/user?id=${encodeURIComponent(u.id)}`)}>
      <td><Link href={`/admin/user?id=${encodeURIComponent(u.id)}`} onClick={e => e.stopPropagation()}><strong>{u.name}</strong></Link><small>{u.email}</small>{u.status === "closed" && <small className="chip chip-grey">Closed</small>}{u.returning && <small className="adm-flag" title="This email belonged to a closed account">⚠ Returning person</small>}</td>
      <td>{u.methods.length ? u.methods.map(m => <MethodBadge key={m} method={m} />) : "—"}</td>
      <td><span className={u.emailVerified ? "adm-ok" : "adm-warn"}>{u.emailVerified ? "Verified" : "Not verified"}</span></td>
      <td>{u.role === "admin" || u.role === "master_admin" ? <span className="badge badge-admin">{roleLabel(u.role).toLowerCase()}</span> : u.role}</td>
      <td>{dateTime(u.createdAt)}</td>
      <td>{dateTime(u.lastLogin)}</td>
      <td className="num">{u.loginCount}</td>
      <td className="num">{u.balanceMinor ? money(u.balanceMinor, "THB") : "—"}</td>
    </tr>)}</tbody>
  </table></div>;
}
