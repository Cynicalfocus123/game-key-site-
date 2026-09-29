"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { adminApi, isDemo, money } from "@/lib/client/api";
import { reloadCatalog } from "@/lib/client/catalog";
import type { Product } from "@/lib/catalog";
import type { FilterOption } from "@/lib/filters";
import { COUNTRY_PRESETS, HARDWARE_CATEGORIES, parseProduct, PLATFORM_SUGGESTIONS, PRODUCT_TYPES, REGION_SUGGESTIONS, regionRule, slugify, suggestId, type RegionRule } from "@/lib/products";
import { AdminShell } from "../../../components/admin-shell";
import { Notice } from "../../../components/auth-ui";
import { ImageCropper } from "../../../components/image-cropper";

// Add / edit product (task B). Cards left (basics, image, price, region, details, text), Summary right (status, flags, save).
// Every rule is lib/products.ts parseProduct, the same check the server runs.
type Form = {
  kind: Product["kind"]; id: string; idTouched: boolean; name: string; image: string; price: string; old: string; status: "published" | "draft";
  platform: string; region: string; os: string; type: string; rule: RegionRule; countries: string; genres: string[]; family: string; edition: string;
  category: string; stock: string; soldOut: boolean; isNew: boolean; trending: boolean; description: string; requirements: [string, string][]; warranty: string;
  popularity: string; added: string; rating?: string;
};
const baht = (satang?: number) => (satang === undefined ? "" : (satang / 100).toFixed(2));
const satang = (s: string) => (/^\d+(\.\d{1,2})?$/.test(s.trim()) ? Math.round(Number(s) * 100) : NaN);
const blank = (): Form => ({ kind: "game_key", id: "", idTouched: false, name: "", image: "", price: "", old: "", status: "draft", platform: "Steam", region: "Global", os: "Windows", type: "Game",
  rule: "everywhere", countries: "", genres: [], family: "", edition: "", category: "pc-parts", stock: "0", soldOut: false, isNew: true, trending: false, description: "",
  requirements: [["OS", ""], ["Processor", ""], ["Memory", ""], ["Graphics", ""], ["Storage", ""]], warranty: "", popularity: "50", added: new Date().toISOString().slice(0, 10) });
const fromProduct = (p: Product): Form => ({ kind: p.kind, id: p.id, idTouched: true, name: p.name, image: p.image, price: baht(p.price), old: baht(p.old), status: p.status === "draft" ? "draft" : "published",
  platform: p.platform ?? "", region: p.region ?? "", os: p.os ?? "", type: p.type ?? "Game", rule: regionRule(p), countries: (p.only ?? p.excluded ?? []).join(", "), genres: p.genres ?? [],
  family: p.family ?? "", edition: p.edition ?? "", category: p.category, stock: String(p.stock ?? 0), soldOut: Boolean(p.soldOut), isNew: Boolean(p.isNew), trending: Boolean(p.trending),
  description: p.description ?? "", requirements: p.requirements ?? [], warranty: p.warranty ?? "", popularity: String(p.popularity ?? 50), added: p.added ?? new Date().toISOString().slice(0, 10), rating: p.rating });
const toInput = (f: Form) => ({ kind: f.kind, id: f.id, name: f.name, image: f.image, price: satang(f.price), old: f.old.trim() ? satang(f.old) : null, status: f.status,
  platform: f.platform, region: f.region, os: f.os, type: f.type, rule: f.rule, countries: f.countries.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean), genres: f.genres,
  family: f.family, edition: f.edition, category: f.category, stock: Number(f.stock), soldOut: f.soldOut, isNew: f.isNew, trending: f.trending, description: f.description,
  requirements: f.requirements.filter(([k, v]) => k.trim() && v.trim()), warranty: f.warranty, popularity: Number(f.popularity), added: f.added, rating: f.rating });

