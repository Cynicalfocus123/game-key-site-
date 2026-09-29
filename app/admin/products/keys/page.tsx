"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi, dateText } from "@/lib/client/api";
import type { Product } from "@/lib/catalog";
import { KEYS_PER_UPLOAD, maskKey, parseKeyText, type KeyInventory } from "@/lib/key-inventory";
import { AdminShell } from "../../../components/admin-shell";
import { Notice } from "../../../components/auth-ui";
import { assetPath } from "../../../components/cart-ui";

// Game key inventory for one product (task B): counts, paste or CSV upload, list with the last 4 characters only, remove available keys.
const STATUS_CHIP = { available: ["chip-green", "Available"], reserved: ["chip-amber", "Reserved"], sold: ["", "Sold"] } as const;

function Keys() {
  const [pid, setPid] = useState(""); const [p, setP] = useState<Product | null>(null); const [inv, setInv] = useState<KeyInventory | null>(null);
  const [text, setText] = useState(""); const [batch, setBatch] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [done, setDone] = useState("");
  const load = useCallback(async (id: string) => { const r = await adminApi.keyInventory(id); if (r.ok) setInv(r.inventory); else setError(r.error); }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? ""; setPid(id);
    adminApi.product(id).then((r) => { if (r.ok) { setP(r.product); load(id); } else setError(r.error); });
  }, [load]);
  const preview = parseKeyText(text);
  const readFile = (f: File | undefined) => { if (!f) return; if (f.size > 200_000) { setError("CSV file is too big (up to 200 KB)."); return; } f.text().then((t) => { setText(t); setError(""); }); };
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setDone(""); setBusy(true);
    const r = await adminApi.addKeys(pid, text, batch); setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    const { added, duplicates, invalid } = r.result;
    setDone(`Added ${added} ${added === 1 ? "key" : "keys"}.${duplicates ? ` ${duplicates} already added (skipped).` : ""}${invalid.length ? ` ${invalid.length} not valid (skipped): ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}` : ""}`);
    setText(""); setBatch(""); await load(pid);
  };
  const remove = async (keyId: string, last4: string) => {
    if (!window.confirm(`Remove key ${maskKey(last4)}?`)) return;
    setError(""); setDone(""); const r = await adminApi.removeKey(pid, keyId); if (!r.ok) setError(r.error); else { setDone(`Removed key ${maskKey(last4)}.`); await load(pid); }
  };
  if (!p) return error ? <Notice tone="error">{error}</Notice> : <p className="muted-note">Loading…</p>;
  if (p.kind !== "game_key") return <Notice tone="error">Keys can only be added to game keys.</Notice>;
  return <>
    <p className="adm-back"><Link className="text-link" href="/admin/products">‹ Products</Link></p>
    <div className="keyinv-head"><img src={assetPath(p.image)} alt="" width={48} height={60} /><div><strong>{p.name}</strong><small>{p.platform} · {p.region} · {p.id}</small></div>
      <Link className="text-link" href={`/admin/products/edit?id=${encodeURIComponent(p.id)}`}>Edit product</Link></div>
    {done && <Notice tone="success">{done}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="keyinv-counts">{(["available", "reserved", "sold"] as const).map((k) => <div key={k} className="adm-panel"><span>{STATUS_CHIP[k][1]}</span><strong>{inv?.counts[k] ?? "…"}</strong></div>)}</div>
    <form className="adm-panel keyinv-add" onSubmit={add}>
      <h2>Add keys</h2>
      <label className="field" htmlFor="keys-text">Keys (one per line, or a CSV with the key in the first column)</label>
      <textarea id="keys-text" rows={6} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} placeholder={"AAAAA-BBBBB-CCCCC\nDDDDD-EEEEE-FFFFF"} />
      <div className="keyinv-row">
        <label className="btn btn-outline btn-sm imgc-file">Choose CSV file<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => readFile(e.target.files?.[0])} /></label>
        <label className="field keyinv-batch">Batch name (optional)<input value={batch} maxLength={40} placeholder="e.g. Supplier A · Sep 2026" onChange={(e) => setBatch(e.target.value)} /></label>
      </div>
      <small className="muted-note" aria-live="polite">{text.trim() ? `${preview.codes.length} keys ready${preview.duplicates ? ` · ${preview.duplicates} repeated` : ""}${preview.invalid.length ? ` · ${preview.invalid.length} not valid` : ""}` : `Up to ${KEYS_PER_UPLOAD} keys per upload. Keys are stored encrypted; only the last 4 characters are shown here.`}</small>
      <button className="btn btn-primary" disabled={busy || !preview.codes.length}>{busy ? "Adding…" : `Add ${preview.codes.length || ""} keys`.replace("  ", " ")}</button>
    </form>
    {inv && (inv.keys.length ? <div className="adm-table-wrap"><table className="adm-table static keyinv-table">
      <thead><tr><th>Key</th><th>Status</th><th>Batch</th><th>Added</th><th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{inv.keys.map((k) => <tr key={k.id}><td className="keyinv-code">{maskKey(k.last4)}</td><td><span className={`chip ${STATUS_CHIP[k.status][0]}`}>{STATUS_CHIP[k.status][1]}</span></td>
        <td>{k.batch ?? "—"}</td><td>{dateText(k.createdAt)}</td>
        <td>{k.status === "available" && <button type="button" className="pc-danger keyinv-rm" onClick={() => remove(k.id, k.last4)} aria-label={`Remove key ${maskKey(k.last4)}`}>Remove</button>}</td></tr>)}</tbody>
    </table></div> : <div className="adm-panel pc-empty"><strong>No keys yet</strong><p>Paste keys above or choose a CSV file.</p></div>)}
  </>;
}

export default function Page() { return <AdminShell title="Game keys"><Keys /></AdminShell>; }
