"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, adminMarketApi } from "@/lib/client/api";
import type { Product } from "@/lib/catalog";
import { productTitle, reasonOk, REQUEST_EVENT_LABEL, REQUEST_STATUS_LABEL, REQUEST_TABS, searchSellable, type AdminRequestList, type AdminRequestRow, type RequestStatus } from "@/lib/marketplace";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice, readQuery } from "../../components/auth-ui";

// Seller marketplace step 3 (wireframe screen 7, section "products"): sellers ask for products that are not in the catalog yet.
// Waiting / Added / Rejected; Add product… (product editor pre-filled), Link to existing… (pick a published game key), Reject… (reason → seller).
// Add / link close every waiting request for the same product (name + platform + region) and email each seller. Every action is in the history.
type Panel = { id: string; kind: "link" | "reject" | "history" } | null;
const CHIP: Record<RequestStatus, string> = { waiting: "chip-amber", added: "chip-green", rejected: "chip-red" };

function Requests() {
  const router = useRouter();
  const [tab, setTab] = useState<RequestStatus>("waiting");
  const [data, setData] = useState<AdminRequestList | null>(null); const [error, setError] = useState(""); const [done, setDone] = useState(""); const [warn, setWarn] = useState(false);
  const [panel, setPanel] = useState<Panel>(null); const [reload, setReload] = useState(0);
  useEffect(() => {
    const t = readQuery("tab"); if (REQUEST_TABS.includes(t as RequestStatus)) setTab(t as RequestStatus);
    const saved = readQuery("saved"); if (saved) { setDone(saved); setWarn(readQuery("warn") === "1"); } // message from the product editor ("Add product…")
  }, []);
  // Only the newest tab may set the list (a slower answer for the old tab must not win).
  useEffect(() => {
    let live = true;
    adminMarketApi.requests(tab).then((r) => { if (!live) return; if (r.ok) { setData(r.data); setError(""); } else setError(r.error); });
    return () => { live = false; };
  }, [tab, reload]);
  const pick = (t: RequestStatus) => { setTab(t); setPanel(null); router.replace(`/admin/product-requests?tab=${t}`); };
  const decided = (text: string) => { setDone(text); setWarn(false); setPanel(null); setReload((n) => n + 1); };
  const toggle = (id: string, kind: "link" | "reject" | "history") => { setDone(""); setPanel((p) => (p?.id === id && p.kind === kind ? null : { id, kind })); };

  return <>
    <div className="adm-head"><span>Sellers ask for products that are not in the catalog yet. Adding a product closes every waiting request for it and emails each seller.</span></div>
    <div className="dash-tabs adm-tabs" role="tablist" aria-label="Request status">{REQUEST_TABS.map((t) => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => pick(t)}>{REQUEST_STATUS_LABEL[t]}{data && <small className="adm-tab-n">{data.counts[t]}</small>}</button>)}</div>
    {done && (warn ? <Notice>{done}</Notice> : <Notice tone="success">{done}</Notice>)}
    {error && <Notice tone="error">{error}</Notice>}
    {!data ? <p className="muted-note">Loading…</p> : !data.rows.length ? <p className="empty">No {REQUEST_STATUS_LABEL[tab].toLowerCase()} requests.</p> :
      <div className="adm-table-wrap"><table className="adm-table pr-table">
        <thead><tr><th>No.</th><th>Seller</th><th>Product asked</th><th>Link / note</th><th>Same name requested by</th><th>Date</th><th>{tab === "waiting" ? <span className="sr-only">Actions</span> : "Result"}</th></tr></thead>
        <tbody>{data.rows.map((r) => <RequestRows key={r.id} r={r} panel={panel?.id === r.id ? panel.kind : null} toggle={toggle} onDone={decided} />)}</tbody>
      </table></div>}
  </>;
}

