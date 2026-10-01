"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import type { SellerList } from "@/lib/client/types";
import { countryName } from "@/lib/profile";
import { SELLER_STATUS_CHIP, SELLER_STATUS_LABEL, SELLER_TABS, sellerTypeLabel, type SellerTab } from "@/lib/sellers";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice, readQuery } from "../../components/auth-ui";

// T3 Seller applications (section "sellers"): tabs Pending · Approved · Rejected · Blacklisted · Closed, search, ⚠ returning-person flag.
function Sellers() {
  const router = useRouter();
  const [tab, setTab] = useState<SellerTab>("pending"); const [q, setQ] = useState(""); const [search, setSearch] = useState("");
  const [data, setData] = useState<SellerList | null>(null); const [error, setError] = useState("");
  useEffect(() => { const t = readQuery("tab"); if (SELLER_TABS.some((x) => x.id === t)) setTab(t as SellerTab); }, []);
  const load = useCallback(() => { adminApi.sellers(tab, q).then((r) => (r.ok ? setData(r.data) : setError(r.error))); }, [tab, q]);
  useEffect(load, [load]);
  const pick = (t: SellerTab) => { setTab(t); router.replace(`/admin/sellers?tab=${t}`); };
  return <>
    <div className="adm-head"><span>Everyone who applied to sell. Rejected, blacklisted and closed records are kept.</span></div>
    <div className="dash-tabs adm-tabs" role="tablist" aria-label="Application status">{SELLER_TABS.map((t) => <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => pick(t.id)}>{t.label}{data && <small className="adm-tab-n">{data.counts[t.id]}</small>}</button>)}</div>
    <form className="adm-filters" onSubmit={(e) => { e.preventDefault(); setQ(search); }}>
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Merchant, name, company, email or SA-number" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <button className="btn btn-outline">Search</button>
    </form>
    {error && <Notice tone="error">{error}</Notice>}
    {!data ? <p className="muted-note">Loading…</p> : !data.rows.length ? <p className="empty">No applications here.</p> :
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Application</th><th>Type</th><th>Merchant</th><th>Applicant / company</th><th>Country</th><th>Files</th><th>Submitted</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{data.rows.map((r) => <tr key={r.id} className="sa-row" onClick={() => router.push(`/admin/seller?id=${encodeURIComponent(r.id)}`)}>
          <td><Link href={`/admin/seller?id=${encodeURIComponent(r.id)}`} onClick={(e) => e.stopPropagation()}><strong>{r.number}</strong></Link>{r.matches > 0 && <small className="adm-flag" title="Same email, KYC ID number or merchant name as a closed, rejected or blacklisted record">⚠ Returning person ({r.matches})</small>}</td>
          <td><span className={`chip ${r.sellerType === "business" ? "chip-blue" : "chip-grey"}`}>{sellerTypeLabel(r.sellerType)}</span>{r.freeze > 0 && <small>{r.freeze}-day freeze</small>}</td>
          <td>{r.merchantName}</td><td><strong>{r.name}</strong><small>{r.email}</small></td><td>{r.businessCountry ? countryName(r.businessCountry) : "—"}</td><td>{r.fileCount}</td><td>{dateTime(r.createdAt)}</td>
          <td><span className={`chip ${SELLER_STATUS_CHIP[r.status]}`}>{r.status === "pending" ? "Pending" : SELLER_STATUS_LABEL[r.status]}</span>{r.tab === "closed" && <small>Account closed</small>}</td>
          <td><Link className="btn btn-outline btn-sm" href={`/admin/seller?id=${encodeURIComponent(r.id)}`} onClick={(e) => e.stopPropagation()}>Open ›<span className="sr-only"> {r.number}</span></Link></td>
        </tr>)}</tbody>
      </table></div>}
  </>;
}

export default function AdminSellersPage() {
  return <AdminShell title="Seller applications"><Sellers /></AdminShell>;
}
