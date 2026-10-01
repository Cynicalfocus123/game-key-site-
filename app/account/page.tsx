"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { agoText, api } from "@/lib/client/api";
import type { BalanceData, GameKey, SessionUser } from "@/lib/client/types";
import type { MyApplication, SellerDraft } from "@/lib/sellers";
import { SellerDraftCard, SellerStatusCard } from "../components/seller-status";
import { profileTasks } from "@/lib/profile";
import { AccountShell, Avatar, Cover } from "../components/account-shell";
import { Notice, readQuery } from "../components/auth-ui";
import { useCurrency } from "../components/currency-provider";
import { keyHref } from "../components/key-facts";

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

function BalanceCard({ balance }: { balance: BalanceData | null }) {
  const { price } = useCurrency(); const wallet = balance?.walletMinor ?? 0; const gift = balance?.giftMinor ?? 0;
  return <div className="dash-card balance-card">
    <span className="dash-label">Total balance</span>
    <strong className="balance-amount" data-testid="total-balance">{balance ? price(wallet + gift) : "…"}</strong>
    <small className="muted-note">Estimated from the most recent conversion rate.</small>
    <Link className="btn btn-outline" href="/account/balance">Wallet overview</Link>
    <div className="gift-row">
      <div><span className="dash-label">Gift card balance</span><strong data-testid="overview-gift">{balance ? price(gift) : "…"}</strong><small>Available to spend on CoreCart only</small></div>
      <Link className="icon-btn icon-btn-plus" href="/account/balance#redeem" aria-label="Redeem a gift card">+</Link>
    </div>
  </div>;
}

// Rows = per-key records (newest order first); links open the key detail page.
function RecentPurchases({ keys: list }: { keys: GameKey[] | null }) {
  const keys = list ?? []; const owned = keys.length; const waiting = keys.filter((k) => !k.revealedAt).length;
  return <section className="dash-card purchases" aria-labelledby="recent-h">
    <header className="dash-head"><h2 id="recent-h">Recent purchases</h2><Link className="text-link" href="/account/orders">All orders <span aria-hidden="true">›</span></Link></header>
    {list === null ? <p className="muted-note dash-pad">Loading…</p> : keys.length === 0 ? <div className="dash-empty">
      <span className="dash-empty-icon" aria-hidden="true">▢</span><strong>No purchases yet</strong><p>Your game keys appear here right after checkout.</p>
      <Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link>
    </div> : <>
      <dl className="stats-strip"><div><dt>Keys owned</dt><dd>{owned}</dd></div><div className="blue"><dt>Not revealed</dt><dd>{waiting}</dd></div></dl>
      <ul className="purchase-rows">{keys.slice(0, 3).map((k) => <li key={k.id}>
        <Cover name={k.name} platform={k.platform} size={44} />
        <div className="purchase-info"><strong>{k.name}</strong><span>{[k.platform, k.region, agoText(k.createdAt)].filter(Boolean).join(" · ")}</span></div>
        {k.revealedAt ? <span className="chip chip-grey">Revealed</span> : <span className="chip chip-blue">New key</span>}
        <Link className="text-link row-link" href={keyHref(k)}>{k.revealedAt ? "View" : "Get key"} <span aria-hidden="true">›</span><span className="sr-only"> {k.name}</span></Link>
      </li>)}</ul>
      <div className="dash-foot"><span>{waiting === 0 ? "All keys revealed" : `${waiting} key${waiting === 1 ? "" : "s"} waiting`}</span><Link className="btn btn-primary" href="/account/keys">Open keys library</Link></div>
    </>}
  </section>;
}

export default function AccountPage() {
  const [app, setApp] = useState<MyApplication | null>(null); const [draft, setDraft] = useState<SellerDraft | null>(null); // T3 seller application status / unsent draft
  const [keys, setKeys] = useState<GameKey[] | null>(null); const [balance, setBalance] = useState<BalanceData | null>(null); const [verified, setVerified] = useState(false);
  useEffect(() => { setVerified(readQuery("verified") === "1"); api.listKeys().then((r) => setKeys(r.ok ? r.keys : [])); api.balance().then((r) => r.ok && setBalance(r.balance)); api.sellerStatus().then((r) => { if (r.ok) { setApp(r.application); setDraft(r.draft); } }); }, []);
  return <AccountShell title="Overview">{(user) => <>
    {verified && <Notice tone="success">Email verified. Your account is active.</Notice>}
    {draft ? <SellerDraftCard draft={draft} onDeleted={() => setDraft(null)} /> : app && <SellerStatusCard app={app} compact />}
    <div className="dash-grid"><ProfileCard user={user} /><BalanceCard balance={balance} /></div>
    <RecentPurchases keys={keys} />
  </>}</AccountShell>;
}
