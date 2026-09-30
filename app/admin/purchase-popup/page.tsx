"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";
import { adminApi } from "@/lib/client/api";
import { RECENT_HOURS, type PopupEvent, type PopupSettings } from "@/lib/purchase-popup";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Purchase popup settings (wireframe approved 2026-09-30). On / off + products that never show. Save = one audit row (who, when, what).
// Access: the "Products + key inventory" admin section.
const typeOf = (p: Product) => p.type ?? (p.kind === "hardware" ? "Hardware" : "Game");
const same = (a: PopupSettings, b: PopupSettings) => a.enabled === b.enabled && a.hidden.length === b.hidden.length && a.hidden.every((x) => b.hidden.includes(x));

function PurchasePopupAdmin() {
  const [saved, setSaved] = useState<PopupSettings | null>(null); const [draft, setDraft] = useState<PopupSettings | null>(null);
  const [history, setHistory] = useState<PopupEvent[]>([]); const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false); const [q, setQ] = useState("");
  useEffect(() => {
    adminApi.purchasePopup().then((r) => { if (r.ok) { setSaved(r.settings); setDraft(r.settings); setHistory(r.history); } else setError(r.error); });
    adminApi.products().then((r) => { if (r.ok) setProducts(r.products); });
  }, []);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const query = q.trim().toLowerCase();
  const matches = useMemo(() => (!query || !draft ? [] : products.filter((p) => !draft.hidden.includes(p.id) && (p.name.toLowerCase().includes(query) || typeOf(p).toLowerCase().includes(query))).slice(0, 8)), [products, query, draft]);
  if (!draft || !saved) return error ? <Notice tone="error">{error}</Notice> : <p className="muted-note">Loading…</p>;
  const dirty = !same(draft, saved);
  const change = (next: PopupSettings) => { setOk(""); setDraft(next); };
  const save = async () => {
    setBusy(true); setError(""); setOk(""); const r = await adminApi.savePurchasePopup(draft); setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setSaved(r.settings); setDraft(r.settings); setHistory(r.history); setOk("Saved. The store shows the change within a few seconds.");
  };
  return <div className="pp-admin">
    <p className="muted-note">“Someone just purchased” box on the store. Only real paid orders from buyer accounts in the last {RECENT_HOURS} hours.</p>
    {error && <Notice tone="error">{error}</Notice>}
    {ok && <Notice tone="success">{ok}</Notice>}
    <section className="adm-panel" aria-labelledby="pp-show">
      <h2 id="pp-show">Show the popup</h2>
      <div className="pp-switch-row">
        <button type="button" role="switch" aria-checked={draft.enabled} aria-labelledby="pp-show" className={`adm-switch${draft.enabled ? " on" : ""}`} onClick={() => change({ ...draft, enabled: !draft.enabled })}><i /></button>
        <span><b>{draft.enabled ? "On" : "Off"}</b> — {draft.enabled ? "visitors see recent purchases (bottom-left, about 6 seconds each)" : "no popup on the store"}</span>
      </div>
      <p className="muted-note">Shows: product image and name, time, and the country saved in the buyer’s account. Never the buyer’s name, email or order number. Never on cart, checkout, payment, account or sign-in pages.</p>
    </section>
    <section className="adm-panel" aria-labelledby="pp-hidden">
      <h2 id="pp-hidden">Hidden products</h2>
      <label className="field"><span>Search products to hide</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or type, e.g. Gift card" /></label>
      {query && <ul className="pp-matches" aria-label="Matching products">
        {matches.length ? matches.map((p) => <li key={p.id}><span>{p.name} <small className="chip chip-grey">{typeOf(p)}</small></span>
          <button type="button" className="btn btn-outline btn-sm" aria-label={`Hide ${p.name}`} onClick={() => change({ ...draft, hidden: [...draft.hidden, p.id] })}>Hide</button></li>)
          : <li className="muted-note">No matching products.</li>}
      </ul>}
      {draft.hidden.length ? <div className="adm-table-wrap"><table className="adm-table static pp-table">
        <thead><tr><th scope="col">Product</th><th scope="col">Type</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{draft.hidden.map((pid) => { const p = byId.get(pid); return <tr key={pid}>
          <td className="pp-name">{p?.name ?? pid}</td><td>{p ? <span className="chip chip-grey">{typeOf(p)}</span> : "—"}</td>
          <td><button type="button" className="text-link as-link" aria-label={`Show ${p?.name ?? pid} again`} onClick={() => change({ ...draft, hidden: draft.hidden.filter((x) => x !== pid) })}>Show again</button></td></tr>; })}</tbody>
      </table></div> : <p className="muted-note">No hidden products. Every product can show.</p>}
      <p className="muted-note">Hidden products never appear in the popup. Every saved change is kept in the history below (who, when, what).</p>
    </section>
    <div className="pp-save">
      {dirty && <span className="muted-note">Unsaved changes</span>}
      <button type="button" className="btn btn-outline" disabled={!dirty || busy} onClick={() => { setDraft(saved); setOk(""); }}>Discard</button>
      <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
    </div>
    <section className="adm-panel" aria-labelledby="pp-history">
      <h2 id="pp-history">History</h2>
      {history.length ? <ul className="pp-history">{history.map((h, i) => <li key={`${h.at}-${i}`}><time>{dateTime(h.at)}</time> <b>{h.by ?? "Deleted admin"}</b> <span>{h.detail}</span></li>)}</ul>
        : <p className="muted-note">No changes yet.</p>}
    </section>
  </div>;
}

export default function AdminPurchasePopupPage() {
  return <AdminShell title="Purchase popup"><PurchasePopupAdmin /></AdminShell>;
}
