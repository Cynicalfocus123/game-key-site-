"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { allProducts, type Product } from "@/lib/catalog";
import { discountPercent, MIN_QUERY, normalize, searchProducts } from "@/lib/search";
import { assetPath, productHref } from "./cart-ui";
import { Price } from "./currency-provider";

const MAX_ROWS = 20;
export const searchHref = (q: string) => `/search?q=${encodeURIComponent(q.trim())}`;

// Region label on search rows + cards: GLOBAL green, any limited region red (future task S5).
export function RegionTag({ p }: { p: Product }) {
  if (p.kind !== "game_key" || !p.region) return null;
  const global = p.region.toLowerCase() === "global";
  return <span className={`region-tag${global ? " is-global" : ""}`}>{p.region.toUpperCase()}</span>;
}

// Header search (future task S1): dropdown after 2 characters, 150 ms debounce, scrolls inside, "Show all N results" → /search?q=.
// Keyboard: ↑ ↓ move, Enter opens (first row = results page), Esc closes. Click outside closes. ✕ clears.
export default function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter(); const listId = useId(); const wrap = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initial); const [dq, setDq] = useState(initial); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1);
  useEffect(() => { setQ(initial); setDq(initial); }, [initial]);
  useEffect(() => { const t = setTimeout(() => setDq(q), 150); return () => clearTimeout(t); }, [q]);
  const results = useMemo(() => searchProducts(allProducts, dq), [dq]);
  const ready = normalize(q).join("").length >= MIN_QUERY; const show = open && ready;
  const rows = results.slice(0, MAX_ROWS);
  useEffect(() => {
    if (!show) return;
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", down); return () => document.removeEventListener("pointerdown", down);
  }, [show]);
  useEffect(() => { if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, listId]);

  const go = (href: string) => { setOpen(false); input.current?.blur(); router.push(href); };
  const openRow = (i: number) => { if (i <= 0) { if (ready) go(searchHref(q)); return; } const p = rows[i - 1]; if (p) { setQ(""); setDq(""); go(productHref(p.id)); } };
  const key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter") { e.preventDefault(); openRow(active); return; }
    if (!show || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault(); const n = rows.length + 1;
    setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a <= 0 ? n - 1 : a - 1)));
  };
  const clear = () => { setQ(""); setDq(""); setOpen(false); input.current?.focus(); };

  return <div className="search" ref={wrap}>
    <span aria-hidden="true">⌕</span>
    <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={key}
      role="combobox" aria-label="Search products" aria-autocomplete="list" aria-expanded={show} aria-controls={listId}
      aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined} placeholder="Search PC parts, games, laptops, software..." autoComplete="off" enterKeyHint="search" />
    {q && <button type="button" className="search-clear" aria-label="Clear search" onClick={clear}>×</button>}
    {show && <div className="search-drop">
      <p className="sr-only" aria-live="polite">{results.length} {results.length === 1 ? "result" : "results"}</p>
      <ul id={listId} role="listbox" aria-label="Search suggestions" className="search-list">
        <li id={`${listId}-0`} role="option" aria-selected={active === 0} className={`search-query${active === 0 ? " is-active" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => openRow(0)}><span aria-hidden="true">⌕</span> Search for “{q.trim()}”</li>
        {rows.map((p, i) => <SearchRow key={p.id} p={p} id={`${listId}-${i + 1}`} active={active === i + 1} onPick={() => openRow(i + 1)} />)}
        {!rows.length && dq === q && <li className="search-empty" role="presentation"><strong>No results for “{q.trim()}”</strong><span>Check the spelling, try fewer words, or search by platform (Steam, Xbox).</span><Link href="/games" onClick={() => setOpen(false)}>Browse all games</Link></li>}
      </ul>
      {results.length > 0 && <Link className="search-all" href={searchHref(q)} onClick={() => setOpen(false)}>Show all {results.length} {results.length === 1 ? "result" : "results"}</Link>}
    </div>}
  </div>;
}

function SearchRow({ p, id, active, onPick }: { p: Product; id: string; active: boolean; onPick: () => void }) {
  const off = discountPercent(p); const game = p.kind === "game_key";
  return <li id={id} role="option" aria-selected={active} aria-disabled={p.soldOut || undefined} className={`search-row${active ? " is-active" : ""}${p.soldOut ? " is-sold" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={onPick}>
    <span className="search-thumb"><Image src={assetPath(p.image)} alt="" width={44} height={58} /></span>
    <span className="search-copy"><span className="search-tag">{game ? "Digital key" : "Hardware"}{game && <> · {p.platform} · <RegionTag p={p} /></>}</span><span className="search-name">{p.name}</span></span>
    {p.soldOut ? <span className="search-sold">Sold out</span> : <span className="search-price">{game && <small>From</small>}{off !== null && <span className="search-was"><del><Price thb={p.old!} /></del> <b>-{off}%</b></span>}<strong><Price thb={p.price} /></strong></span>}
  </li>;
}
