"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/client/api";
import type { SessionUser } from "@/lib/client/types";
import { coverFor } from "@/lib/catalog";
import { initials } from "@/lib/profile";
import { useAuth } from "./auth-provider";
import { PageShell } from "./auth-ui";
import { assetPath } from "./cart-ui";

// Customer dashboard navigation (Handoff v8 C1). "My account" groups Overview + Login history.
type NavLink = { href: string; label: string; group?: string };
const links: NavLink[] = [
  { href: "/account", label: "Overview", group: "My account" },
  { href: "/account/login-history", label: "Login history", group: "My account" },
  { href: "/account/balance", label: "Balance" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/keys", label: "Keys library" },
  { href: "/account/tickets", label: "Tickets" },
  { href: "/account/payment-methods", label: "Payment methods" },
  { href: "/account/settings", label: "Settings" },
];
const isActive = (path: string, href: string) => path === href || (href !== "/account" && path.startsWith(`${href}/`));

export function Avatar({ user, size = 56 }: { user: Pick<SessionUser, "name" | "email" | "avatar">; size?: number }) {
  return <span className={`avatar avatar-${user.avatar ?? "none"}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">{initials(user.name, user.email)}</span>;
}

// Product cover for order/key rows; blank tile with the platform letter when the product has no image.
export function Cover({ name, platform, size = 56 }: { name: string; platform?: string | null; size?: number }) {
  const src = coverFor(name);
  return src ? <img className="thumb" src={assetPath(src)} alt="" width={size} height={Math.round(size * 4 / 3)} loading="lazy" />
    : <span className="thumb thumb-blank" style={{ width: size, height: Math.round(size * 4 / 3) }} aria-hidden="true">{(platform ?? name)[0]}</span>;
}

// `crumb` = page name in the breadcrumb (defaults to the title). `unread` = open ticket replies badge (tickets step).
export function AccountShell({ title, crumb, children, unread = 0 }: { title: string; crumb?: string; unread?: number; children: (user: SessionUser) => React.ReactNode }) {
  const { user, refresh } = useAuth(); const router = useRouter(); const path = usePathname();
  const leaving = useRef(false);
  useEffect(() => { if (user === null && !leaving.current) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [user, router, path]);
  const signOut = async () => { leaving.current = true; await api.signOut(); router.replace("/"); await refresh(); };
  const clean = path.replace(/\/$/, "") || "/";
  const active = links.find((l) => isActive(clean, l.href));
  const label = (l: NavLink) => <>{l.label}{l.href === "/account/tickets" && unread > 0 && <span className="nav-badge" aria-label={`${unread} unread`}>{unread}</span>}</>;
  const item = (l: NavLink) => <Link key={l.href} href={l.href} aria-current={active === l ? "page" : undefined}>{label(l)}</Link>;
  const onPick = (e: React.ChangeEvent<HTMLSelectElement>) => { if (e.target.value === "signout") signOut(); else router.push(e.target.value); };
  return <PageShell>
    <div className="acct-layout">
      <aside className="acct-side" aria-label="Account navigation">
        <p className="acct-hello">{user ? <>Hello, <strong>{user.name}</strong></> : "Loading…"}</p>
        <nav className="acct-nav" aria-label="Account sections">
          <span className="acct-group">My account</span>
          <div className="acct-subnav">{links.filter((l) => l.group).map(item)}</div>
          {links.filter((l) => !l.group).map(item)}
          <button onClick={signOut}>Sign out</button>
        </nav>
      </aside>
      <label className="acct-picker"><span>Account section</span>
        <select value={active?.href ?? ""} onChange={onPick}>
          {!active && <option value="">Choose a section</option>}
          <optgroup label="My account">{links.filter((l) => l.group).map((l) => <option key={l.href} value={l.href}>{l.label}</option>)}</optgroup>
          {links.filter((l) => !l.group).map((l) => <option key={l.href} value={l.href}>{l.label}{l.href === "/account/tickets" && unread > 0 ? ` (${unread})` : ""}</option>)}
          <option value="signout">Sign out</option>
        </select>
      </label>
      <section className="acct-content">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/account">My account</Link> <span aria-hidden="true">›</span> <span aria-current="page">{crumb ?? title}</span></nav>
        <h1>{title}</h1>
        {user ? children(user) : <p className="muted-note">Loading your account…</p>}
      </section>
    </div>
  </PageShell>;
}

export const StatusBadge = ({ status }: { status: string }) => <span className={`badge badge-${status}`}>{status}</span>;
