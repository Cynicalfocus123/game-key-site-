"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, api, money } from "@/lib/client/api";
import { reloadCatalog } from "@/lib/client/catalog";
import { usdPrices, USD_RATE_INFO, type Product } from "@/lib/catalog";
import type { RateInfo } from "@/lib/currency/money";
import type { KeyCounts } from "@/lib/key-inventory";
import { AdminShell } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";
import { assetPath } from "../../components/cart-ui";

// Admin products list (task B): search, kind + status filters, table with cover, facts, price, flags. Row name opens the editor.
type Kind = "" | "game_key" | "hardware"; type Status = "" | "published" | "draft";
// USD prices (user 2026-10-18): the list shows the USD price admins enter (older THB-only products at today's rate).
const usd = (cents: number) => money(cents, "USD");

function Products() {
  const [list, setList] = useState<Product[] | null>(null); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const [q, setQ] = useState(""); const [kind, setKind] = useState<Kind>(""); const [status, setStatus] = useState<Status>("");
  const [deleting, setDeleting] = useState<Product | null>(null); const [keys, setKeys] = useState<Record<string, KeyCounts>>({});
  const [rates, setRates] = useState<{ usd: RateInfo; base: RateInfo }>({ usd: USD_RATE_INFO, base: { code: "THB", decimals: 2, rate: "33.38" } });
  useEffect(() => { api.currencies().then((c) => { if (c) setRates({ usd: c.currencies.find((x) => x.code === "USD") ?? USD_RATE_INFO, base: c.base }); }).catch(() => {}); }, []);
  const load = useCallback(async () => {
    const [r, k] = await Promise.all([adminApi.products(), adminApi.keyCounts()]);
    if (r.ok) setList(r.products); else setError(r.error); if (k.ok) setKeys(k.counts);
  }, []);
  useEffect(() => { load(); setSaved(new URLSearchParams(window.location.search).get("saved") ?? ""); }, [load]);
  const remove = async (p: Product) => {
    setDeleting(null); setError(""); setSaved("");
    const r = await adminApi.deleteProduct(p.id); if (!r.ok) setError(r.error); else { setSaved(`${p.name} deleted.`); reloadCatalog(); }
    await load();
  };
  const t = q.trim().toLowerCase();
  const rows = (list ?? []).filter((p) => (!kind || p.kind === kind) && (!status || (p.status ?? "published") === status)
    && (!t || [p.name, p.id, p.platform, p.region, p.edition].some((v) => v?.toLowerCase().includes(t))));
  return <>
    <div className="pc-top"><p className="adm-count">{list ? `${list.length} products · ${list.filter((p) => p.status === "draft").length} drafts` : "Products in the store."}</p>
      <Link className="btn btn-primary" href="/admin/products/edit">Add product</Link></div>
    {saved && <Notice tone="success">{saved}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Name, ID, platform, region" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label className="field"><span>Kind</span><select value={kind} onChange={(e) => setKind(e.target.value as Kind)}><option value="">All</option><option value="game_key">Game keys</option><option value="hardware">Hardware</option></select></label>
      <label className="field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value as Status)}><option value="">All</option><option value="published">Published</option><option value="draft">Draft</option></select></label>
    </div>
    {!list ? !error && <p className="muted-note">Loading…</p> : !rows.length ? <div className="adm-panel pc-empty"><strong>{list.length ? "No products match." : "No products yet"}</strong></div>
      : <div className="adm-table-wrap"><table className="adm-table static prod-table">
        <thead><tr><th><span className="sr-only">Image</span></th><th>Product</th><th>Platform · region</th><th className="num">Price (USD)</th><th className="num">Keys</th><th>Flags</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{rows.map((p) => { const edit = `/admin/products/edit?id=${encodeURIComponent(p.id)}`; return <tr key={p.id}>
          <td className="prod-thumb"><img src={assetPath(p.image)} alt="" width={40} height={50} loading="lazy" /></td>
          <td className="prod-name"><Link href={edit}><strong>{p.name}</strong></Link><small>{p.id}{p.edition ? ` · ${p.edition}` : ""}</small></td>
          <td>{p.kind === "game_key" ? `${p.platform} · ${p.region}` : "Hardware"}<small>{p.kind === "game_key" ? p.type ?? "Game" : `Stock ${p.stock ?? 0}`}</small></td>
          <td className="num">{(() => { const u = usdPrices(p, rates.usd, rates.base); return <>{usd(u.price)}{u.old ? <small><del>{usd(u.old)}</del></small> : null}</>; })()}</td>
          <td className="num">{p.kind === "game_key" ? <Link className="text-link" href={`/admin/products/keys?id=${encodeURIComponent(p.id)}`} aria-label={`Keys for ${p.name}: ${keys[p.id]?.available ?? 0} available`}>{keys[p.id]?.available ?? 0}</Link> : "—"}{p.kind === "game_key" && <small>available</small>}</td>
          <td>{[p.trending && "Trending", p.isNew && "New", p.soldOut && "Sold out"].filter(Boolean).join(" · ") || "—"}</td>
          <td><span className={`chip ${p.status === "draft" ? "" : "chip-green"}`}>{p.status === "draft" ? "Draft" : "Published"}</span></td>
          <td className="prod-actions"><Link className="text-link" href={edit} aria-label={`Edit ${p.name}`}>Edit</Link><button type="button" className="pc-danger" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>Delete</button></td>
        </tr>; })}</tbody>
      </table></div>}
    {deleting && <ConfirmDelete p={deleting} onCancel={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
  </>;
}

function ConfirmDelete({ p, onCancel, onConfirm }: { p: Product; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="pc-dialog" ref={ref} aria-labelledby="prod-del-h" onClose={onCancel}>
    <h2 id="prod-del-h">Delete {p.name}?</h2>
    <p>It leaves the store, carts and favorites. Past orders keep its name. Its ID cannot be used again.</p>
    <div className="gc-actions"><button type="button" className="btn btn-outline" onClick={onCancel} autoFocus>Cancel</button><button type="button" className="btn pc-btn-danger" onClick={onConfirm}>Delete</button></div>
  </dialog>;
}

export default function Page() { return <AdminShell title="Products"><Products /></AdminShell>; }
