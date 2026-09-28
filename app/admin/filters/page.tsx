"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { FILTER_GROUPS, LABEL_MAX, liveOptions, productCount, type FilterConfig, type FilterGroupId, type FilterOption } from "@/lib/filters";
import { AdminShell } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";
import { reloadFilterConfig } from "../../components/filter-config";

// Admin filter manager (future task S4, approved wireframe): groups on the left (select on phones), values on the right.
// Per value: ↑ ↓ order, Rename, Hide / Show, Delete (amber confirm with the product count). Per group: Show group, Starts open.
type Res = { ok: true; config: FilterConfig } | { ok: false; error: string };

function Filters() {
  const [cfg, setCfg] = useState<FilterConfig | null>(null); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const [group, setGroup] = useState<FilterGroupId>("genre"); const [busy, setBusy] = useState(false);
  useEffect(() => { adminApi.filters().then((r) => (r.ok ? setCfg(r.config) : setError(r.error))); }, []);
  const run = useCallback(async (p: Promise<Res>, done: string) => {
    setBusy(true); setError(""); setSaved(""); const r = await p; setBusy(false);
    if (!r.ok) { setError(r.error); return false; }
    setCfg(r.config); setSaved(done); reloadFilterConfig(); return true;
  }, []);
  const info = FILTER_GROUPS.find((g) => g.id === group)!;
  const g = cfg?.groups.find((x) => x.id === group);
  const options = useMemo(() => (cfg ? liveOptions(cfg, group) : []), [cfg, group]);

  return <>
    <p className="muted-note">Choose which filters shoppers see on search, games and hardware pages. Changes show on the store at once. Renaming keeps links working.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <p className="sr-only" aria-live="polite">{saved}</p>
    {!cfg ? !error && <p className="muted-note">Loading…</p> : <div className="flt-layout">
      <nav className="flt-groups" aria-label="Filter groups">
        {FILTER_GROUPS.map((x) => { const c = cfg.groups.find((y) => y.id === x.id); return <button key={x.id} type="button" aria-current={x.id === group || undefined} onClick={() => { setGroup(x.id); setSaved(""); setError(""); }}>
          {x.label}{c && !c.shown && <small>Hidden</small>}</button>; })}
      </nav>
      <label className="field flt-group-select"><span>Filter group</span><select value={group} onChange={(e) => { setGroup(e.target.value as FilterGroupId); setSaved(""); setError(""); }}>
        {FILTER_GROUPS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select></label>
      <section className="flt-panel" aria-label={info.label}>
        <h2>{info.label}</h2>
        {g && <div className="flt-switches">
          <label className="check"><input type="checkbox" checked={g.shown} disabled={busy} onChange={(e) => run(adminApi.updateFilterGroup(group, { shown: e.target.checked }), "Saved")} /> Show group on the store</label>
          <label className="check"><input type="checkbox" checked={g.startOpen} disabled={busy} onChange={(e) => run(adminApi.updateFilterGroup(group, { startOpen: e.target.checked }), "Saved")} /> Starts open</label>
        </div>}
        {!info.hasOptions ? <p className="muted-note">Shoppers type a minimum (default 0) and a maximum in their own currency. There are no values to manage.</p> : <>
          {info.canAdd && <AddValue key={group} noun={info.noun} busy={busy} onAdd={(label) => run(adminApi.addFilterOption(group, label), `Added ${label}`)} />}
          {!info.canAdd && <p className="muted-note">{group === "country" ? "Countries come from the currency list. You can rename, hide or reorder them." : "Sale has one value: any product with a discount. You can rename or hide it."}</p>}
          <ul className="flt-list">
            {options.map((o, i) => <Row key={o.id} o={o} first={i === 0} last={i === options.length - 1} canDelete={info.canDelete} noun={info.noun} busy={busy} run={run} />)}
          </ul>
        </>}
      </section>
    </div>}
  </>;
}

function AddValue({ noun, busy, onAdd }: { noun: string; busy: boolean; onAdd: (label: string) => Promise<boolean> }) {
  const [v, setV] = useState("");
  return <form className="flt-add" onSubmit={async (e) => { e.preventDefault(); if (v.trim() && await onAdd(v)) setV(""); }}>
    <label className="field"><span>Add {noun}</span><input value={v} maxLength={LABEL_MAX} onChange={(e) => setV(e.target.value)} placeholder={`New ${noun} name`} /></label>
    <button className="btn btn-primary" disabled={busy || !v.trim()}>Add</button>
  </form>;
}

function Row({ o, first, last, canDelete, noun, busy, run }: { o: FilterOption; first: boolean; last: boolean; canDelete: boolean; noun: string; busy: boolean; run: (p: Promise<Res>, done: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"" | "rename" | "delete">(""); const [name, setName] = useState(o.label);
  const count = productCount(o.group, o.value);
  const renamed = o.label !== o.value && o.group !== "country";
  return <li className={o.hidden ? "is-hidden" : undefined}>
    <div className="flt-row">
      <div className="flt-name">
        {mode === "rename" ? <form className="flt-rename" onSubmit={async (e) => { e.preventDefault(); if (await run(adminApi.updateFilterOption(o.id, { label: name }), "Renamed")) setMode(""); }}>
          <input aria-label={`New name for ${o.label}`} value={name} maxLength={LABEL_MAX} onChange={(e) => setName(e.target.value)} autoFocus />
          <button className="btn btn-primary btn-sm" disabled={busy}>Save</button><button type="button" className="btn btn-outline btn-sm" onClick={() => { setMode(""); setName(o.label); }}>Cancel</button>
        </form> : <><strong>{o.label}</strong>{renamed && <small>Catalog value: {o.value}</small>}</>}
      </div>
      <span className="flt-count">{count} {count === 1 ? "product" : "products"}</span>
      <span className={`chip${o.hidden ? "" : " chip-green"}`}>{o.hidden ? "Hidden" : "Shown"}</span>
      <div className="flt-actions">
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || first} onClick={() => run(adminApi.updateFilterOption(o.id, { move: -1 }), "Moved up")} aria-label={`Move ${o.label} up`}>↑</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || last} onClick={() => run(adminApi.updateFilterOption(o.id, { move: 1 }), "Moved down")} aria-label={`Move ${o.label} down`}>↓</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setMode(mode === "rename" ? "" : "rename")}>Rename<span className="sr-only"> {o.label}</span></button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(adminApi.updateFilterOption(o.id, { hidden: !o.hidden }), o.hidden ? "Shown" : "Hidden")}>{o.hidden ? "Show" : "Hide"}<span className="sr-only"> {o.label}</span></button>
        {canDelete && <button type="button" className="btn btn-outline btn-sm flt-del" disabled={busy} onClick={() => setMode(mode === "delete" ? "" : "delete")}>Delete<span className="sr-only"> {o.label}</span></button>}
      </div>
    </div>
    {mode === "delete" && <div className="flt-confirm" role="alertdialog" aria-label={`Delete ${o.label}`}>
      <p>Delete “{o.label}”? {count ? <>{count} {count === 1 ? "product uses" : "products use"} it — they lose this {noun}.</> : "No products use it."}</p>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(adminApi.deleteFilterOption(o.id), `Deleted ${o.label}`)}>Delete</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setMode("")}>Cancel</button></div>
    </div>}
  </li>;
}

export default function Page() { return <AdminShell title="Filters"><Filters /></AdminShell>; }
