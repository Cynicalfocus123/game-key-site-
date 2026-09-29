"use client";

import Link from "next/link";
import { SELLER_STATUS_CHIP, SELLER_STATUS_LABEL, type MyApplication } from "@/lib/sellers";

// T3: the applicant's view of their latest seller application (/sell and the account overview).
export function SellerStatusCard({ app, compact }: { app: MyApplication; compact?: boolean }) {
  const date = new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return <section className={`dash-card seller-status seller-${app.status}`} aria-label="Seller application">
    <div className="seller-status-head"><strong>Seller application {app.number}</strong><span className={`chip ${SELLER_STATUS_CHIP[app.status]}`}>{SELLER_STATUS_LABEL[app.status]}</span></div>
    <p>{app.status === "pending" ? `Sent ${date} for ${app.merchantName}. We check it within 3 working days and email you.`
      : app.status === "approved" ? "You are a seller. Seller tools (listings, payouts) come soon."
      : <>Not approved{app.reason ? <>: “{app.reason}”</> : ""}. You can apply again.</>}</p>
    {app.status === "rejected" && <Link className="btn btn-outline btn-sm" href="/sell/apply">Apply again</Link>}
    {compact && app.status !== "rejected" && <Link className="text-link" href="/sell">Sell on CoreCart <span aria-hidden="true">›</span></Link>}
  </section>;
}
