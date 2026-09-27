"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import { discountLabel, promoStatus, scopeLabel, type PromoCode, type PromoStatus } from "@/lib/promo";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Admin promo codes list (Handoff v12 step 3b): search, status filter, table, row menu (Edit, Duplicate, Disable/Enable, Delete with confirm).
const thb = (m: number) => money(m, "THB");
const PROMO_CHIP: Record<PromoStatus, [string, string]> = { active: ["chip-green", "Active"], scheduled: ["chip-blue", "Scheduled"], expired: ["", "Expired"], used_up: ["", "Used up"], disabled: ["", "Disabled"] };
const FILTERS: { id: "" | PromoStatus; label: string }[] = [{ id: "", label: "All" }, { id: "active", label: "Active" }, { id: "scheduled", label: "Scheduled" }, { id: "expired", label: "Expired" }, { id: "disabled", label: "Disabled" }];
const matches = (f: "" | PromoStatus, s: PromoStatus) => !f || f === s || (f === "expired" && s === "used_up");

function RowMenu({ p, onToggle, onDelete }: { p: PromoCode; onToggle: () => void; onDelete: () => void }) {
  const router = useRouter(); const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");
  useEffect(() => {
    const out = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && ref.current?.open) { close(); ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("click", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", out); document.removeEventListener("keydown", esc); };
  }, []);
  const go = (fn: () => void) => () => { close(); fn(); };
  return <details className="pc-menu" ref={ref}>
    <summary aria-label={`Actions for ${p.code}`}>⋯</summary>
    <div className="pc-menu-list">
      <button type="button" onClick={go(() => router.push(`/admin/promo-codes/edit?id=${encodeURIComponent(p.id)}`))}>Edit</button>
      <button type="button" onClick={go(() => router.push(`/admin/promo-codes/edit?from=${encodeURIComponent(p.id)}`))}>Duplicate</button>
      <button type="button" onClick={go(onToggle)}>{p.enabled ? "Disable" : "Enable"}</button>
      <button type="button" className="pc-danger" onClick={go(onDelete)}>Delete</button>
    </div>
  </details>;
}

function ConfirmDelete({ p, onCancel, onConfirm }: { p: PromoCode; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="pc-dialog" ref={ref} aria-labelledby="pc-del-h" onClose={onCancel}>
    <h2 id="pc-del-h">Delete {p.code}?</h2>
    <p>Carts using it lose the discount. This cannot be undone.</p>
    <div className="gc-actions"><button type="button" className="btn btn-outline" onClick={onCancel} autoFocus>Cancel</button><button type="button" className="btn pc-btn-danger" onClick={onConfirm}>Delete</button></div>
  </dialog>;
}

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } };
  return <button type="button" className="pc-copy" onClick={copy} aria-label={`Copy ${code}`}>{done ? "Copied ✓" : "Copy"}</button>;
}

function PromoCodes() {
  const [promos, setPromos] = useState<PromoCode[] | null>(null); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const [q, setQ] = useState(""); const [filter, setFilter] = useState<"" | PromoStatus>(""); const [deleting, setDeleting] = useState<PromoCode | null>(null);
  const load = useCallback(async () => { const r = await adminApi.promoCodes(); if (r.ok) setPromos(r.promos); else setError(r.error); }, []);
  useEffect(() => { load(); setSaved(new URLSearchParams(window.location.search).get("saved") ?? ""); }, [load]);
  const toggle = async (p: PromoCode) => { setError(""); setSaved(""); const r = await adminApi.setPromoEnabled(p.id, !p.enabled); if (!r.ok) setError(r.error); else setSaved(`${p.code} ${p.enabled ? "disabled" : "enabled"}.`); await load(); };
  const remove = async (p: PromoCode) => { setDeleting(null); setError(""); setSaved(""); const r = await adminApi.deletePromo(p.id); if (!r.ok) setError(r.error); else setSaved(`${p.code} deleted.`); await load(); };
  const now = Date.now(); const query = q.trim().toUpperCase();
  const rows = (promos ?? []).filter((p) => matches(filter, promoStatus(p, now)) && (!query || p.code.includes(query)));
  const count = (f: "" | PromoStatus) => (promos ?? []).filter((p) => matches(f, promoStatus(p, now))).length;
  return <>
    <div className="pc-top"><p className="adm-count">Codes customers type in the cart. Every setting except code and discount is optional.</p><Link className="btn btn-primary" href="/admin/promo-codes/edit">Create promo code</Link></div>
    {saved && <Notice tone="success">{saved}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Search codes" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="seg pc-seg" role="group" aria-label="Filter by status">{FILTERS.map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} <span className="seg-count">{count(f.id)}</span></button>)}</div>
    </div>
    {!promos ? !error && <p className="muted-note">Loading…</p> : !rows.length ? <div className="adm-panel pc-empty"><strong>{promos.length ? "No promo codes match." : "No promo codes yet"}</strong>{!promos.length && <p>Create a code like SAVE10 for 10% off, or ฿200 off orders over ฿1,000.</p>}</div>
      : <div className="adm-table-wrap pc-wrap"><table className="adm-table static pc-table">
        <thead><tr><th>Code</th><th>Discount</th><th>Applies to</th><th>Min order</th><th className="num">Uses</th><th>Active dates</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{rows.map((p) => { const st = promoStatus(p, now); return <tr key={p.id}>
          <td><span className="pc-code"><Link href={`/admin/promo-codes/edit?id=${encodeURIComponent(p.id)}`}><strong>{p.code}</strong></Link><CopyCode code={p.code} /></span></td>
          <td>{discountLabel(p, thb)}{p.type === "percent" && p.maxDiscount ? <small>max {thb(p.maxDiscount)}</small> : null}</td>
          <td className="pc-scope">{scopeLabel(p)}</td>
          <td>{p.minSubtotal ? thb(p.minSubtotal) : "—"}</td>
          <td className="num">{p.uses} / {p.maxUses ?? "∞"}{p.oncePerCustomer && <small>1 per customer</small>}</td>
          <td>{dateTime(p.startsAt)}<small>{p.expiresAt ? `to ${dateTime(p.expiresAt)}` : "No end date"}</small></td>
          <td><span className={`chip ${PROMO_CHIP[st][0]}`}>{PROMO_CHIP[st][1]}</span></td>
          <td><RowMenu p={p} onToggle={() => toggle(p)} onDelete={() => setDeleting(p)} /></td>
        </tr>; })}</tbody>
      </table></div>}
    {deleting && <ConfirmDelete p={deleting} onCancel={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
  </>;
}

export default function Page() { return <AdminShell title="Promo codes"><PromoCodes /></AdminShell>; }
