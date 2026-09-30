"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { charges, FEE_LIMITS, pctText, type FeeEvent, type FeeSettings } from "@/lib/fees";
import { COUNTRY_CODES } from "@/lib/currency/currencies";
import { countryName } from "@/lib/profile";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Fees & tax (task 7, user 2026-09-30): one service fee for every product + sales tax added on top of the price (default rate + per billing
// country). Both start off; the admin switches them on. The server adds them to the order total; old orders keep what they were charged.
// Access: admin section "fees". Every save = one audit row (who, when, what).
type Draft = { feeEnabled: boolean; pct: string; fixed: string; min: string; taxEnabled: boolean; def: string; rates: { country: string; pct: string }[] };
const bpText = (bp: number) => String(bp / 100);
const thbText = (m: number) => (m / 100).toFixed(2);
const toDraft = (s: FeeSettings): Draft => ({ feeEnabled: s.feeEnabled, pct: bpText(s.feePercentBp), fixed: thbText(s.feeFixedMinor), min: thbText(s.feeMinMinor),
  taxEnabled: s.taxEnabled, def: bpText(s.taxDefaultBp), rates: s.taxRates.map((r) => ({ country: r.country, pct: bpText(r.rateBp) })) });
const num = (v: string) => { const t = v.trim().replace(",", "."); return /^\d+(\.\d{0,2})?$/.test(t) ? Math.round(Number(t) * 100) : NaN; }; // 7.5 → 750 (bp or satang)
const fromDraft = (d: Draft) => ({ feeEnabled: d.feeEnabled, feePercentBp: num(d.pct), feeFixedMinor: num(d.fixed), feeMinMinor: num(d.min),
  taxEnabled: d.taxEnabled, taxDefaultBp: num(d.def), taxRates: d.rates.map((r) => ({ country: r.country, rateBp: num(r.pct) })) });
const baht = (m: number) => `฿${(m / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <div className="pp-switch-row"><button type="button" role="switch" aria-checked={on} aria-label={label} className={`adm-switch${on ? " on" : ""}`} onClick={onChange}><i /></button><span><b>{on ? "On" : "Off"}</b></span></div>;
}

function FeesAdmin() {
  const [saved, setSaved] = useState<Draft | null>(null); const [draft, setDraft] = useState<Draft | null>(null); const [history, setHistory] = useState<FeeEvent[]>([]);
  const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const [example, setExample] = useState("TH");
  const countries = useMemo(() => COUNTRY_CODES.map((c) => ({ code: c, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name)), []);
  // Only the latest load applies: a late answer (effect run twice) must not undo what the admin already switched or typed.
  useEffect(() => {
    let live = true;
    adminApi.feeSettings().then((r) => { if (!live) return; if (r.ok) { setSaved(toDraft(r.settings)); setDraft(toDraft(r.settings)); setHistory(r.history); } else setError(r.error); });
    return () => { live = false; };
  }, []);
  if (!draft || !saved) return error ? <Notice tone="error">{error}</Notice> : <p className="muted-note">Loading…</p>;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const change = (patch: Partial<Draft>) => { setOk(""); setDraft((d) => (d ? { ...d, ...patch } : d)); };
  const setRate = (i: number, patch: Partial<Draft["rates"][number]>) => change({ rates: draft.rates.map((r, n) => (n === i ? { ...r, ...patch } : r)) });
  const s = fromDraft(draft); const numbersOk = [s.feePercentBp, s.feeFixedMinor, s.feeMinMinor, s.taxDefaultBp, ...s.taxRates.map((r) => r.rateBp)].every(Number.isFinite);
  const ex = numbersOk ? charges(s as FeeSettings, 100_000, example) : null;
  const save = async () => {
    setBusy(true); setError(""); setOk(""); const r = await adminApi.saveFeeSettings(s as FeeSettings); setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setSaved(toDraft(r.settings)); setDraft(toDraft(r.settings)); setHistory(r.history); setOk("Saved. New orders use these settings; paid orders keep what they were charged.");
  };
  const unused = countries.filter((c) => !draft.rates.some((r) => r.country === c.code));
  return <div className="pp-admin fees-admin">
    <p className="muted-note">One service fee for every product, and sales tax added on top of the price. Customers see both lines in the cart, checkout, order page, receipt and order email.</p>
    {error && <Notice tone="error">{error}</Notice>}
    {ok && <Notice tone="success">{ok}</Notice>}
    <section className="adm-panel" aria-labelledby="fee-h">
      <h2 id="fee-h">Service fee</h2>
      <Switch on={draft.feeEnabled} label="Service fee" onChange={() => change({ feeEnabled: !draft.feeEnabled })} />
      <div className="fees-grid">
        <label className="field"><span>Percent of the order (%)</span><input inputMode="decimal" value={draft.pct} onChange={(e) => change({ pct: e.target.value })} aria-describedby="fee-note" /></label>
        <label className="field"><span>Fixed amount (฿)</span><input inputMode="decimal" value={draft.fixed} onChange={(e) => change({ fixed: e.target.value })} /></label>
        <label className="field"><span>Minimum fee (฿)</span><input inputMode="decimal" value={draft.min} onChange={(e) => change({ min: e.target.value })} /></label>
      </div>
      <p className="muted-note" id="fee-note">Fee = percent of (sub-total − discount) + fixed amount, at least the minimum. Up to {pctText(FEE_LIMITS.percentBp)} and {baht(FEE_LIMITS.fixedMinor)}. Same for all products and payment methods.</p>
    </section>
    <section className="adm-panel" aria-labelledby="tax-h">
      <h2 id="tax-h">Sales tax</h2>
      <Switch on={draft.taxEnabled} label="Sales tax" onChange={() => change({ taxEnabled: !draft.taxEnabled })} />
      <div className="fees-grid"><label className="field"><span>Default rate, all other countries (%)</span><input inputMode="decimal" value={draft.def} onChange={(e) => change({ def: e.target.value })} /></label></div>
      <h3 className="fees-h3">Rate per billing country</h3>
      {draft.rates.length ? <div className="adm-table-wrap"><table className="adm-table static fees-table">
        <thead><tr><th scope="col">Country</th><th scope="col">Rate (%)</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{draft.rates.map((r, i) => <tr key={`${r.country}-${i}`}>
          <td><select aria-label={`Country ${i + 1}`} value={r.country} onChange={(e) => setRate(i, { country: e.target.value })}>
            {[{ code: r.country, name: countryName(r.country) }, ...unused].map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></td>
          <td><input className="fees-rate" inputMode="decimal" aria-label={`Rate for ${countryName(r.country)} (%)`} value={r.pct} onChange={(e) => setRate(i, { pct: e.target.value })} /></td>
          <td><button type="button" className="text-link as-link" onClick={() => change({ rates: draft.rates.filter((_, n) => n !== i) })}>Remove<span className="sr-only"> {countryName(r.country)}</span></button></td></tr>)}</tbody>
      </table></div> : <p className="muted-note">No country rates. Every country uses the default rate.</p>}
      {unused.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => change({ rates: [...draft.rates, { country: unused.find((c) => c.code === "TH")?.code ?? unused[0]!.code, pct: "7" }] })}>+ Add country rate</button>}
      <p className="muted-note">Tax = rate × (price after discount + service fee), using the customer’s billing country. Up to {pctText(FEE_LIMITS.taxBp)}. Check the rates with your accountant.</p>
    </section>
    <section className="adm-panel" aria-labelledby="ex-h">
      <h2 id="ex-h">Example</h2>
      <label className="field fees-ex"><span>Billing country</span><select value={example} onChange={(e) => setExample(e.target.value)}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
      {ex ? <dl className="fees-example" data-testid="fees-example">
        <div><dt>Order after discount</dt><dd>{baht(ex.base)}</dd></div>
        <div><dt>Service fee</dt><dd>{baht(ex.fee)}</dd></div>
        <div><dt>Sales tax {pctText(ex.taxBp ?? 0)}</dt><dd>{baht(ex.tax ?? 0)}</dd></div>
        <div className="fees-ex-total"><dt>Customer pays</dt><dd>{baht(ex.total)}</dd></div>
      </dl> : <p className="field-error" role="alert">Numbers only, up to 2 decimals (e.g. 7 or 2.5).</p>}
    </section>
    <div className="pp-save">
      {dirty && <span className="muted-note">Unsaved changes</span>}
      <button type="button" className="btn btn-outline" disabled={!dirty || busy} onClick={() => { setDraft(saved); setOk(""); setError(""); }}>Discard</button>
      <button type="button" className="btn btn-primary" disabled={!dirty || busy || !numbersOk} onClick={save}>{busy ? "Saving…" : "Save"}</button>
    </div>
    <section className="adm-panel" aria-labelledby="fees-history">
      <h2 id="fees-history">History</h2>
      {history.length ? <ul className="pp-history">{history.map((h, i) => <li key={`${h.at}-${i}`}><time>{dateTime(h.at)}</time> <b>{h.by ?? "Deleted admin"}</b> <span>{h.detail}</span></li>)}</ul>
        : <p className="muted-note">No changes yet.</p>}
    </section>
  </div>;
}

export default function AdminFeesPage() {
  return <AdminShell title="Fees & tax"><FeesAdmin /></AdminShell>;
}
