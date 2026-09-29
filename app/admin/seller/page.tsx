"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { countryName } from "@/lib/profile";
import { eventText, fileKindLabel, idTypeLabel, matchText, SELLER_STATUS_CHIP, SELLER_STATUS_LABEL, type SellerAction, type SellerDetail, type SellerFile, type SellerMatch } from "@/lib/sellers";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// T3 one seller application: everything the applicant sent (personal, stock, company, KYC + ID number), files (View / Download = audited),
// returning-person matches, Approve / Reject / Blacklist / Remove from blacklist (reason + confirm), history.
function Detail() {
  const [d, setD] = useState<SellerDetail | null>(null); const [error, setError] = useState("");
  const id = useSearchParams().get("id"); // a match link opens another application on this same page
  const load = useCallback(() => { if (!id) return setError("Missing application id."); setError(""); adminApi.seller(id).then((r) => (r.ok ? setD(r.seller) : setError(r.error))); }, [id]);
  useEffect(load, [load]);
  if (error) return <><Notice tone="error">{error}</Notice><Link className="text-link" href="/admin/sellers">← Seller applications</Link></>;
  if (!d) return <p className="muted-note">Loading…</p>;
  const rows = (list: [string, React.ReactNode][]) => <dl className="sa-dl">{list.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl>;
  return <>
    <p className="adm-back"><Link className="text-link" href={`/admin/sellers?tab=${d.tab}`}>← Seller applications</Link></p>
    <div className="adm-head sa-head"><h2>{d.number} · {d.merchantName}</h2><span className={`chip ${SELLER_STATUS_CHIP[d.status]}`}>{d.status === "pending" ? "Pending" : SELLER_STATUS_LABEL[d.status]}</span>{d.accountClosed && <span className="chip chip-grey">Account closed</span>}</div>
    {d.matchList.length > 0 && <Matches list={d.matchList} />}
    <div className="acct-tiles">
      <div className="acct-tile"><span>Applicant</span><strong className="tu-adm-email">{d.name}</strong><small><Link className="text-link" href={`/admin/user?id=${encodeURIComponent(d.userId)}`}>{d.email}</Link></small></div>
      <div className="acct-tile"><span>Submitted</span><strong>{dateTime(d.createdAt)}</strong><small>{d.decidedAt ? `Decided ${dateTime(d.decidedAt)} by ${d.decidedBy ?? "—"}` : "Not decided yet"}</small></div>
      <div className="acct-tile"><span>Company</span><strong>{d.isCompany ? "Yes" : "No"}</strong><small>{d.isCompany ? d.companyName : "Private business seller"}</small></div>
      <div className="acct-tile"><span>Business location</span><strong>{countryName(d.businessCountry)}</strong><small>Citizenship {countryName(d.citizenship)}</small></div>
    </div>
    {d.reason && <Notice>Reject reason (the applicant sees it): “{d.reason}”</Notice>}
    {d.blacklistReason && d.status === "blacklisted" && <Notice tone="error">Blacklisted: “{d.blacklistReason}”</Notice>}
    <Actions d={d} onDone={load} />
    <section className="adm-panel"><h2>Personal</h2>{rows([["First name", d.firstName], ["Last name", d.lastName], ["Merchant name", d.merchantName], ["Store / website", d.storeUrl], ["Marketplace profiles", d.profiles && <span className="sa-pre">{d.profiles}</span>], ["Why sell on CoreCart", <span key="w" className="sa-pre">{d.why}</span>]])}</section>
    <section className="adm-panel"><h2>Stock</h2>{rows([["Key sources", d.sources.join(", ")], ["Codes in stock", d.stockSize], ["Product types", d.productTypes.join(", ")], ["Heard about us", d.heardFrom]])}</section>
    <section className="adm-panel"><h2>Company</h2>{d.isCompany ? rows([["Company name", d.companyName], ["Registration number", d.companyReg], ["Tax ID / VAT", d.companyTax], ["Address", <span key="a" className="sa-pre">{d.companyAddress}</span>]]) : <p className="muted-note">Not a registered company.</p>}</section>
    <section className="adm-panel"><h2>KYC</h2>{rows([["ID type", idTypeLabel(d.idType)], ["ID number", <span key="n" className="sa-id">{d.idNumber}</span>]])}</section>
    <Files files={d.files} onViewed={load} />
    <section className="adm-panel"><h2>History</h2><ul className="adm-list adm-audit">{d.events.map((e, i) => <li key={i}><span>{dateTime(e.createdAt)}</span><span>{eventText(e)}</span><span>{e.by ?? "Applicant"}</span></li>)}</ul></section>
  </>;
}

function Matches({ list }: { list: SellerMatch[] }) {
  return <div className="sa-matches" role="alert"><strong>⚠ Returning person</strong><ul>{list.map((m, i) => <li key={i}>{matchText(m)}{m.at ? ` · ${dateTime(m.at)}` : ""} · {m.applicationId ? <Link className="text-link" href={`/admin/seller?id=${encodeURIComponent(m.applicationId)}`}>Open {m.number}</Link> : <Link className="text-link" href={`/admin/user?id=${encodeURIComponent(m.userId)}`}>Open closed account</Link>}</li>)}</ul></div>;
}

// Nothing loads by itself: a file is read only when an admin clicks View or Download (each one = a history row).
function Files({ files, onViewed }: { files: SellerFile[]; onViewed: () => void }) {
  const [view, setView] = useState<{ url: string; type: string; name: string; text?: string } | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  useEffect(() => () => { if (view) URL.revokeObjectURL(view.url); }, [view]);
  useEffect(() => { if (!view) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setView(null); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [view]);
  const open = async (f: SellerFile, download: boolean) => {
    setError(""); setBusy(f.id); const r = await adminApi.sellerFile(f.id, download); setBusy("");
    if (!r.ok) return setError(r.error);
    const url = URL.createObjectURL(r.blob); onViewed();
    if (download) { const a = document.createElement("a"); a.href = url; a.download = r.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000); return; }
    setView({ url, type: r.blob.type, name: `${fileKindLabel(f.kind)} · ${f.name}`, text: r.blob.type.startsWith("text/") ? await r.blob.text() : undefined });
  };
  return <section className="adm-panel" aria-labelledby="sa-files-h"><h2 id="sa-files-h">Files ({files.length})</h2>
    <p className="muted-note">Private. Every View and Download is saved in the history with your name.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <ul className="sa-files">{files.map((f) => <li key={f.id}><span className="sa-kind">{fileKindLabel(f.kind)}</span><span className="sa-name">{f.name}</span><small>{f.mime === "application/pdf" ? "PDF" : "Image"} · {(f.size / 1024 / 1024).toFixed(2)} MB</small>
      <span className="sa-btns"><button type="button" className="btn btn-outline btn-sm" disabled={busy === f.id} onClick={() => open(f, false)}>View<span className="sr-only"> {fileKindLabel(f.kind)} {f.name}</span></button><button type="button" className="btn btn-outline btn-sm" disabled={busy === f.id} onClick={() => open(f, true)}>Download<span className="sr-only"> {f.name}</span></button></span></li>)}</ul>
    {view && <div className="sa-viewer" role="dialog" aria-modal="true" aria-label={view.name} onClick={() => setView(null)}>
      <div className="sa-viewer-bar" onClick={(e) => e.stopPropagation()}><span>{view.name}</span><button type="button" className="btn btn-outline btn-sm" onClick={() => setView(null)} autoFocus>Close</button></div>
      <div className="sa-viewer-body" onClick={(e) => e.stopPropagation()}>{view.text !== undefined ? <p className="sa-viewer-text">{view.text}</p> : view.type === "application/pdf" ? <iframe title={view.name} src={view.url} /> : <img src={view.url} alt={view.name} />}</div>
    </div>}
  </section>;
}

const LABEL: Record<SellerAction, string> = { approve: "Approve", reject: "Reject", blacklist: "Blacklist", unblacklist: "Remove from blacklist" };
function Actions({ d, onDone }: { d: SellerDetail; onDone: () => void }) {
  const [act, setAct] = useState<SellerAction | null>(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState("");
  const list: SellerAction[] = d.status === "pending" ? ["approve", "reject", "blacklist"] : d.status === "blacklisted" ? ["unblacklist"] : ["blacklist"];
  const go = async () => {
    setBusy(true); setError(""); const r = await adminApi.sellerAction(d.id, act!, reason); setBusy(false);
    if (r.ok) { setDone(`${LABEL[act!]}: saved.`); setAct(null); setReason(""); onDone(); } else setError(r.error);
  };
  return <section className="adm-panel" aria-labelledby="sa-act-h"><h2 id="sa-act-h">Decision</h2>
    {!act && <div className="adm-add-actions">{list.map((a) => <button key={a} type="button" className={`btn btn-sm ${a === "approve" ? "btn-primary" : a === "unblacklist" ? "btn-outline" : "btn-outline btn-danger"}`} onClick={() => { setAct(a); setDone(""); setError(""); }}>{LABEL[a]}{a !== "approve" ? "…" : ""}</button>)}</div>}
    {act && <div className="wal-confirm" role="alertdialog" aria-label={`Confirm ${LABEL[act].toLowerCase()}`}>
      <p>{act === "approve" ? `Approve ${d.number}? ${d.email} becomes a seller and gets an email.` : act === "reject" ? `Reject ${d.number}? The applicant sees the reason by email and on /sell and can apply again.` : act === "blacklist" ? `Blacklist ${d.number}? Only admins see the reason. A new sign-up or application with the same email, ID number or merchant name is flagged.${d.status === "approved" ? " The seller role is removed." : ""}` : `Remove ${d.number} from the blacklist? It goes back to ${d.status === "blacklisted" ? "its earlier status (an approved seller comes back as Rejected)" : ""}.`}</p>
      {act !== "approve" && <label className="field"><span>Reason (required)</span><input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} autoFocus /></label>}
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={go}>{busy ? "Saving…" : `Confirm ${LABEL[act].toLowerCase()}`}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setAct(null); setError(""); }}>Cancel</button></div>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    {done && <Notice tone="success">{done}</Notice>}
  </section>;
}

export default function AdminSellerPage() {
  return <AdminShell title="Seller application"><Suspense fallback={<p className="muted-note">Loading…</p>}><Detail /></Suspense></AdminShell>;
}
