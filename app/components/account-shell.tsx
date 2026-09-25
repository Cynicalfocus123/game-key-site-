"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/client/api";
import type { SessionUser } from "@/lib/client/types";
import { useAuth } from "./auth-provider";
import { PageShell } from "./auth-ui";

const links = [{ href: "/account", label: "Overview" }, { href: "/account/orders", label: "Orders" }, { href: "/account/payment-methods", label: "Payment methods" }, { href: "/account/settings", label: "Settings" }];

export function AccountShell({ title, children }: { title: string; children: (user: SessionUser) => React.ReactNode }) {
  const { user, refresh } = useAuth(); const router = useRouter(); const path = usePathname();
  const leaving = useRef(false);
  useEffect(() => { if (user === null && !leaving.current) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [user, router, path]);
  const signOut = async () => { leaving.current = true; await api.signOut(); router.replace("/"); await refresh(); };
  const clean = path.replace(/\/$/, "") || "/";
  return <PageShell>
    <div className="acct-layout">
      <aside className="acct-side" aria-label="Account navigation">
        <p className="acct-hello">{user ? <>Hello, <strong>{user.name}</strong></> : "Loading…"}</p>
        <div className="acct-nav">{links.map(l => <Link key={l.href} href={l.href} aria-current={clean.endsWith(l.href) && (l.href !== "/account" || clean.endsWith("/account")) ? "page" : undefined}>{l.label}</Link>)}<button onClick={signOut}>Sign out</button></div>
      </aside>
      <section className="acct-content"><h1>{title}</h1>{user ? children(user) : <p className="muted-note">Loading your account…</p>}</section>
    </div>
  </PageShell>;
}

export const StatusBadge = ({ status }: { status: string }) => <span className={`badge badge-${status}`}>{status}</span>;
