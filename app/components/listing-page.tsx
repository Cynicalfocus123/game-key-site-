"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allGames, allProducts, hardware, type Product } from "@/lib/catalog";
import { COUNTRY_CODES } from "@/lib/currency/currencies";
import { applyFilters, facets, filterCount, GROUPS, listingTitle, parseState, scoped, SORTS, stateQuery, type Facet, type GroupId, type ListState } from "@/lib/listing";
import { countryName } from "@/lib/profile";
import { useMedia } from "./cart-ui";
import { useCurrency } from "./currency-provider";
import { ProductCard } from "./product-card";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";

export type Scope = "search" | "games" | "hardware";
const PAGE = 24;
const OPEN_KEY = "corecart-filter-open";
const readOpen = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}"); } catch { return {}; } };
const writeOpen = (v: Record<string, boolean>) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };
const baseFor = (scope: Scope): Product[] => (scope === "hardware" ? hardware : scope === "games" ? allGames : allProducts);

// Future task S2 + S3: /search?q=, /games?genre=FPS, /games?platform=Steam, /hardware. Filters in the URL, left sidebar (mobile sheet).
export default function ListingPage({ scope }: { scope: Scope }) {
  return <Suspense fallback={<><SiteHeader /><main className="lst-main"><p className="muted-note">Loading…</p></main><SiteFooter /></>}><Listing scope={scope} /></Suspense>;
}

