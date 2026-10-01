"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { MyApplication, SellerDraft } from "@/lib/sellers";
import { PageShell } from "../components/auth-ui";
import { useAuth } from "../components/auth-provider";
import { SellerDraftCard, SellerRejectedBanner, SellerStatusCard } from "../components/seller-status";

// T3 "Sell on CoreCart" intro. Everyone signs up as a customer; sellers apply as Individual (3 steps) or Business (5 steps).
export default function SellPage() {
  const { user } = useAuth(); const [app, setApp] = useState<MyApplication | null | undefined>(undefined); const [draft, setDraft] = useState<SellerDraft | null>(null);
  useEffect(() => { if (user) api.sellerStatus().then((r) => { setApp(r.ok ? r.application : null); setDraft(r.ok ? r.draft : null); }); else setApp(null); }, [user]);
  const open = app && (app.status === "pending" || app.status === "approved");
  const start = user ? "/sell/apply" : "/login?next=%2Fsell%2Fapply";
  return <PageShell>
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Sell on CoreCart</span></nav>
    <section className="sell-hero">
      <div>
        <h1>Sell on CoreCart</h1>
        <p>For sellers of game keys, gift cards and software, as a private person or a company. Reach gamers who pay in 53 currencies.</p>
        {open ? <p className="sell-note">You already applied. See the status below.</p> : draft ? <p className="sell-note">You have an application in progress. Finish it below.</p> : <Link className="btn btn-primary sell-start" href={start}>Start selling</Link>}
        {!user && <p className="sell-note">Sign in or create a free account first. Every account starts as a customer.</p>}
      </div>
    </section>
    {app?.status === "rejected" && !draft && <SellerRejectedBanner app={app} />}
    {draft ? <SellerDraftCard draft={draft} onDeleted={() => setDraft(null)} /> : app && <SellerStatusCard app={app} />}
    <div className="sell-benefits">
      <div className="dash-card"><h2>Big audience</h2><p>Your offers next to our catalog, in the buyer&apos;s own currency.</p></div>
      <div className="dash-card"><h2>Payouts</h2><p>Sell to CoreCart buyers and get paid out. Seller tools and payouts come after approval.</p></div>
      <div className="dash-card"><h2>Safe sales</h2><p>Every seller is checked (KYC) before listing anything.</p></div>
    </div>
    <section className="dash-card sell-how" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      <ol><li><strong>Apply</strong> as an <strong>Individual</strong> (3 steps: basic details, proofs, product description) or a <strong>Business</strong> (5 steps: company details, documentation, representative, trade references, offer details). Each step is saved, so you can finish later on any device.</li>
        <li><strong>We check</strong> your request within 1–3 business days.</li><li><strong>Approved</strong>: your account becomes a seller account.</li></ol>
      <h3>What you need</h3>
      <ul><li>Passport, ID card, residence card or driving licence + a selfie holding it</li><li>Individual: 1–5 invoices or agreements from your suppliers</li>
        <li>Business: certificate of incorporation, supporting company documents, UBO list and at least 1 supplier with proof of partnership</li>
        <li>Files: JPEG, PNG, GIF or PDF, up to 10 MB each (selfie: JPEG, PNG or PDF)</li></ul>
      <p className="muted-note">Your documents are private: only CoreCart staff who review sellers can open them, and every view is logged.</p>
    </section>
  </PageShell>;
}
