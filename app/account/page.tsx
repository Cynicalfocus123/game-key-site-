"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, dateText, money } from "@/lib/client/api";
import type { Order, PaymentMethod } from "@/lib/client/types";
import { AccountShell, StatusBadge } from "../components/account-shell";
import { Notice, readQuery } from "../components/auth-ui";

export default function AccountPage() {
  const [orders, setOrders] = useState<Order[] | null>(null); const [cards, setCards] = useState<PaymentMethod[] | null>(null); const [verified, setVerified] = useState(false);
  useEffect(() => { setVerified(readQuery("verified") === "1"); api.listOrders().then(r => setOrders(r.ok ? r.orders : [])); api.listPaymentMethods().then(r => setCards(r.ok ? r.methods : [])); }, []);
  return <AccountShell title="Your account">{user => <>
    {verified && <Notice tone="success">Email verified. Your account is active.</Notice>}
    <div className="acct-tiles">
      <div className="acct-tile"><span>Email</span><strong>{user.email}</strong><small className={user.emailVerified ? "ok" : "warn"}>{user.emailVerified ? "Verified" : "Not verified"}</small></div>
      <div className="acct-tile"><span>Member since</span><strong>{dateText(user.createdAt)}</strong><small>Role: {user.role}</small></div>
      <Link className="acct-tile" href="/account/orders"><span>Orders</span><strong>{orders ? orders.length : "…"}</strong><small>View history →</small></Link>
      <Link className="acct-tile" href="/account/payment-methods"><span>Saved cards</span><strong>{cards ? cards.length : "…"}</strong><small>Manage →</small></Link>
    </div>
    <div className="section-title acct-sub"><h2>Recent orders</h2><Link href="/account/orders">See all →</Link></div>
    {orders === null ? <p className="muted-note">Loading…</p> : orders.length === 0 ? <p className="empty">No orders yet. Orders appear here after checkout.</p> :
      <ul className="order-list compact">{orders.slice(0, 3).map(o => <li key={o.id}><div><strong>{o.number}</strong><span>{dateText(o.createdAt)} · {o.items.length} item{o.items.length > 1 ? "s" : ""}</span></div><StatusBadge status={o.status} /><b>{money(o.totalCents, o.currency)}</b></li>)}</ul>}
  </>}</AccountShell>;
}
