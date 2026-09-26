"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminApi, api } from "@/lib/client/api";
import type { AdminUserRow, SessionUser } from "@/lib/client/types";
import { useAuth } from "./auth-provider";
import { DemoBanner } from "./auth-ui";

const links = [{ href: "/admin", label: "Overview" }, { href: "/admin/users", label: "Users" }, { href: "/admin/currencies", label: "Currencies" }];

function AdminTop({ user, onSignOut }: { user?: SessionUser | null; onSignOut?: () => void }) {
  return <header className="adm-top"><Link className="logo" href="/admin">core<span>cart</span><em>admin</em></Link><div>{user && <span className="adm-who">{user.email}</span>}<Link href="/">View store</Link>{onSignOut && <button onClick={onSignOut}>Sign out</button>}</div></header>;
}

// Login / register pages: admin top bar, no storefront header.
export function AdminAuthShell({ children }: { children: React.ReactNode }) {
  return <><AdminTop /><main className="auth-main adm-auth"><DemoBanner />{children}</main></>;
}

// Guarded admin layout. Access is decided by the server (/api/admin/me); the UI guard only avoids showing empty pages.
export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { user, refresh } = useAuth(); const router = useRouter(); const path = usePathname();
  const [admin, setAdmin] = useState<boolean | null>(null); const leaving = useRef(false);
  useEffect(() => {
    if (user === null && !leaving.current) router.replace(`/admin/login?next=${encodeURIComponent(path)}`);
    if (user) adminApi.me().then(setAdmin);
  }, [user, router, path]);
  const signOut = async () => { leaving.current = true; await api.signOut(); router.replace("/admin/login"); await refresh(); };
  const clean = path.replace(/\/$/, "") || "/";
  if (!user || admin === null) return <><AdminTop /><main className="adm-main"><p className="muted-note">Checking admin access…</p></main></>;
  if (!admin) return <><AdminTop user={user} onSignOut={signOut} /><main className="auth-main adm-auth"><section className="auth-card"><h1>No admin access</h1><p className="auth-sub">{user.email} is signed in but is not an admin. Admin access needs a verified email that the site owner approved.</p><button className="btn btn-primary" onClick={signOut}>Sign in with another account</button></section></main></>;
  return <><AdminTop user={user} onSignOut={signOut} /><main className="adm-main"><DemoBanner />
    <div className="acct-layout">
      <nav className="acct-nav adm-nav" aria-label="Admin navigation">{links.map(l => <Link key={l.href} href={l.href} aria-current={clean.endsWith(l.href) && (l.href !== "/admin" || clean.endsWith("/admin")) ? "page" : undefined}>{l.label}</Link>)}<span className="adm-soon">Orders & payments <small>next step</small></span><span className="adm-soon">Products <small>later</small></span></nav>
      <section className="acct-content"><h1>{title}</h1>{children}</section>
    </div>
  </main></>;
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
    <thead><tr><th>User</th><th>Method</th><th>Email</th><th>Role</th><th>Registered</th><th>Last sign-in</th><th className="num">Sign-ins</th></tr></thead>
    <tbody>{users.map(u => <tr key={u.id} onClick={() => router.push(`/admin/user?id=${encodeURIComponent(u.id)}`)}>
      <td><Link href={`/admin/user?id=${encodeURIComponent(u.id)}`} onClick={e => e.stopPropagation()}><strong>{u.name}</strong></Link><small>{u.email}</small></td>
      <td>{u.methods.length ? u.methods.map(m => <MethodBadge key={m} method={m} />) : "—"}</td>
      <td><span className={u.emailVerified ? "adm-ok" : "adm-warn"}>{u.emailVerified ? "Verified" : "Not verified"}</span></td>
      <td>{u.role === "admin" ? <span className="badge badge-admin">admin</span> : u.role}</td>
      <td>{dateTime(u.createdAt)}</td>
      <td>{dateTime(u.lastLogin)}</td>
      <td className="num">{u.loginCount}</td>
    </tr>)}</tbody>
  </table></div>;
}