function Listing({ scope }: { scope: Scope }) {
  const params = useSearchParams();
  const s = useMemo(() => parseState(new URLSearchParams(params.toString())), [params]);
  const { convert, currency } = useCurrency();
  const priceMajor = useCallback((p: Product) => convert(p.price) / 10 ** currency.decimals, [convert, currency]);
  const list = useMemo(() => scoped(baseFor(scope), s.q), [scope, s.q]);
  const results = useMemo(() => applyFilters(list, s, { priceMajor }), [list, s, priceMajor]);
  const fx = useMemo(() => facets(list, s, { priceMajor }), [list, s, priceMajor]);
  const [shown, setShown] = useState(PAGE); const [sheet, setSheet] = useState(false); const mobile = useMedia("(max-width: 900px)");
  const qs = params.toString();
  useEffect(() => { setShown(PAGE); }, [qs]);
  const title = listingTitle(scope, s);
  useEffect(() => { document.title = `${s.q ? `“${s.q}” — ` : ""}${title} | CoreCart`; }, [title, s.q]);
  useEffect(() => { document.body.style.overflow = sheet ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [sheet]);

  // New history entry per change → back button steps through filters. Next keeps useSearchParams in sync with pushState.
  const update = useCallback((next: ListState) => { const q = stateQuery(next); window.history.pushState(null, "", q ? `?${q}` : window.location.pathname); }, []);
  const toggle = (g: GroupId, v: string) => { const cur = s.sel[g]; update({ ...s, sel: { ...s.sel, [g]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } }); };
  const clearAll = () => update({ ...s, q: scope === "search" ? "" : s.q, min: null, max: null, country: "", sel: { type: [], os: [], sale: [], platform: [], genre: [], region: [] } });
  const n = filterCount(s);
  const panel = <FilterPanel s={s} fx={fx} currencyCode={currency.code} update={update} toggle={toggle} />;

  return <><SiteHeader searchInitial={scope === "search" ? s.q : ""} /><main className="lst-main">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">{scope === "hardware" ? "PC hardware" : scope === "games" ? "Games" : "Search"}</span></nav>
    <h1 className="lst-title">{title}</h1>
    <div className="lst-layout">
      {!mobile && <aside className="lst-side" aria-label="Filters">{panel}</aside>}
      <section className="lst-results" aria-label="Results">
        {(s.q || n > 0) && <div className="lst-chips">
          {s.q && <Chip label={`Text: ${s.q}`} onRemove={() => update({ ...s, q: "" })} />}
          {(s.min !== null || s.max !== null) && <Chip label={`Price: ${s.min ?? 0} – ${s.max ?? "max"} ${currency.code}`} onRemove={() => update({ ...s, min: null, max: null })} />}
          {s.country && <Chip label={`Country: ${countryName(s.country)}`} onRemove={() => update({ ...s, country: "" })} />}
          {GROUPS.flatMap((g) => s.sel[g.id].map((v) => <Chip key={`${g.id}-${v}`} label={`${g.label}: ${v}`} onRemove={() => toggle(g.id, v)} />))}
          <button type="button" className="lst-clear" onClick={clearAll}>Clear all</button>
        </div>}
        <div className="lst-bar">
          <p className="lst-count" aria-live="polite">Results found: <strong>{results.length}</strong></p>
          <button type="button" className="lst-filter-btn" onClick={() => setSheet(true)} aria-haspopup="dialog">Filters{n > 0 && ` (${n})`}</button>
          <SortMenu s={s} update={update} />
        </div>
        {results.length ? <>
          <div className="products lst-grid">{results.slice(0, shown).map((p) => <ProductCard item={p} key={p.id} />)}</div>
          {shown < results.length && <button type="button" className="btn btn-outline lst-more" onClick={() => setShown((x) => x + PAGE)}>Load more ({results.length - shown} left)</button>}
        </> : <div className="lst-empty"><h2>No products match</h2><p>{s.q ? <>Nothing found for “{s.q}”{n ? " with these filters" : ""}. Check the spelling or try fewer words.</> : "Try removing a filter."}</p>{(n > 0 || s.q) && <button type="button" className="btn btn-primary" onClick={clearAll}>Clear all</button>}</div>}
      </section>
    </div>
  </main>
  {mobile && sheet && <div className="lst-sheet" role="dialog" aria-modal="true" aria-label="Filters">
    <div className="lst-sheet-top"><strong>Filters</strong><button type="button" onClick={() => setSheet(false)} aria-label="Close filters">×</button></div>
    <div className="lst-sheet-body">{panel}</div>
    <div className="lst-sheet-foot"><button type="button" className="btn btn-outline" onClick={clearAll}>Clear</button><button type="button" className="btn btn-primary" onClick={() => setSheet(false)}>Show {results.length} {results.length === 1 ? "result" : "results"}</button></div>
  </div>}
  <SiteFooter /></>;
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="lst-chip">{label}<button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>×</button></span>;
}

function SortMenu({ s, update }: { s: ListState; update: (n: ListState) => void }) {
  const [open, setOpen] = useState(false); const wrap = useRef<HTMLDivElement>(null);
  const options = SORTS.filter((o) => o.id !== "best" || s.q);
  const current = options.find((o) => o.id === s.sort) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down); window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [open]);
  return <div className="lst-sort" ref={wrap}>
    <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span className="lst-sort-label">Sort: </span>{current.label} <span aria-hidden="true">{open ? "▴" : "▾"}</span></button>
    {open && <ul className="lst-sort-menu">{options.map((o) => <li key={o.id}><button type="button" aria-current={o.id === s.sort || undefined} onClick={() => { setOpen(false); update({ ...s, sort: o.id }); }}>{o.label}{o.id === s.sort && <span aria-hidden="true">✓</span>}</button></li>)}</ul>}
  </div>;
}

