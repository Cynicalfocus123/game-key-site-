"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { holdActive, holdDate, SELLER_STATUS_CHIP, SELLER_STATUS_LABEL, sellerTypeLabel, STEP_LABEL, type MyApplication, type SellerDraft } from "@/lib/sellers";
import { Notice } from "./auth-ui";

// T3: the applicant's view of their latest seller application (/sell and the account overview).
export function SellerStatusCard({ app, compact }: { app: MyApplication; compact?: boolean }) {
  const date = new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return <section className={`dash-card seller-status seller-${app.status}`} aria-label="Seller application">
    <div className="seller-status-head"><strong>Seller application {app.number}</strong><span className={`chip ${SELLER_STATUS_CHIP[app.status]}`}>{app.status === "pending" ? "Approving" : SELLER_STATUS_LABEL[app.status]}</span><span className="chip chip-blue">{sellerTypeLabel(app.sellerType)}</span></div>
    <p>{app.status === "pending" ? `Sent ${date} for ${app.merchantName}. Requests are processed within 1–3 business days; we email you the answer.`
      : app.status === "approved" ? <>Your {app.sellerType === "business" ? "business " : ""}seller account is active. {holdActive(app.hold) ? <strong className="seller-hold">Sales are on hold until {holdDate(app.hold!.until)} (10-day check for invoice-only suppliers).</strong> : app.hold ? "Sales are open. " : ""}Seller tools (listings, payouts) come soon.</>
      : <>Not approved{app.reason ? <>: “{app.reason}”</> : ""}. You can apply again; your earlier answers are filled in.</>}</p>
    <div className="seller-status-btns">
      {app.status === "rejected" && <Link className="btn btn-primary btn-sm" href="/sell/apply?again=1">Apply again</Link>}
      <Link className="btn btn-outline btn-sm" href="/sell/details">Go to details</Link>
      {compact && app.status !== "rejected" && <Link className="text-link" href="/sell">Sell on CoreCart <span aria-hidden="true">›</span></Link>}
    </div>
  </section>;
}

// Rejected (screen 13, Difmark style, user 2026-10-01): red banner with Contact our support → the support ticket page with the subject
// "Account verification" already chosen. Shown on My account Overview, /sell and /sell/apply. A blacklisted one shows as rejected too.
export const SUPPORT_VERIFY = "/account/tickets?new=1&subject=account_verification";
export function SellerRejectedBanner({ app }: { app: MyApplication }) {
  return <div className="seller-rejected" role="alert"><span className="seller-rejected-ic" aria-hidden="true">🔒</span>
    <p>Your {app.sellerType === "business" ? "Business" : "Personal"} Verification was <strong>rejected</strong>. You can retry or <Link href={SUPPORT_VERIFY}>contact support</Link> for details.</p>
    <Link className="seller-rejected-cta" href={SUPPORT_VERIFY}>CONTACT OUR SUPPORT <span aria-hidden="true">›</span></Link></div>;
}

// Screen 12 (Eneba "Vendor application"): an unsent draft — progress, next step, Complete application, Delete with confirm.
// Delete clears the answers (the uploaded files stay with CoreCart for KYC, outside any application).
export function SellerDraftCard({ draft, onDeleted }: { draft: SellerDraft; onDeleted: () => void }) {
  const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const p = draft.progress; const saved = new Date(draft.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const del = async () => { setBusy(true); setError(""); const r = await api.discardSellerDraft(); setBusy(false); if (r.ok) { setAsk(false); onDeleted(); } else setError(r.error); };
  return <section className="dash-card seller-status seller-draft" aria-label="Seller application in progress">
    <div className="seller-status-head"><strong>Seller application</strong>{draft.input.sellerType && <span className="chip chip-blue">{sellerTypeLabel(draft.input.sellerType)}</span>}</div>
    <p className="seller-draft-pct">ⓘ In progress ({p.percent}%)</p>
    <div className="seller-bar" role="progressbar" aria-label="Application progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent}><i style={{ width: `${p.percent}%` }} /></div>
    <p>{p.done} out of {p.total} steps completed{p.next ? <> · next: <strong>{STEP_LABEL[p.next]}</strong></> : " · ready to send"} · saved {saved}</p>
    {!ask ? <div className="seller-status-btns"><Link className="btn btn-primary btn-sm" href="/sell/apply">Complete application</Link><button type="button" className="btn btn-outline btn-danger btn-sm" onClick={() => setAsk(true)}>Delete</button></div>
      : <div className="seller-draft-confirm" role="alertdialog" aria-label="Delete this application?"><strong>Delete this application?</strong>
        <p>Your answers are removed from your account and you start again next time. Files you uploaded are kept by CoreCart (KYC law) but are not part of any application.</p>
        <div className="seller-status-btns"><button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={del} autoFocus>{busy ? "Deleting…" : "Delete application"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setAsk(false)}>Keep it</button></div></div>}
    {error && <Notice tone="error">{error}</Notice>}
  </section>;
}
