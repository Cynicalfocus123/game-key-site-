"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/client/api";
import { MENU_HREF_MAX, MENU_LABEL_MAX, MENU_TARGETS, menuTree, type MenuInput, type MenuItem, type MenuKind, type MenuNode } from "@/lib/menu";
import { AdminShell } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";
import { reloadMenu } from "../../components/menu-config";

// Store menu manager (task D): the header bar, the products drawer (one level of sub-items) and the footer "Shop" column.
// Per item: ↑ ↓ order, Edit (name, link target, place, NEW badge, header bar, footer), Hide / Show, Delete (amber confirm).
type Res = { ok: true; items: MenuItem[] } | { ok: false; error: string };
const AUTO_GENRES = "auto:genres"; const AUTO_UNDER = "auto:under"; const CUSTOM = "custom";
const targetOf = (m: Pick<MenuItem, "kind" | "href">) => (m.kind === "genres" ? AUTO_GENRES : m.kind === "under" ? AUTO_UNDER : MENU_TARGETS.some((t) => t.href === m.href) ? m.href : CUSTOM);
const targetText = (m: MenuItem) => (m.kind === "genres" ? "Automatic: all genres" : m.kind === "under" ? "Automatic: games under ฿350 (visitor currency)" : MENU_TARGETS.find((t) => t.href === m.href)?.label ?? m.href);

function Categories() {
  const [items, setItems] = useState<MenuItem[] | null>(null); const [error, setError] = useState(""); const [saved, setSaved] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { adminApi.menu().then((r) => (r.ok ? setItems(r.items) : setError(r.error))); }, []);
  const run = useCallback(async (p: Promise<Res>, done: string) => {
    setBusy(true); setError(""); setSaved(""); const r = await p; setBusy(false);
    if (!r.ok) { setError(r.error); return false; }
    setItems(r.items); setSaved(done); reloadMenu(); return true;
  }, []);
  const tree = useMemo(() => (items ? menuTree(items, true) : []), [items]);

  return <>
    <p className="muted-note">The menu shoppers see: the header bar (desktop), the Products menu (drawer, one level of sub-items) and the footer “Shop” column. Changes show on the store at once.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <p className="sr-only" aria-live="polite">{saved}</p>
    {!items ? !error && <p className="muted-note">Loading…</p> : <>
      <section className="flt-panel cat-add" aria-label="Add menu item">
        <h2>Add menu item</h2>
        <ItemForm tree={tree} busy={busy} submit="Add item" onSubmit={(v) => run(adminApi.addMenuItem(v), `Added ${v.label}`)} />
      </section>
      <section className="flt-panel" aria-label="Menu items">
        <h2>Menu items</h2>
        <ul className="flt-list cat-list">
          {tree.map((t, i) => <li key={t.id} className={t.hidden ? "is-hidden" : undefined}>
            <Row m={t} tree={tree} first={i === 0} last={i === tree.length - 1} subs={t.children.length} busy={busy} run={run} />
            {t.children.length > 0 && <ul className="flt-list cat-sub" aria-label={`Sub-items of ${t.label}`}>
              {t.children.map((c, j) => <li key={c.id} className={c.hidden ? "is-hidden" : undefined}><Row m={c} tree={tree} first={j === 0} last={j === t.children.length - 1} subs={0} busy={busy} run={run} /></li>)}
            </ul>}
          </li>)}
        </ul>
      </section>
    </>}
  </>;
}

