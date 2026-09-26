"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { agoText, api } from "@/lib/client/api";
import type { Order, OrderItem, SessionUser } from "@/lib/client/types";
import { profileTasks } from "@/lib/profile";
import { AccountShell, Avatar, Cover } from "../components/account-shell";
import { Notice, readQuery } from "../components/auth-ui";
import { useCurrency } from "../components/currency-provider";

// Overview (Handoff v8 C1): profile card, balance card, recent purchases card.
function ProfileCard({ user }: { user: SessionUser }) {
  const tasks = profileTasks(user); const done = tasks.filter((t) => t.done).length; const pct = Math.round((done / tasks.length) * 100);
  const [open, setOpen] = useState(false);
  return <div className="dash-card profile-card">
    <div className="profile-top">
      <Avatar user={user} />
      <div className="profile-who"><strong>{user.name}</strong><span>{user.email}</span></div>
      <Link className="icon-btn" href="/account/settings#profile" aria-label="Edit profile">✎</Link>
    </div>
    <div className="profile-progress">
      <span>Complete your profile ({pct}%)</span>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><i style={{ width: `${pct}%` }} /></div>
      <button className="task-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{done} of {tasks.length} tasks completed <span aria-hidden="true">›</span></button>
      {open && <ul className="task-list">{tasks.map((t) => <li key={t.id} className={t.done ? "done" : ""}><span aria-hidden="true">{t.done ? "✓" : "○"}</span>{t.done ? t.label : <Link href={t.href}>{t.label}</Link>}<span className="sr-only">{t.done ? " (done)" : " (to do)"}</span></li>)}</ul>}
    </div>
  </div>;
}

function BalanceCard() {
  const { price } = useCurrency();
  return <div className="dash-card balance-card">
    <span className="dash-label">Total balance</span>
    <strong className="balance-amount">{price(0)}</strong>
    <small className="muted-note">Estimated from the most recent conversion rate.</small>
    <Link className="btn btn-outline" href="/account/balance">Wallet overview</Link>
    <div className="gift-row">
      <div><span className="dash-label">Gift card balance</span><strong>{price(0)}</strong><small>Available to spend on CoreCart only</small></div>
      <Link className="icon-btn icon-btn-plus" href="/account/balance#redeem" aria-label="Redeem a gift card">+</Link>
    </div>
  </div>;
}

type KeyRow = OrderItem & { orderId: string; orderNumber: string; createdAt: string };
function RecentPurchases({ orders }: { orders: Order[] | null }) {
  const keys: KeyRow[] = (orders ?? []).flatMap((o) => o.items.filter((i) => i.kind === "game_key").map((i) => ({ ...i, orderId: o.id, orderNumber: o.number, createdAt: o.createdAt })));
  const owned = keys.reduce((t, k) => t + k.quantity, 0); const waiting = keys.filter((k) => !k.revealedAt).reduce((t, k) => t + k.quantity, 0);
  return <section className="dash-card purchases" aria-labelledby="recent-h">
    <header className="dash-head"><h2 id="recent-h">Recent purchases</h2><Link className="text-link" href="/account/orders">All orders <span aria-hidden="true">›</span></Link></header>
    {orders === null ? <p className="muted-note dash-pad">Loading…</p> : keys.length === 0 ? <div className="dash-empty">
      <span className="dash-empty-icon" aria-hidden="true">▢</span><strong>No purchases yet</strong><p>Your game keys appear here right after checkout.</p>
      <Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link>
    </div> : <>
      <dl className="stats-strip"><div><dt>Keys owned</dt><dd>{owned}</dd></div><div className="blue"><dt>Not revealed</dt><dd>{waiting}</dd></div></dl>
      <ul className="purchase-rows">{keys.slice(0, 3).map((k) => <li key={k.id}>
        <Cover name={k.name} platform={k.platform} size={44} />
        <div className="purchase-info"><strong>{k.name}</strong><span>{[k.platform, k.region, agoText(k.createdAt)].filter(Boolean).join(" · ")}</span></div>
        {k.revealedAt ? <span className="chip chip-grey">Revealed</span> : <span className="chip chip-blue">New key</span>}
        <Link className="text-link row-link" href="/account/keys">{k.revealedAt ? "View" : "Reveal"} <span aria-hidden="true">›</span><span className="sr-only"> {k.name}</span></Link>
      </li>)}</ul>
      <div className="dash-foot"><span>{waiting === 0 ? "All keys revealed" : `${waiting} key${waiting === 1 ? "" : "s"} waiting`}</span><Link className="btn btn-primary" href="/account/keys">Open keys library</Link></div>
    </>}
  </section>;
}

export default function AccountPage() {
  const [orders, setOrders] = useState<Order[] | null>(null); const [verified, setVerified] = useState(false);
  useEffect(() => { setVerified(readQuery("verified") === "1"); api.listOrders().then((r) => setOrders(r.ok ? r.orders : [])); }, []);
  return <AccountShell title="Overview">{(user) => <>
    {verified && <Notice tone="success">Email verified. Your account is active.</Notice>}
    <div className="dash-grid"><ProfileCard user={user} /><BalanceCard /></div>
    <RecentPurchases orders={orders} />
  </>}</AccountShell>;
}
