"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { eventText, fileGroups, holdDate, holdLeft, holdPercent, matchText, mimeLabel, SELLER_STATUS_CHIP, SELLER_STATUS_LABEL, sellerTypeLabel, type SellerAction, type SellerDetail, type SellerFile, type SellerMatch } from "@/lib/sellers";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";
import { SellerAnswers } from "../../components/seller-answers";

// T3 one seller application on ONE page (screen 11, approved 2026-10-01): header + decision, every answer in labeled cards, returning-person
// matches, then every file the seller sent grouped by step (View / Download = audited; viewer with Previous / Next), then the history.
function Detail() {
  const [d, setD] = useState<SellerDetail | null>(null); const [error, setError] = useState(""); const [act, setAct] = useState<SellerAction | null>(null);
  const id = useSearchParams().get("id"); // a match link opens another application on this same page
  const load = useCallback(() => { if (!id) return setError("Missing application id."); setError(""); adminApi.seller(id).then((r) => (r.ok ? setD(r.seller) : setError(r.error))); }, [id]);
  useEffect(load, [load]);
  if (error) return <><Notice tone="error">{error}</Notice><Link className="text-link" href="/admin/sellers">← Seller applications</Link></>;
  if (!d) return <p className="muted-note">Loading…</p>;
  const app: [string, React.ReactNode][] = [
    ["Seller type", sellerTypeLabel(d.sellerType)],
    ["Account", <Link key="u" className="text-link" href={`/admin/user?id=${encodeURIComponent(d.userId)}`}>{d.email}</Link>],
    ["Submitted", dateTime(d.createdAt)],
    ["Decision", d.decidedAt ? `${SELLER_STATUS_LABEL[d.status]} ${dateTime(d.decidedAt)} by ${d.decidedBy ?? "—"}` : "Not decided yet"],
    ["Terms", d.termsVersion ? <span key="t"><span className="chip chip-green">✓ Agreed</span> version {d.termsVersion}{d.termsAcceptedAt ? ` · ${dateTime(d.termsAcceptedAt)}` : ""}</span> : "Older form (no terms tick)"],
    ["Details confirmed true", "Yes"],
    ...(d.sellerType === "business" ? [["Sales freeze", d.hold ? <HoldRow key="h" d={d} onRelease={() => setAct("release")} />
      : d.freeze ? <span key="f"><span className="chip chip-amber">{d.freeze}-day freeze</span> every supplier proof is a B2B invoice (starts when approved)</span> : "No"] as [string, React.ReactNode]] : []),
  ];
  return <>
    <p className="adm-back"><Link className="text-link" href={`/admin/sellers?tab=${d.tab}`}>← Seller applications</Link></p>
    <div className="adm-head sa-head"><h2>{d.number} · {d.merchantName}</h2><span className={`chip ${SELLER_STATUS_CHIP[d.status]}`}>{d.status === "pending" ? "Pending" : SELLER_STATUS_LABEL[d.status]}</span>
      <span className="chip chip-blue">{sellerTypeLabel(d.sellerType)}</span>{d.hold ? (d.hold.releasedAt ? <span className="chip chip-green">✓ Sales released</span> : <span className="chip chip-amber">⏱ Freeze · {holdLeft(d.hold.until)}</span>) : d.freeze > 0 && <span className="chip chip-amber">{d.freeze}-day freeze</span>}{d.accountClosed && <span className="chip chip-grey">Account closed</span>}</div>
    {d.reason && <Notice>Reject reason (the applicant sees it): “{d.reason}”</Notice>}
    {d.blacklistReason && d.status === "blacklisted" && <Notice tone="error">Blacklisted: “{d.blacklistReason}”</Notice>}
    <Actions d={d} onDone={load} act={act} setAct={setAct} />
    <SellerAnswers answers={d.answers} idNumber={<span className="sa-id">{d.idNumber}</span>} extra={app} />
    {d.matchList.length > 0 && <Matches list={d.matchList} />}
    <Files d={d} onViewed={load} />
    <section className="adm-panel"><h2>History</h2><ul className="adm-list adm-audit">{d.events.map((e, i) => <li key={i}><span>{dateTime(e.createdAt)}</span><span>{eventText(e)}</span><span>{e.by ?? (e.action === "freeze_released" ? "System" : "Applicant")}</span></li>)}</ul></section>
  </>;
}