function RequestRows({ r, panel, toggle, onDone }: { r: AdminRequestRow; panel: "link" | "reject" | "history" | null; toggle: (id: string, k: "link" | "reject" | "history") => void; onDone: (t: string) => void }) {
  const sellers = r.same.sellers.filter((s) => s !== r.seller.name).length + 1;
  return <>
    <tr data-request={r.number}>
      <td><strong>{r.number}</strong><small><span className={`chip ${CHIP[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span></small></td>
      <td>{r.seller.name}{r.seller.verified && <> <span className="sl-tick" title="Verified seller" aria-label="Verified seller">✓</span></>}<small>{r.seller.email}</small></td>
      <td><b>{r.name}</b><small>{[r.platform, r.region.toUpperCase(), r.edition].filter(Boolean).join(" · ")}</small></td>
      <td className="pr-link">{r.link ? <a className="text-link" href={r.link} target="_blank" rel="noopener noreferrer nofollow">{hostOf(r.link)}</a> : !r.note && "—"}{r.note && <small>“{r.note}”</small>}</td>
      <td title={r.same.numbers.length ? `Also ${r.same.numbers.join(", ")}` : undefined}>{sellers} seller{sellers > 1 ? "s" : ""}{r.same.numbers.length > 0 && <small>Also {r.same.numbers.join(", ")}</small>}{r.same.otherVariants > 0 && <small>+{r.same.otherVariants} on another platform / region</small>}</td>
      <td>{dateTime(r.createdAt)}</td>
      <td className="pr-actions">
        {r.status === "waiting" ? <div className="adm-add-actions">
          <Link className="btn btn-primary btn-sm" href={`/admin/products/edit?request=${encodeURIComponent(r.id)}`}>Add product…<span className="sr-only"> {r.number}</span></Link>
          <button type="button" className="btn btn-outline btn-sm" aria-expanded={panel === "link"} onClick={() => toggle(r.id, "link")}>Link to existing…<span className="sr-only"> {r.number}</span></button>
          <button type="button" className="btn btn-outline btn-danger btn-sm" aria-expanded={panel === "reject"} onClick={() => toggle(r.id, "reject")}>Reject…<span className="sr-only"> {r.number}</span></button>
        </div> : r.status === "added" ? <>{r.productId && <Link className="text-link" href={`/admin/products/edit?id=${encodeURIComponent(r.productId)}`}>{r.productId}</Link>}<small>{r.decidedBy ?? "—"}{r.decidedAt ? ` · ${dateTime(r.decidedAt)}` : ""}</small></>
          : <><span className="pr-reason">{r.reason}</span><small>{r.decidedBy ?? "—"}{r.decidedAt ? ` · ${dateTime(r.decidedAt)}` : ""}</small></>}
        <button type="button" className="text-link pr-hist-btn" aria-expanded={panel === "history"} onClick={() => toggle(r.id, "history")}>History ({r.events.length})<span className="sr-only"> {r.number}</span></button>
      </td>
    </tr>
    {panel && <tr className="pr-panel"><td colSpan={7}>
      {panel === "history" ? <History r={r} /> : panel === "link" ? <LinkPanel r={r} onDone={onDone} onCancel={() => toggle(r.id, "link")} /> : <RejectPanel r={r} onDone={onDone} onCancel={() => toggle(r.id, "reject")} />}
    </td></tr>}
  </>;
}
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "link"; } };

function History({ r }: { r: AdminRequestRow }) {
  return <section aria-label={`History of ${r.number}`}><h3 className="pr-h">History of {r.number}</h3>
    <ul className="adm-list adm-audit">{r.events.map((e, i) => <li key={i}><span>{dateTime(e.createdAt)}</span><span>{REQUEST_EVENT_LABEL[e.action] ?? e.action}{e.detail ? `: ${e.detail}` : ""}</span><span>{e.by ?? "Seller"}</span></li>)}</ul></section>;
}

// Closes this request + the other waiting ones for the same product (the confirm text names them).
const alsoText = (r: AdminRequestRow) => (r.same.numbers.length ? ` This also closes ${r.same.numbers.join(", ")} (same product) and emails ${r.same.numbers.length + 1} sellers.` : " The seller gets an email with “Sell it ›”.");

function LinkPanel({ r, onDone, onCancel }: { r: AdminRequestRow; onDone: (t: string) => void; onCancel: () => void }) {
  const [all, setAll] = useState<Product[] | null>(null); const [q, setQ] = useState(r.name); const [chosen, setChosen] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { adminApi.products().then((x) => { if (x.ok) setAll(x.products.filter((p) => p.status !== "draft")); else setError(x.error); }); }, []);
  const hits = useMemo(() => (all && q.trim() ? searchSellable(all, q, 8) : []), [all, q]);
  const go = useCallback(async () => {
    if (!chosen) return; setBusy(true); setError("");
    const x = await adminMarketApi.decideRequest(r.id, { action: "link", productId: chosen.id }); setBusy(false);
    if (x.ok) onDone(`${x.closed.join(", ")} linked to ${productTitle(chosen)}. Seller${x.closed.length > 1 ? "s" : ""} emailed.`); else setError(x.error);
  }, [chosen, r.id, onDone]);
  return <div className="wal-confirm pr-confirm" role="group" aria-label={`Link ${r.number} to an existing product`}>
    <p>The product is already in the catalog under another name? Pick it (published game keys only).{alsoText(r)}</p>
    <label className="field"><span>Search the catalog</span><input type="search" value={q} onChange={(e) => { setQ(e.target.value); setChosen(null); }} autoFocus /></label>
    {!all ? <p className="muted-note">Loading products…</p> : !hits.length ? <p className="muted-note">No game key matches. Try another name, or use Add product….</p> :
      <ul className="pr-hits" aria-label="Matching products">{hits.map((p) => <li key={p.id}><label><input type="radio" name={`pr-pick-${r.id}`} checked={chosen?.id === p.id} onChange={() => setChosen(p)} /> {productTitle(p)} <small>{p.id}</small></label></li>)}</ul>}
    {error && <Notice tone="error">{error}</Notice>}
    <div><button type="button" className="btn btn-primary btn-sm" disabled={busy || !chosen} onClick={go}>{busy ? "Saving…" : "Confirm link"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </div>;
}

function RejectPanel({ r, onDone, onCancel }: { r: AdminRequestRow; onDone: (t: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const go = async () => {
    if (!reasonOk(reason)) { setError("Write a reason (3–300 characters). The seller sees it."); return; }
    setBusy(true); setError(""); const x = await adminMarketApi.decideRequest(r.id, { action: "reject", reason }); setBusy(false);
    if (x.ok) onDone(`${r.number} rejected. The seller was emailed the reason.`); else setError(x.error);
  };
  return <div className="wal-confirm pr-confirm" role="group" aria-label={`Reject ${r.number}`}>
    <p>Reject {r.number} ({r.name})? The seller sees the reason on My requests and by email. Other requests for the same product stay open.</p>
    <label className="field"><span>Reason (required, the seller sees it)</span><textarea value={reason} maxLength={300} rows={3} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
    <small className="muted-note">{reason.trim().length} / 300</small>
    {error && <Notice tone="error">{error}</Notice>}
    <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={go}>{busy ? "Saving…" : "Confirm reject"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </div>;
}

export default function AdminProductRequestsPage() {
  return <AdminShell title="Product requests"><Requests /></AdminShell>;
}