const countries = COUNTRY_CODES.map((c) => ({ code: c, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name));

function FilterPanel({ s, fx, currencyCode, update, toggle }: { s: ListState; fx: Record<GroupId, Facet[]>; currencyCode: string; update: (n: ListState) => void; toggle: (g: GroupId, v: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => { setOpen(readOpen()); }, []);
  const isOpen = (id: string) => open[id] ?? true;
  const flip = (id: string) => { const next = { ...open, [id]: !isOpen(id) }; setOpen(next); writeOpen(next); };
  return <div className="lst-panel">
    <FilterGroup id="price" label={`Price range (${currencyCode})`} open={isOpen("price")} onFlip={flip}><PriceRange s={s} update={update} /></FilterGroup>
    <FilterGroup id="country" label="Country" open={isOpen("country")} onFlip={flip}>
      <select className="lst-select" aria-label="Country" value={s.country} onChange={(e) => update({ ...s, country: e.target.value })}>
        <option value="">All countries</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </FilterGroup>
    {GROUPS.map((g) => fx[g.id].length > 0 && <FilterGroup key={g.id} id={g.id} label={g.label} open={isOpen(g.id)} onFlip={flip} picked={s.sel[g.id].length}>
      <OptionList group={g.id} label={g.label} options={fx[g.id]} picked={s.sel[g.id]} toggle={toggle} />
    </FilterGroup>)}
  </div>;
}

function FilterGroup({ id, label, open, onFlip, picked = 0, children }: { id: string; label: string; open: boolean; onFlip: (id: string) => void; picked?: number; children: React.ReactNode }) {
  return <div className="lst-group">
    <h2><button type="button" aria-expanded={open} onClick={() => onFlip(id)}>{label}{picked > 0 && <span className="lst-picked"> ({picked})</span>}<span className="lst-caret" aria-hidden="true">{open ? "▴" : "▾"}</span></button></h2>
    {open && <div className="lst-group-body">{children}</div>}
  </div>;
}

const SHOW = 8;
function OptionList({ group, label, options, picked, toggle }: { group: GroupId; label: string; options: Facet[]; picked: string[]; toggle: (g: GroupId, v: string) => void }) {
  const [find, setFind] = useState(""); const [more, setMore] = useState(false);
  const long = options.length > SHOW;
  const ordered = [...options.filter((o) => picked.includes(o.value)), ...options.filter((o) => !picked.includes(o.value))]; // picked stay visible
  const matched = find ? ordered.filter((o) => o.value.toLowerCase().includes(find.trim().toLowerCase())) : ordered;
  const visible = long && !more && !find ? matched.slice(0, SHOW) : matched;
  return <>
    {long && <input className="lst-find" type="search" value={find} onChange={(e) => setFind(e.target.value)} aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} />}
    <ul className="lst-options">{visible.map((o) => <li key={o.value}><label className={o.count === 0 ? "is-zero" : undefined}><input type="checkbox" checked={picked.includes(o.value)} onChange={() => toggle(group, o.value)} /><span>{o.value}</span><small>{o.count}</small></label></li>)}</ul>
    {find && !matched.length && <p className="lst-none">No match</p>}
    {long && !find && <button type="button" className="lst-more-opts" aria-expanded={more} onClick={() => setMore((m) => !m)}>{more ? "Show less ▴" : `${options.length - SHOW} more ▾`}</button>}
  </>;
}

// Min defaults to 0, max = whatever the user types. Applies 500 ms after typing stops, or on Enter / leaving the field.
function PriceRange({ s, update }: { s: ListState; update: (n: ListState) => void }) {
  const [min, setMin] = useState(s.min?.toString() ?? ""); const [max, setMax] = useState(s.max?.toString() ?? "");
  useEffect(() => { setMin(s.min?.toString() ?? ""); setMax(s.max?.toString() ?? ""); }, [s.min, s.max]);
  const parse = (v: string) => { const n = Number(v.replace(",", ".")); return v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n; };
  const apply = useCallback(() => {
    const a = parse(min); const b = parse(max);
    const [lo, hi] = a !== null && b !== null && a > b ? [b, a] : [a, b];
    if (lo !== s.min || hi !== s.max) update({ ...s, min: lo, max: hi });
  }, [min, max, s, update]);
  useEffect(() => { const t = setTimeout(apply, 500); return () => clearTimeout(t); }, [min, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = (e: React.KeyboardEvent) => { if (e.key === "Enter") apply(); };
  return <div className="lst-price">
    <input inputMode="decimal" aria-label="Minimum price" placeholder="0" value={min} onChange={(e) => setMin(e.target.value)} onBlur={apply} onKeyDown={key} />
    <span aria-hidden="true">–</span>
    <input inputMode="decimal" aria-label="Maximum price" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} onBlur={apply} onKeyDown={key} />
  </div>;
}
