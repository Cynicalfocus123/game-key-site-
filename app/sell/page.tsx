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
    {/* User 2026-10-18: no bordered box per text section. Open layout: icon benefits, numbered steps, tick checklist. */}
    <ul className="sell-benefits" aria-label="Why sell on CoreCart">
      <li><span className="sell-icon" aria-hidden="true">◎</span><h2>Big audience</h2><p>Your offers next to our catalog, in the buyer&apos;s own currency.</p></li>
      <li><span className="sell-icon" aria-hidden="true">$</span><h2>Payouts</h2><p>Sell to CoreCart buyers and get paid out. Seller tools and payouts come after approval.</p></li>
      <li><span className="sell-icon" aria-hidden="true">✓</span><h2>Safe sales</h2><p>Every seller is checked (KYC) before listing anything.</p></li>
    </ul>
    <section className="sell-how" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      <ol className="sell-flow">
        <li><strong>Apply</strong><p>As an <b>Individual</b> (3 steps: basic details, proofs, product description) or a <b>Business</b> (5 steps: company details, documentation, representative, trade references, offer details). Each step is saved, so you can finish later on any device.</p></li>
        <li><strong>We check</strong><p>We review your request within 1–3 business days.</p></li>
        <li><strong>Approved</strong><p>Your account becomes a seller account.</p></li>
      </ol>
      <h2>What you need</h2>
      <ul className="sell-needs"><li>Passport, ID card, residence card or driving licence + a selfie holding it</li><li>Individual: 1–5 invoices or agreements from your suppliers</li>
        <li>Business: certificate of incorporation, supporting company documents, UBO list and at least 1 supplier with proof of partnership</li>
        <li>Files: JPEG, PNG, GIF or PDF, up to 10 MB each (selfie: JPEG, PNG or PDF)</li></ul>
      <p className="muted-note">Your documents are private: only CoreCart staff who review sellers can open them, and every view is logged.</p>
    </section>
  </PageShell>;
}
