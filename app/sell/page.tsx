"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { MyApplication } from "@/lib/sellers";
import { PageShell } from "../components/auth-ui";
import { useAuth } from "../components/auth-provider";
import { SellerStatusCard } from "../components/seller-status";

// T3 "Sell on CoreCart" intro (Kinguin-style). Everyone signs up as a customer; business sellers apply in 4 steps.
export default function SellPage() {
  const { user } = useAuth(); const [app, setApp] = useState<MyApplication | null | undefined>(undefined);
  useEffect(() => { if (user) api.sellerStatus().then((r) => setApp(r.ok ? r.application : null)); else setApp(null); }, [user]);
  const open = app && (app.status === "pending" || app.status === "approved");
  const start = user ? "/sell/apply" : "/login?next=%2Fsell%2Fapply";
  return <PageShell>
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Sell on CoreCart</span></nav>
    <section className="sell-hero">
      <div>
        <h1>Sell on CoreCart</h1>
        <p>For business sellers of game keys, gift cards and software. Reach gamers who pay in 53 currencies.</p>
        {open ? <p className="sell-note">You already applied. See the status below.</p> : <Link className="btn btn-primary sell-start" href={start}>Start selling</Link>}
        {!user && <p className="sell-note">Sign in or create a free account first. Every account starts as a customer.</p>}
      </div>
    </section>
    {app && <SellerStatusCard app={app} />}
    <div className="sell-benefits">
      <div className="dash-card"><h2>Big audience</h2><p>Your offers next to our catalog, in the buyer&apos;s own currency.</p></div>
      <div className="dash-card"><h2>Payouts</h2><p>Sell to CoreCart buyers and get paid out. Seller tools and payouts come after approval.</p></div>
      <div className="dash-card"><h2>Safe sales</h2><p>Every seller is checked (KYC) before listing anything.</p></div>
    </div>
    <section className="dash-card sell-how" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      <ol><li><strong>Apply</strong> in 4 steps: personal details, your stock, company, ID check.</li><li><strong>We check</strong> your details within 3 working days.</li><li><strong>Approved</strong>: your account becomes a seller account.</li></ol>
      <h3>What you need</h3>
      <ul><li>ID card, passport or driving licence (photos of the front and back)</li><li>1–5 sample invoices from your suppliers</li><li>1–5 photos of keys you hold</li><li>Company details, if you sell as a company</li></ul>
      <p className="muted-note">ID images are private: only CoreCart staff who review sellers can open them, and every view is logged.</p>
    </section>
  </PageShell>;
}
