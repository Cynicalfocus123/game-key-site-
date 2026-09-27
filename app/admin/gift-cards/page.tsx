"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import { giftCardStatus, MAX_CREATE, maskedCode, type GiftCard, type GiftCardStatus } from "@/lib/gift-cards";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Admin gift cards (Handoff v12 step 3): create (codes shown once), list, disable / enable. Amounts are THB; customers see them converted.
const CHIP: Record<GiftCardStatus, [string, string]> = { active: ["chip-green", "Active"], redeemed: ["chip-blue", "Redeemed"], expired: ["chip-grey", "Expired"], disabled: ["chip-grey", "Disabled"] };
const thb = (minor: number) => money(minor, "THB");

function CreateForm({ onCreated }: { onCreated: (codes: string[]) => void }) {
  const [amount, setAmount] = useState("500"); const [count, setCount] = useState("1"); const [expires, setExpires] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const baht = Number(amount); if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !baht) { setError("Enter an amount in baht, e.g. 500."); return; }
    setBusy(true);
    // Expiry = end of the chosen day, Bangkok time.
    const r = await adminApi.createGiftCards({ amountMinor: Math.round(baht * 100), count: Number(count), expiresAt: expires ? new Date(`${expires}T23:59:59+07:00`).toISOString() : null, note: note.trim() || null });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onCreated(r.created.map((c) => c.code)); setNote("");
  };
  return <form className="adm-panel gc-form" onSubmit={submit} noValidate>
    <h2>Create gift cards</h2>
    <div className="gc-fields">
      <label className="field"><span>Amount (THB)</span><input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      <label className="field"><span>How many</span><input name="count" type="number" min={1} max={MAX_CREATE} value={count} onChange={(e) => setCount(e.target.value)} /></label>
      <label className="field"><span>Expires (optional)</span><input name="expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /><small>End of day, Bangkok time</small></label>
      <label className="field gc-note"><span>Note (optional)</span><input name="note" maxLength={120} placeholder="e.g. Giveaway September" value={note} onChange={(e) => setNote(e.target.value)} /></label>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create gift cards"}</button>
  </form>;
}

function NewCodes({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(codes.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select the list by hand */ } };
  return <section className="adm-panel gc-new" aria-labelledby="gc-new-h">
    <h2 id="gc-new-h">{codes.length} new gift card{codes.length === 1 ? "" : "s"}</h2>
    <Notice tone="success">Copy the codes now. Only the last 4 characters are kept, so they cannot be shown again.</Notice>
    <ul className="gc-codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
    <div className="gc-actions"><button type="button" className="btn btn-primary" onClick={copy}>{copied ? "Copied ✓" : codes.length === 1 ? "Copy code" : "Copy all"}</button><button type="button" className="btn btn-outline" onClick={onClose}>Done</button></div>
  </section>;
}

function GiftCards() {
  const [cards, setCards] = useState<GiftCard[] | null>(null); const [error, setError] = useState(""); const [codes, setCodes] = useState<string[]>([]);
  const [q, setQ] = useState(""); const [filter, setFilter] = useState<"" | GiftCardStatus>("");
  const load = useCallback(async () => { const r = await adminApi.giftCards(); if (r.ok) setCards(r.cards); else setError(r.error); }, []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (c: GiftCard) => { setError(""); const r = await adminApi.setGiftCardDisabled(c.id, !c.disabled); if (!r.ok) setError(r.error); await load(); };
  const query = q.trim().toLowerCase();
  const rows = (cards ?? []).filter((c) => (!filter || giftCardStatus(c) === filter) && (!query || c.last4.toLowerCase().includes(query) || (c.note ?? "").toLowerCase().includes(query) || (c.redeemedBy ?? "").toLowerCase().includes(query)));
  const count = (s: GiftCardStatus) => (cards ?? []).filter((c) => giftCardStatus(c) === s).length;
  return <>
    <CreateForm onCreated={(c) => { setCodes(c); load(); }} />
    {codes.length > 0 && <NewCodes codes={codes} onClose={() => setCodes([])} />}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Last 4, note or customer email" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label className="field"><span>Status</span><select value={filter} onChange={(e) => setFilter(e.target.value as "" | GiftCardStatus)}>
        <option value="">All ({cards?.length ?? 0})</option>{(Object.keys(CHIP) as GiftCardStatus[]).map((s) => <option key={s} value={s}>{CHIP[s][1]} ({count(s)})</option>)}
      </select></label>
    </div>
    {!cards ? !error && <p className="muted-note">Loading…</p> : !rows.length ? <p className="empty">{cards.length ? "No gift cards match." : "No gift cards yet."}</p> : <div className="adm-table-wrap"><table className="adm-table static gc-table">
      <thead><tr><th>Code</th><th className="num">Amount</th><th>Status</th><th>Note</th><th>Created</th><th>Expires</th><th>Redeemed by</th><th><span className="sr-only">Action</span></th></tr></thead>
      <tbody>{rows.map((c) => { const st = giftCardStatus(c); return <tr key={c.id}>
        <td><code>{maskedCode(c.last4)}</code></td>
        <td className="num">{thb(c.amountMinor)}</td>
        <td><span className={`chip ${CHIP[st][0]}`}>{CHIP[st][1]}</span></td>
        <td className="gc-note-cell">{c.note ?? "—"}</td>
        <td>{dateTime(c.createdAt)}</td>
        <td>{c.expiresAt ? dateTime(c.expiresAt) : "Never"}</td>
        <td>{c.redeemedBy ? <>{c.redeemedBy}<small>{dateTime(c.redeemedAt)}</small></> : "—"}</td>
        <td>{!c.redeemedAt && <button type="button" className="btn btn-outline btn-sm" onClick={() => toggle(c)}>{c.disabled ? "Enable" : "Disable"}<span className="sr-only"> card ending {c.last4}</span></button>}</td>
      </tr>; })}</tbody>
    </table></div>}
  </>;
}

export default function Page() { return <AdminShell title="Gift cards"><GiftCards /></AdminShell>; }
