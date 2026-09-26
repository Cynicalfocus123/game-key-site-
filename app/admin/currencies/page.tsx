"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/client/api";
import type { AdminCurrency, AdminCurrencyState, CurrencyPatch } from "@/lib/client/types";
import { BASE_CURRENCY, DEFAULT_CURRENCY } from "@/lib/currency/currencies";
import { convertMinor, formatMoney } from "@/lib/currency/money";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";
import { Flag } from "../../components/currency-provider";

const STEPS = [1, 5, 10, 50, 100, 1000];
const stepLabel = (step: number, decimals: number) => (step / 10 ** decimals).toFixed(decimals);
const effective = (c: AdminCurrency) => c.overrideRate ?? c.autoRate;

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`adm-switch${on ? " on" : ""}`} disabled={disabled} title={disabled ? "Default currency: always on" : undefined} onClick={() => onChange(!on)}><i /></button>;
}

function OverrideField({ c, onSave }: { c: AdminCurrency; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(c.overrideRate ?? "");
  useEffect(() => setV(c.overrideRate ?? ""), [c.overrideRate]);
  const commit = () => { const next = v.trim() || null; if (next !== c.overrideRate) onSave(next); };
  if (c.code === DEFAULT_CURRENCY) return <span className="muted-note">Base (1)</span>;
  return <input className="adm-rate" inputMode="decimal" aria-label={`${c.code} override rate`} placeholder="Auto" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />;
}

function Currencies() {
  const [data, setData] = useState<AdminCurrencyState | null>(null); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false); const [q, setQ] = useState(""); const [filter, setFilter] = useState("");
  const load = useCallback(async () => { const r = await adminApi.currencies(); if (r.ok) setData(r.data); else setError(r.error); }, []);
  useEffect(() => { load(); }, [load]);
  const patch = async (code: string, p: CurrencyPatch) => {
    setError(""); setSaved("");
    const r = await adminApi.updateCurrency(code, p);
    if (!r.ok) setError(`${code}: ${r.error}`); else setSaved(`${code} saved.`);
    await load();
  };
  const refresh = async () => { setBusy(true); setError(""); setSaved(""); const r = await adminApi.refreshRates(); setBusy(false); if (r.ok) setSaved("Rates updated."); await load(); };
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <p className="muted-note">Loading…</p>;
  const base = data.currencies.find((c) => c.code === BASE_CURRENCY)!;
  const baseRate = { code: base.code, decimals: base.decimals, rate: effective(base) ?? "1" };
  const s = data.status; const query = q.trim().toLowerCase();
  const rows = data.currencies.filter((c) => (!query || c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))
    && (!filter || (filter === "enabled" ? c.enabled : filter === "disabled" ? !c.enabled : filter === "chargeable" ? c.chargeable : c.overrideRate !== null)));
  return <>
    <div className="adm-rate-bar">
      <p>Rates last updated <strong>{dateTime(s.lastSuccessAt)}</strong> · provider time {dateTime(s.providerUpdatedAt)} · source <a className="text-link" href={s.source} target="_blank" rel="noopener">ExchangeRate-API</a> · base price currency {BASE_CURRENCY}. Auto refresh at most every 12 hours.</p>
      <button className="btn btn-outline" onClick={refresh} disabled={busy}>{busy ? "Updating…" : "Update rates now"}</button>
    </div>
    {s.lastError && <Notice tone="error">Last rate fetch failed{s.lastAttemptAt ? ` (${dateTime(s.lastAttemptAt)})` : ""}: {s.lastError}. The site keeps using the last good rates.</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Code or name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label className="field"><span>Show</span><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All ({data.currencies.length})</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option><option value="chargeable">Chargeable</option><option value="override">Manual override</option></select></label>
    </div>
    <p className="adm-count">{data.currencies.filter((c) => c.enabled).length} enabled · {data.currencies.filter((c) => c.chargeable).length} chargeable. Override wins over the auto rate. Rates are units per 1 USD.</p>
    <div className="adm-table-wrap"><table className="adm-table static adm-cur-table">
      <thead><tr><th>Currency</th><th>Enabled</th><th>Chargeable</th><th className="num">Auto rate</th><th>Override</th><th>Rounding</th><th className="num">฿1,000 =</th><th>Updated</th></tr></thead>
      <tbody>{rows.map((c) => {
        const rate = effective(c); const locked = c.code === DEFAULT_CURRENCY;
        return <tr key={c.code} data-code={c.code}>
          <td><span className="adm-cur"><Flag code={c.code} /><strong>{c.code}</strong></span><small>{c.name}</small></td>
          <td><Switch on={c.enabled} disabled={locked} label={`${c.code} enabled`} onChange={(v) => patch(c.code, { enabled: v })} /></td>
          <td><Switch on={c.chargeable} disabled={locked} label={`${c.code} chargeable`} onChange={(v) => patch(c.code, { chargeable: v })} /></td>
          <td className={`num${c.overrideRate ? " adm-struck" : ""}`}>{c.autoRate ?? "—"}</td>
          <td><OverrideField c={c} onSave={(v) => patch(c.code, { overrideRate: v })} />{c.overrideRate && <small className="adm-ok">Override in use</small>}</td>
          <td><select aria-label={`${c.code} rounding step`} value={c.roundStep} onChange={(e) => patch(c.code, { roundStep: Number(e.target.value) })}>{[...new Set([...STEPS, c.roundStep])].sort((a, b) => a - b).map((st) => <option key={st} value={st}>{stepLabel(st, c.decimals)}</option>)}</select></td>
          <td className="num">{rate ? formatMoney(convertMinor(100000, baseRate, { code: c.code, decimals: c.decimals, rate, roundStep: c.roundStep }), c) : "—"}</td>
          <td>{dateTime(c.rateUpdatedAt)}<small>Settings {dateTime(c.updatedAt)}</small></td>
        </tr>;
      })}</tbody>
    </table></div>
  </>;
}

export default function AdminCurrenciesPage() {
  return <AdminShell title="Currencies"><Currencies /></AdminShell>;
}