function Matches({ list }: { list: SellerMatch[] }) {
  return <div className="sa-matches" role="alert"><strong>⚠ Returning person</strong><ul>{list.map((m, i) => <li key={i}>{matchText(m)}{m.at ? ` · ${dateTime(m.at)}` : ""} · {m.applicationId ? <Link className="text-link" href={`/admin/seller?id=${encodeURIComponent(m.applicationId)}`}>Open {m.number}</Link> : <Link className="text-link" href={`/admin/user?id=${encodeURIComponent(m.userId)}`}>Open closed account</Link>}</li>)}</ul></div>;
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
// Every file the seller sent, grouped by step (screen 11). Nothing loads by itself: a file is read only on View / Download / Previous / Next
// (each one = a history row with the admin's name).
function Files({ d, onViewed }: { d: SellerDetail; onViewed: () => void }) {
  const groups = fileGroups(d.answers, d.files);
  const order = groups.flatMap((g) => g.rows.filter((r) => r.file).map((r) => ({ group: g.title, doc: r.doc, file: r.file! })));
  const [at, setAt] = useState<number | null>(null); const [view, setView] = useState<{ url: string; type: string; text?: string } | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  useEffect(() => () => { if (view) URL.revokeObjectURL(view.url); }, [view]);
  const open = useCallback(async (n: number) => {
    const f = order[n]?.file; if (!f) return;
    setError(""); setBusy(f.id); const r = await adminApi.sellerFile(f.id, false); setBusy("");
    if (!r.ok) return setError(r.error);
    setAt(n); setView({ url: URL.createObjectURL(r.blob), type: r.blob.type, text: r.blob.type.startsWith("text/") ? await r.blob.text() : undefined }); onViewed();
  }, [order, onViewed]);
  const download = async (f: SellerFile) => {
    setError(""); setBusy(f.id); const r = await adminApi.sellerFile(f.id, true); setBusy("");
    if (!r.ok) return setError(r.error);
    const url = URL.createObjectURL(r.blob); const a = document.createElement("a"); a.href = url; a.download = r.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000); onViewed();
  };
  const close = () => { setAt(null); setView(null); };
  useEffect(() => {
    if (at === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight" && at < order.length - 1) open(at + 1); if (e.key === "ArrowLeft" && at > 0) open(at - 1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [at, order.length, open]);
  const cur = at !== null ? order[at] : null;
  return <section className="adm-panel" aria-labelledby="sa-files-h">
    <div className="sa-files-head"><h2 id="sa-files-h">Files ({d.files.length})</h2>{order.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => open(0)}>Open viewer from the first file</button>}</div>
    <p className="muted-note">Every file the seller uploaded and sent with this application. Each View / Download is written to History with your name and time (PDPA).</p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-table-wrap"><table className="adm-table sa-ftab"><thead><tr><th>Document</th><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th><span className="sr-only">Actions</span></th></tr></thead>
      {groups.map((g) => <tbody key={g.title}><tr className="sa-grp"><th colSpan={6} scope="rowgroup">{g.title}</th></tr>
        {g.rows.map((r, n) => r.file ? <tr key={r.file.id}><td data-l="Document">{r.doc}</td><td data-l="File" className="sa-name">{r.file.name}</td><td data-l="Type">{mimeLabel(r.file.mime)}</td><td data-l="Size">{mb(r.file.size)}</td><td data-l="Uploaded">{dateTime(r.file.createdAt)}</td>
          <td className="sa-btns"><button type="button" className="btn btn-outline btn-sm" disabled={busy === r.file.id} onClick={() => open(order.findIndex((o) => o.file.id === r.file!.id))}>View<span className="sr-only"> {r.doc} {r.file.name}</span></button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy === r.file.id} onClick={() => download(r.file!)}>Download<span className="sr-only"> {r.file.name}</span></button></td></tr>
          : <tr key={`none-${n}`} className="sa-none"><td data-l="Document">{r.doc}</td><td colSpan={5}>{r.optional ? "Not sent (optional)" : "Not sent"}</td></tr>)}
      </tbody>)}
    </table></div>
    {cur && view && <div className="sa-viewer" role="dialog" aria-modal="true" aria-label={`${cur.doc} · ${cur.file.name}`} onClick={close}>
      <div className="sa-viewer-bar" onClick={(e) => e.stopPropagation()}><span><strong>{cur.group} · {cur.doc}</strong> {cur.file.name} · {mb(cur.file.size)} · file {at! + 1} of {order.length}</span>
        <span className="sa-viewer-btns"><button type="button" className="btn btn-outline btn-sm" disabled={at === 0 || Boolean(busy)} onClick={() => open(at! - 1)}>‹ Previous</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={at === order.length - 1 || Boolean(busy)} onClick={() => open(at! + 1)}>Next ›</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => download(cur.file)}>Download</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={close} autoFocus>✕ Close</button></span></div>
      <div className="sa-viewer-body" onClick={(e) => e.stopPropagation()}>{view.text !== undefined ? <p className="sa-viewer-text">{view.text}</p> : view.type === "application/pdf" ? <iframe title={cur.file.name} src={view.url} /> : <img src={view.url} alt={`${cur.doc}: ${cur.file.name}`} />}</div>
    </div>}
  </section>;
}