function Editor() {
  const router = useRouter();
  const [isNew, setIsNew] = useState(true); const [form, setForm] = useState<Form | null>(null); const [initial, setInitial] = useState("");
  const [genres, setGenres] = useState<FilterOption[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false);
  useEffect(() => {
    const edit = new URLSearchParams(window.location.search).get("id");
    const start = (f: Form) => { setForm(f); setInitial(JSON.stringify(f)); };
    adminApi.filters().then((r) => { if (r.ok) setGenres(r.config.options.filter((o) => o.group === "genre" && !o.deleted).sort((a, b) => a.position - b.position)); });
    if (!edit) { start(blank()); return; }
    adminApi.product(edit).then((r) => { if (!r.ok) { setError(r.error); return; } setIsNew(false); start(fromProduct(r.product)); });
  }, []);
  const dirty = form !== null && JSON.stringify(form) !== initial;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const check = useMemo(() => (form ? parseProduct(toInput(form), { allowData: isDemo }) : null), [form]);
  if (!form || !check) return error ? <Notice tone="error">{error}</Notice> : <p className="muted-note">Loading…</p>;
  const game = form.kind === "game_key";
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => {
    if (!f) return f; const next = { ...f, [k]: v };
    if (isNew && !next.idTouched && ["name", "platform", "region", "kind"].includes(k as string)) next.id = suggestId(next.name, next.kind, next.platform, next.region);
    return next;
  });
  const leave = (e?: React.MouseEvent) => { if (dirty && !window.confirm("Discard unsaved changes?")) { e?.preventDefault(); return false; } return true; };
  const upload = async (dataUrl: string) => { const r = await adminApi.uploadProductImage(dataUrl); if (!r.ok) { setError(r.error); return null; } set("image", r.url); return r.url; };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setTried(true); setError("");
    if (!check.ok) { setError(check.error); return; }
    setBusy(true); const r = await adminApi.saveProduct(toInput(form), isNew); setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setInitial(JSON.stringify(form)); await reloadCatalog();
    router.push(`/admin/products?saved=${encodeURIComponent(`${r.product.name} saved.`)}`);
  };
  const price = satang(form.price); const old = satang(form.old); const off = price > 0 && old > price ? Math.round((1 - price / old) * 100) : null;
  const toggleGenre = (v: string) => set("genres", form.genres.includes(v) ? form.genres.filter((g) => g !== v) : [...form.genres, v]);
  const addCodes = (codes: string[]) => set("countries", [...new Set([...form.countries.split(/[\s,;]+/).filter(Boolean).map((c) => c.toUpperCase()), ...codes])].join(", "));
  const genreList = [...genres.map((g) => ({ value: g.value, label: g.label })), ...form.genres.filter((g) => !genres.some((o) => o.value === g)).map((g) => ({ value: g, label: g }))];

  return <form className="pc-editor prod-editor" onSubmit={save} noValidate>
    <p className="adm-back"><Link className="text-link" href="/admin/products" onClick={leave}>‹ Products</Link></p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="pc-layout">
      <div className="pc-cards">
        <section className="adm-panel" aria-labelledby="p-basics"><h2 id="p-basics">Basics</h2>
          <div className="seg pc-type" role="radiogroup" aria-label="Product kind">
            {(["game_key", "hardware"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={form.kind === k} aria-pressed={form.kind === k} disabled={!isNew} onClick={() => set("kind", k)}>{k === "game_key" ? "Game key" : "Hardware"}</button>)}
          </div>
          <label className="field" htmlFor="p-name">Name</label>
          <input id="p-name" value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder={game ? "e.g. Elden Ring" : "e.g. Samsung 990 PRO 2TB NVMe SSD"} />
          <label className="field" htmlFor="p-id">Product ID</label>
          <input id="p-id" value={form.id} maxLength={80} disabled={!isNew} spellCheck={false} onChange={(e) => setForm({ ...form, id: slugify(e.target.value), idTouched: true })} />
          <small className="muted-note">{isNew ? "Used in the product link. It cannot change after the product is created." : "The ID cannot change (carts, favorites and orders use it)."}</small>
          {game && <div className="prod-grid">
            <label className="field">Product type<select value={form.type} onChange={(e) => set("type", e.target.value)}>{PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field">Platform<input list="p-platforms" value={form.platform} maxLength={40} onChange={(e) => set("platform", e.target.value)} /></label>
            <label className="field">Works on (OS)<input value={form.os} maxLength={40} placeholder="e.g. Windows" onChange={(e) => set("os", e.target.value)} /></label>
          </div>}
          {!game && <div className="prod-grid">
            <label className="field">Category<select value={form.category} onChange={(e) => set("category", e.target.value)}>{HARDWARE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label className="field">Stock<input inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} /></label>
          </div>}
          <datalist id="p-platforms">{PLATFORM_SUGGESTIONS.map((p) => <option key={p} value={p} />)}</datalist>
        </section>

        <section className="adm-panel" aria-labelledby="p-image"><h2 id="p-image">Product image</h2>
          <ImageCropper value={form.image} name={form.name} onUpload={upload} invalid={tried} />
        </section>

        <section className="adm-panel" aria-labelledby="p-price"><h2 id="p-price">Price (THB)</h2>
          <div className="prod-grid">
            <label className="field" htmlFor="p-price-in">Price<div className="pc-affix"><span aria-hidden="true">฿</span><input id="p-price-in" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} /></div></label>
            <label className="field" htmlFor="p-old-in">Old price (optional)<div className="pc-affix"><span aria-hidden="true">฿</span><input id="p-old-in" inputMode="decimal" value={form.old} onChange={(e) => set("old", e.target.value)} /></div></label>
          </div>
          <small className="muted-note">{off !== null ? `Shows as −${off}% on sale (old price crossed out). "On sale" lists include it.` : "Add an old price higher than the price to show a discount."} Customers see prices in their currency.</small>
        </section>

        {game && <fieldset className="adm-panel"><legend>Region</legend>
          <label className="field" htmlFor="p-region">Region name (shown on the card)</label>
          <input id="p-region" list="p-regions" value={form.region} maxLength={40} onChange={(e) => set("region", e.target.value)} />
          <datalist id="p-regions">{REGION_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
          <p className="field">Where the key can be activated</p>
          <label className="pc-check"><input type="radio" name="rule" checked={form.rule === "everywhere"} onChange={() => set("rule", "everywhere")} /> Every country (Global)</label>
          <label className="pc-check"><input type="radio" name="rule" checked={form.rule === "only"} onChange={() => set("rule", "only")} /> Only in these countries</label>
          <label className="pc-check"><input type="radio" name="rule" checked={form.rule === "excluded"} onChange={() => set("rule", "excluded")} /> Every country except these (ROW)</label>
          {form.rule !== "everywhere" && <>
            <label className="field" htmlFor="p-countries">Country codes (2 letters, comma separated)</label>
            <textarea id="p-countries" rows={3} value={form.countries} onChange={(e) => set("countries", e.target.value.toUpperCase())} placeholder="TH, SG, MY" />
            <div className="prod-presets"><small>Add:</small>{COUNTRY_PRESETS.map((p) => <button key={p.label} type="button" className="btn btn-outline btn-sm" onClick={() => addCodes(p.codes)}>{p.label}</button>)}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set("countries", "")}>Clear</button></div>
          </>}
        </fieldset>}

        {game && <fieldset className="adm-panel"><legend>Game group (platform / edition picker)</legend>
          <div className="prod-grid">
            <label className="field">Game group<input value={form.family} maxLength={60} placeholder="e.g. elden-ring" onChange={(e) => set("family", slugify(e.target.value))} /></label>
            <label className="field">Edition<input value={form.edition} maxLength={40} placeholder="e.g. Standard, Deluxe" onChange={(e) => set("edition", e.target.value)} /></label>
          </div>
          <small className="muted-note">Products with the same game group show Platform / Edition / Region buttons on the product page.</small>
          <button type="button" className="btn btn-outline btn-sm prod-fam" onClick={() => set("family", slugify(form.name.replace(/\b(standard|deluxe|gold|ultimate|complete|digital|edition)\b/gi, "")))} disabled={!form.name}>Use the name</button>
        </fieldset>}

        {game && <fieldset className="adm-panel"><legend>Genres</legend>
          <div className="prod-genres">{genreList.map((g) => <label key={g.value} className="pc-check"><input type="checkbox" checked={form.genres.includes(g.value)} onChange={() => toggleGenre(g.value)} /> {g.label}</label>)}</div>
          <small className="muted-note">Add, rename or remove genres in <Link className="text-link" href="/admin/filters">Filters</Link>.</small>
        </fieldset>}

        <section className="adm-panel" aria-labelledby="p-text"><h2 id="p-text">Product page text</h2>
          <label className="field" htmlFor="p-desc">Description</label>
          <textarea id="p-desc" rows={5} maxLength={4000} value={form.description} onChange={(e) => set("description", e.target.value)} />
          {game ? <><p className="field">System requirements (minimum)</p>
            {form.requirements.map(([k, v], i) => <div className="prod-req" key={i}>
              <input aria-label={`Requirement ${i + 1} name`} value={k} maxLength={40} onChange={(e) => set("requirements", form.requirements.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} />
              <input aria-label={`Requirement ${i + 1} value`} value={v} maxLength={200} onChange={(e) => set("requirements", form.requirements.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} />
              <button type="button" className="x" aria-label={`Remove requirement ${i + 1}`} onClick={() => set("requirements", form.requirements.filter((_, j) => j !== i))}>×</button>
            </div>)}
            {form.requirements.length < 12 && <button type="button" className="btn btn-outline btn-sm" onClick={() => set("requirements", [...form.requirements, ["", ""]])}>Add row</button>}</>
            : <><label className="field" htmlFor="p-warranty">Warranty</label><input id="p-warranty" value={form.warranty} maxLength={120} placeholder="e.g. 3-year manufacturer warranty" onChange={(e) => set("warranty", e.target.value)} /></>}
        </section>
      </div>

      <aside className="adm-panel pc-summary" aria-labelledby="p-sum">
        <h2 id="p-sum">Summary</h2>
        <p className="pc-sum-code">{form.name || <span className="muted-note">No name yet</span>}</p>
        <ul aria-live="polite">
          <li>{game ? `${form.platform || "—"} · ${form.region || "—"} · ${form.type}` : "Hardware"}</li>
          <li>{price > 0 ? money(price, "THB") : "No price yet"}{off !== null ? ` (−${off}%)` : ""}</li>
          {game && <li>{form.rule === "everywhere" ? "Works in every country" : `${form.rule === "only" ? "Only" : "Not"} in ${toInput(form).countries.length} countries`}</li>}
          <li>{form.image ? "Image ready (800 × 1000)" : "No image yet"}</li>
        </ul>
        <fieldset className="prod-flags"><legend>Status</legend>
          <label className="pc-check"><input type="radio" name="status" checked={form.status === "published"} onChange={() => set("status", "published")} /> Published (in the store)</label>
          <label className="pc-check"><input type="radio" name="status" checked={form.status === "draft"} onChange={() => set("status", "draft")} /> Draft (admin only)</label>
        </fieldset>
        <fieldset className="prod-flags"><legend>Menu flags</legend>
          <label className="pc-check"><input type="checkbox" checked={form.trending} onChange={(e) => set("trending", e.target.checked)} /> Trending now</label>
          <label className="pc-check"><input type="checkbox" checked={form.isNew} onChange={(e) => set("isNew", e.target.checked)} /> New</label>
          <label className="pc-check"><input type="checkbox" checked={form.soldOut} onChange={(e) => set("soldOut", e.target.checked)} /> Sold out</label>
        </fieldset>
        {tried && !check.ok && <p className="field-error" role="alert">{check.error}</p>}
        <div className="pc-save"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isNew ? "Create product" : "Save changes"}</button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { if (leave()) { setInitial(JSON.stringify(form)); router.push("/admin/products"); } }}>Discard</button></div>
        {dirty && <small className="muted-note">Unsaved changes</small>}
        {!isNew && game && <Link className="text-link prod-side-link" href={`/admin/products/keys?id=${encodeURIComponent(form.id)}`}>Manage game keys</Link>}
        {!isNew && form.status === "published" && <Link className="text-link prod-side-link" href={`/product?id=${encodeURIComponent(form.id)}`}>View in store</Link>}
      </aside>
    </div>
  </form>;
}

export default function Page() {
  const [title, setTitle] = useState("Add product");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("id")) setTitle("Edit product"); }, []);
  return <AdminShell title={title}><Editor /></AdminShell>;
}
