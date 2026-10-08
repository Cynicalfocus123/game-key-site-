"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { marketApi, money } from "@/lib/client/api";
import type { Product } from "@/lib/catalog";
import { COMMISSION_BP, linesText, MARKET_ERRORS, productLine, productTitle, youReceive, type KeyReport, type SellerHome } from "@/lib/marketplace";
import { AccountShell } from "./account-shell";
import { Notice } from "./auth-ui";
import { SellerLogo } from "./market-ui";

// Seller pages (marketplace step 2, wireframe screens 3, 3A, 4, 4B, 5A, 6): same shell as the account dashboard, guarded by the
// seller API (signed in + latest application approved). Amounts are USD cents (seller currency, user 2026-10-08).
export const usd = (cents: number) => money(cents, "USD");
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
const dayTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export type SellerCtx = { home: SellerHome; reload: () => Promise<void>; setHome: (h: SellerHome) => void };
// title(home) = page heading once the store is known. `crumb` = breadcrumb name; sub-pages get "Seller dashboard" as the middle link.
export function SellerShell({ title, crumb, sub = true, children }: { title: string | ((h: SellerHome) => string); crumb: string; sub?: boolean; children: (c: SellerCtx) => React.ReactNode }) {
  const [home, setHome] = useState<SellerHome | null>(null); const [error, setError] = useState("");
  const reload = useCallback(async () => { const r = await marketApi.home(); if (r.ok) { setHome(r.home); setError(""); } else setError(r.error); }, []);
  useEffect(() => { reload(); }, [reload]);
  const heading = home ? (typeof title === "string" ? title : title(home)) : crumb;
  return <AccountShell title={heading} crumb={crumb} parent={sub ? { href: "/seller", label: "Seller dashboard" } : undefined}>{() =>
    error && error !== "Not signed in" ? <div className="sl-denied">
      <Notice tone="error">{error}</Notice>
      {error === MARKET_ERRORS.notSeller && <p>Apply to sell first. Once an admin approves your application, your seller dashboard opens here. <Link className="text-link" href="/sell">Sell on CoreCart <span aria-hidden="true">›</span></Link></p>}
    </div> : !home ? <p className="muted-note">Loading your store…</p> : <>
      {home.holdUntil && <Notice>Sales are on hold until {dayTime(home.holdUntil)} (Bangkok time). You can prepare offers and keys now; buyers see them when the hold ends.</Notice>}
      {children({ home, reload, setHome })}
    </>}
  </AccountShell>;
}

// Seller card (screen 3A): logo (step 4: uploaded logo or first letter, square frame), store name, blue Verified tick, Seller since.
export function SellerCard({ home }: { home: SellerHome }) {
  return <div className="sl-who">
    <SellerLogo name={home.store.name} logo={home.store.logo} size={40} />
    <strong>{home.store.name}</strong> <span className="sl-tick" title="Verified seller" aria-label="Verified seller">✓</span>
    {home.store.since && <span className="muted-note sl-since">· Seller since {monthYear(home.store.since)}</span>}
  </div>;
}

// 4 tiles (screens 3A, 4, 5A). Available for payout stays $0 until payouts are built (separate wireframe).
export function SellerTiles({ home, short }: { home: SellerHome; short?: boolean }) {
  const [info, setInfo] = useState(false); const t = home.tiles;
  return <>
    <dl className="sl-tiles" aria-label="Seller numbers">
      <div><dt>{short ? "For payout" : "Available for payout"} <button type="button" className="sl-i" aria-expanded={info} aria-label="About Available for payout" onClick={() => setInfo((v) => !v)}>i</button></dt><dd>{usd(t.availableUsdCents)}</dd></div>
      <div><dt>{short ? "Income 7 days" : "Income (last 7 days)"}</dt><dd>{usd(t.incomeUsdCents7)}</dd></div>
      <div><dt>{short ? "Sales 7 days" : "Sales (last 7 days)"}</dt><dd>{t.sales7}</dd></div>
      <div><dt>Active offers</dt><dd>{t.activeOffers}</dd></div>
    </dl>
    {info && <p className="muted-note sl-note" role="note">Payouts come later: money from sales collects here and you can ask for a payout once that part is built. Money on hold is not included. Amounts in USD (your seller currency).</p>}
  </>;
}

// "You receive": price − commission. The % is not decided yet (COMMISSION_BP null) → "$x − fee".
export function Receive({ cents, long }: { cents: number; long?: boolean }) {
  const net = youReceive(cents, COMMISSION_BP);
  return net === null ? <>{usd(cents)} − {long ? "commission" : "fee"} <span className="muted-note sl-inline">(commission % pending)</span></> : <>{usd(net)}</>;
}

// "Elden Ring (PC) Steam Key GLOBAL" (screen 4 dropdown). (PC) only for products with a PC operating system.
export { productTitle }; // moved to lib/marketplace.ts (emails use it too)
export const productSub = (p: Pick<Product, "platform" | "region" | "edition">) => productLine({ ...p, region: p.region?.toUpperCase() });

// "Check before saving" (screen 4): counts + line numbers only, never key text.
export function KeyReportView({ report, pending }: { report: KeyReport; pending?: boolean }) {
  const r = report; const dupLines = r.duplicates.map((d) => d.line);
  return <div className="sl-report" aria-live="polite" data-testid="key-report">
    <b>Check before saving{pending ? " (checking…)" : ""}:</b>
    {r.tooMany && <Notice tone="error">{MARKET_ERRORS.tooMany}</Notice>}
    <ul>
      <li><span className="chip chip-green">{r.okCount} OK</span> new key{r.okCount === 1 ? "" : "s"}, {r.format.name} format</li>
      <li><span className="chip chip-amber">{r.duplicates.length} duplicate{r.duplicates.length === 1 ? "" : "s"}</span> {dupLines.length ? `${linesText(dupLines)} — same key twice in this list (skipped)` : "— same key twice in this list"}</li>
      <li><span className="chip chip-red">{r.invalid.length} wrong format</span> {r.invalid.length ? <>{linesText(r.invalid.map((x) => x.line))}{r.invalid.length === 1 && <> &ldquo;{r.invalid[0].text}&rdquo;</>} — not a {r.format.name} key ({r.format.example})</> : <>— {r.format.name} keys look like {r.format.example}</>}</li>
      <li><span className="chip chip-amber">{r.existing.length} already sold / listed</span> {r.existing.length ? `${linesText(r.existing)} — already in CoreCart (refused)` : "— a key that exists anywhere in CoreCart is refused"}</li>
    </ul>
  </div>;
}

// Offer status chip (screens 3, 6).
export function StatusChip({ status }: { status: "active" | "paused" | "sold_out" }) {
  return status === "active" ? <span className="chip chip-green">Active</span> : status === "sold_out" ? <span className="chip chip-red">Sold out</span> : <span className="chip">Paused</span>;
}
