"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { fileGroups, mimeLabel, SELLER_STATUS_CHIP, SELLER_STATUS_LABEL, sellerTypeLabel, type MyApplicationDetails } from "@/lib/sellers";
import { Notice, PageShell } from "../../components/auth-ui";
import { useAuth } from "../../components/auth-provider";
import { SellerAnswers } from "../../components/seller-answers";

// "Go to details": read-only copy of the latest application (every answer, file names only, last 4 of the document number). Nothing can
// be changed here; after a rejection "Apply again" starts a new draft with these answers.
export default function SellDetailsPage() {
  const { user } = useAuth(); const router = useRouter();
  const [d, setD] = useState<MyApplicationDetails | null | undefined>(undefined); const [error, setError] = useState("");
  useEffect(() => { if (user === null) router.replace("/login?next=%2Fsell%2Fdetails"); }, [user, router]);
  useEffect(() => { if (user) api.sellerDetails().then((r) => (r.ok ? setD(r.details) : setError(r.error))); }, [user]);
  const date = (s: string) => new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return <PageShell>
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/sell">Sell on CoreCart</Link> <span aria-hidden="true">›</span> <span aria-current="page">Details</span></nav>
    {error ? <Notice tone="error">{error}</Notice> : d === undefined ? <p className="muted-note">Loading…</p> : d === null ? <p className="empty">No application sent yet. <Link className="text-link" href="/sell/apply">Start one</Link></p> : <>
      <div className="sell-details-head"><h1 className="sell-title">{d.number} · {d.merchantName}</h1><span className={`chip ${SELLER_STATUS_CHIP[d.status]}`}>{d.status === "pending" ? "Approving" : SELLER_STATUS_LABEL[d.status]}</span><span className="chip chip-blue">{sellerTypeLabel(d.sellerType)}</span></div>
      <p className="muted-note">Read-only copy of what you sent{d.status === "pending" ? ". You cannot change anything while it is being reviewed (1–3 business days)." : "."}</p>
      {d.status === "rejected" && <Notice tone="error">Not approved{d.reason ? `: “${d.reason}”` : ""}. <Link className="text-link" href="/sell/apply?again=1">Apply again</Link> (your answers are filled in).</Notice>}
      <SellerAnswers answers={d.answers} idNumber={`•••• ${d.idLast4}`} extra={[["Sent", date(d.createdAt)], ["Terms", d.termsVersion ? `Agreed (version ${d.termsVersion})` : ""], ...(d.decidedAt ? [["Decided", date(d.decidedAt)] as [string, string]] : [])]} />
      <section className="dash-card" aria-labelledby="sd-files-h"><h2 id="sd-files-h" className="sell-h2">Files you sent ({d.files.length})</h2>
        {fileGroups(d.answers, d.files).map((g) => <div key={g.title} className="sell-dfiles"><h3>{g.title}</h3><ul>{g.rows.map((r, n) => <li key={r.file?.id ?? `n${n}`}><span>{r.doc}</span>{r.file ? <small>{r.file.name} · {mimeLabel(r.file.mime)} · {(r.file.size / 1024 / 1024).toFixed(1)} MB</small> : <small>{r.optional ? "Not sent (optional)" : "Not sent"}</small>}</li>)}</ul></div>)}
      </section>
      <p><Link className="btn btn-outline" href="/account">Go to dashboard</Link></p>
    </>}
  </PageShell>;
}