function ItemForm({ tree, initial, self, busy, submit, onSubmit, onCancel }: { tree: MenuNode[]; initial?: MenuItem; self?: string; busy: boolean; submit: string; onSubmit: (v: MenuInput) => Promise<boolean>; onCancel?: () => void }) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [target, setTarget] = useState(initial ? targetOf(initial) : MENU_TARGETS[0].href);
  const [custom, setCustom] = useState(initial && targetOf(initial) === CUSTOM ? initial.href : "/");
  const [parent, setParent] = useState(initial?.parent ?? "");
  const [isNew, setIsNew] = useState(initial?.isNew ?? false); const [inBar, setInBar] = useState(initial?.inBar ?? false); const [inFooter, setInFooter] = useState(initial?.inFooter ?? false);
  const hasSubs = !!self && tree.some((t) => t.id === self && t.children.length > 0);
  const parents = tree.filter((t) => t.id !== self && t.kind === "link");
  const id = self ?? "new";
  const value = (): MenuInput => {
    const kind: MenuKind = target === AUTO_GENRES ? "genres" : target === AUTO_UNDER ? "under" : "link";
    const href = target === CUSTOM ? custom.trim() : kind === "genres" ? "/games" : kind === "under" ? "/games?max=350" : target;
    return { label, href, kind, parent: parent || null, isNew, inBar: !parent && inBar, inFooter: !parent && inFooter };
  };
  return <form className="cat-form" onSubmit={async (e) => { e.preventDefault(); if (await onSubmit(value()) && !initial) { setLabel(""); setIsNew(false); setInBar(false); setInFooter(false); } }}>
    <label className="field"><span>Name</span><input id={`cat-name-${id}`} value={label} maxLength={MENU_LABEL_MAX} onChange={(e) => setLabel(e.target.value)} placeholder="For example: Trending now" required /></label>
    <label className="field"><span>Link target</span><select value={target} onChange={(e) => setTarget(e.target.value)}>
      <optgroup label="Listing pages and filters">{MENU_TARGETS.map((t) => <option key={t.href} value={t.href}>{t.label}</option>)}</optgroup>
      <optgroup label="Automatic"><option value={AUTO_GENRES}>Genres list (sub-menu of every shown genre)</option><option value={AUTO_UNDER}>Games under ฿350 (visitor currency)</option></optgroup>
      <option value={CUSTOM}>Custom store link…</option>
    </select></label>
    {target === CUSTOM && <label className="field"><span>Custom link</span><input value={custom} maxLength={MENU_HREF_MAX} spellCheck={false} onChange={(e) => setCustom(e.target.value)} placeholder="/games?platform=Steam" /></label>}
    <label className="field"><span>Place</span><select value={parent} disabled={hasSubs || target === AUTO_GENRES} onChange={(e) => setParent(e.target.value)}>
      <option value="">Top level</option>{parents.map((t) => <option key={t.id} value={t.id}>Under “{t.label}”</option>)}
    </select></label>
    <div className="cat-checks">
      <label className="check"><input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} /> Show NEW badge</label>
      {!parent && <label className="check"><input type="checkbox" checked={inBar} onChange={(e) => setInBar(e.target.checked)} /> In header bar</label>}
      {!parent && target !== AUTO_GENRES && target !== AUTO_UNDER && <label className="check"><input type="checkbox" checked={inFooter} onChange={(e) => setInFooter(e.target.checked)} /> In footer</label>}
    </div>
    {hasSubs && <p className="muted-note">This item has sub-items, so it stays at the top level.</p>}
    <div className="cat-buttons"><button className="btn btn-primary" disabled={busy || !label.trim()}>{submit}</button>{onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}

function Row({ m, tree, first, last, subs, busy, run }: { m: MenuItem; tree: MenuNode[]; first: boolean; last: boolean; subs: number; busy: boolean; run: (p: Promise<Res>, done: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"" | "edit" | "delete">("");
  return <>
    <div className="flt-row">
      <div className="flt-name"><strong>{m.label}</strong>{m.isNew && <span className="menu-new">New</span>}<small>{targetText(m)}</small></div>
      <span className="cat-places">{m.inBar && <span className="chip">Header bar</span>}{m.inFooter && <span className="chip">Footer</span>}</span>
      <span className={`chip${m.hidden ? "" : " chip-green"}`}>{m.hidden ? "Hidden" : "Shown"}</span>
      <div className="flt-actions">
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || first} onClick={() => run(adminApi.updateMenuItem(m.id, { move: -1 }), "Moved up")} aria-label={`Move ${m.label} up`}>↑</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || last} onClick={() => run(adminApi.updateMenuItem(m.id, { move: 1 }), "Moved down")} aria-label={`Move ${m.label} down`}>↓</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setMode(mode === "edit" ? "" : "edit")}>Edit<span className="sr-only"> {m.label}</span></button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(adminApi.updateMenuItem(m.id, { hidden: !m.hidden }), m.hidden ? "Shown" : "Hidden")}>{m.hidden ? "Show" : "Hide"}<span className="sr-only"> {m.label}</span></button>
        <button type="button" className="btn btn-outline btn-sm flt-del" disabled={busy} onClick={() => setMode(mode === "delete" ? "" : "delete")}>Delete<span className="sr-only"> {m.label}</span></button>
      </div>
    </div>
    {mode === "edit" && <div className="cat-edit" aria-label={`Edit ${m.label}`} role="group">
      <ItemForm tree={tree} initial={m} self={m.id} busy={busy} submit="Save" onCancel={() => setMode("")}
        onSubmit={async (v) => { const ok = await run(adminApi.updateMenuItem(m.id, v), `Saved ${v.label}`); if (ok) setMode(""); return ok; }} />
    </div>}
    {mode === "delete" && <div className="flt-confirm" role="alertdialog" aria-label={`Delete ${m.label}`}>
      <p>Delete “{m.label}”?{subs > 0 && <> Its {subs} {subs === 1 ? "sub-item is" : "sub-items are"} deleted too.</>} Shoppers no longer see it.</p>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(adminApi.deleteMenuItem(m.id), `Deleted ${m.label}`)}>Delete</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setMode("")}>Cancel</button></div>
    </div>}
  </>;
}

export default function Page() { return <AdminShell title="Menu & categories"><Categories /></AdminShell>; }