const LABEL: Record<SellerAction, string> = { approve: "Approve", reject: "Reject", blacklist: "Blacklist", unblacklist: "Remove from blacklist", release: "Release now" };
// Sales freeze timer (screen 14): on hold until … + time left + bar + Release now; after the end "Released automatically / by …".
function HoldRow({ d, onRelease }: { d: SellerDetail; onRelease: () => void }) {
  const h = d.hold!; const [, tick] = useState(0);
  useEffect(() => { if (h.releasedAt) return; const t = setInterval(() => tick((x) => x + 1), 60_000); return () => clearInterval(t); }, [h.releasedAt]);
  if (h.releasedAt) return <span><span className="chip chip-green">✓ Released</span> {h.releasedBy ? "early by an admin" : "automatically"} {holdDate(h.releasedAt)}</span>;
  return <div className="sa-hold"><b>On hold until {holdDate(h.until)}</b> (Bangkok) · {holdLeft(h.until)}
    <div className="seller-bar sa-hold-bar" role="progressbar" aria-label="Sales freeze" aria-valuemin={0} aria-valuemax={100} aria-valuenow={holdPercent(h)}><i style={{ width: `${holdPercent(h)}%` }} /></div>
    <small>Reason: every supplier proof is a B2B invoice. Releases by itself; admins get a notice + email.</small>
    <button type="button" className="btn btn-outline btn-sm" onClick={onRelease}>Release now…</button></div>;
}
function Actions({ d, onDone, act, setAct }: { d: SellerDetail; onDone: () => void; act: SellerAction | null; setAct: (a: SellerAction | null) => void }) {
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState("");
  const list: SellerAction[] = d.status === "pending" ? ["approve", "reject", "blacklist"] : d.status === "blacklisted" ? ["unblacklist"] : d.hold && !d.hold.releasedAt ? ["release", "blacklist"] : ["blacklist"];
  const go = async () => {
    setBusy(true); setError(""); const r = await adminApi.sellerAction(d.id, act!, reason); setBusy(false);
    if (r.ok) { setDone(`${LABEL[act!]}: saved.`); setAct(null); setReason(""); onDone(); } else setError(r.error);
  };
  return <section className="adm-panel sa-decision" aria-labelledby="sa-act-h"><h2 id="sa-act-h">Decision</h2>
    {!act && <div className="adm-add-actions">{list.map((a) => <button key={a} type="button" className={`btn btn-sm ${a === "approve" ? "btn-primary" : a === "unblacklist" ? "btn-outline" : "btn-outline btn-danger"}`} onClick={() => { setAct(a); setDone(""); setError(""); }}>{LABEL[a]}{a !== "approve" ? "…" : ""}</button>)}</div>}
    {act && <div className="wal-confirm" role="alertdialog" aria-label={`Confirm ${LABEL[act].toLowerCase()}`}>
      <p>{act === "approve" ? `Approve ${d.number}? ${d.email} becomes a seller and gets an email.${d.freeze ? ` Sales are held ${d.freeze} days (invoice-only proof).` : ""}` : act === "release" ? `Release the sales hold on ${d.number} now? Do this when the seller looks complete and trustworthy. The seller gets the "sales open" email.` : act === "reject" ? `Reject ${d.number}? The applicant sees the reason by email and on /sell and can apply again.` : act === "blacklist" ? `Blacklist ${d.number}? Only admins see the reason. A new sign-up or application with the same email, ID number or merchant name is flagged.${d.status === "approved" ? " The seller role is removed." : ""}` : `Remove ${d.number} from the blacklist? It goes back to its earlier status (an approved seller comes back as Rejected).`}</p>
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
