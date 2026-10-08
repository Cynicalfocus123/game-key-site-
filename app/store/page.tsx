"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Product } from "@/lib/catalog";
import { publicMarketApi } from "@/lib/client/api";
import { STORE_PAGE_SIZE, type PublicStore } from "@/lib/marketplace";
import { searchProducts } from "@/lib/search";
import { useCatalog } from "../components/catalog";
import { assetPath, productHref } from "../components/cart-ui";
import { Price } from "../components/currency-provider";
import { RatingLine, SellerLogo, SellerTicks } from "../components/market-ui";
import { DemoBanner } from "../components/auth-ui";
import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

// Seller store page /store?s=<slug> (marketplace step 4, wireframe screen 2): logo (profile picture, no banner), name, ticks, rating,
// Selling since; search this store, Platform filter with counts, sort, the seller's game keys at the seller's price. A card opens the
// product page, where the buyer picks this seller's offer. Unknown / held / closed seller → "Store not found."
export default function StorePage() {
  return <><SiteHeader /><main className="cart-main mk-store-main"><DemoBanner /><Suspense fallback={<p className="muted-note">Loading…</p>}><StoreBySlug /></Suspense></main><SiteFooter /></>;
}

type Sort = "low" | "high" | "name";
function StoreBySlug() {
  const slug = useSearchParams().get("s") ?? ""; const all = useCatalog();
  const [store, setStore] = useState<PublicStore | null>(null); const [error, setError] = useState("");
  const [q, setQ] = useState(""); const [platform, setPlatform] = useState(""); const [sort, setSort] = useState<Sort>("low"); const [shown, setShown] = useState(STORE_PAGE_SIZE);
  useEffect(() => {
    let live = true; setStore(null); setError("");
    publicMarketApi.store(slug).then((r) => { if (!live) return; if (r.ok) setStore(r.store); else setError(r.error); });
    return () => { live = false; };
  }, [slug]);
  useEffect(() => { if (store) document.title = `${store.seller.name} | CoreCart`; }, [store]);
  const items = useMemo(() => (store?.offers ?? []).flatMap((o) => { const p = all.find((x) => x.id === o.productId); return p ? [{ p, unit: o.unit }] : []; }), [store, all]);
  const platforms = useMemo(() => [...new Set(items.map((i) => i.p.platform ?? "Other"))].sort().map((name) => ({ name, n: items.filter((i) => (i.p.platform ?? "Other") === name).length })), [items]);
  const list = useMemo(() => {
    const found = q.trim() ? new Set(searchProducts(items.map((i) => i.p), q).map((p) => p.id)) : null;
    const rows = items.filter((i) => (!found || found.has(i.p.id)) && (!platform || (i.p.platform ?? "Other") === platform));
    return rows.sort((a, b) => (sort === "name" ? a.p.name.localeCompare(b.p.name) : sort === "high" ? b.unit - a.unit : a.unit - b.unit));
  }, [items, q, platform, sort]);
  useEffect(() => { setShown(STORE_PAGE_SIZE); }, [q, platform, sort]);

  if (error) return <section className="cart-empty"><h1>{error}</h1><p>This store does not exist or is not selling right now.</p><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link></section>;
  if (!store) return <p className="muted-note">Loading store…</p>;
  const s = store.seller;
  return <>
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span>Store</span> <span aria-hidden="true">›</span> <span aria-current="page">{s.name}</span></nav>
    <header className="mk-store-head">
      <SellerLogo name={s.name} logo={s.logo} size={96} />
      <div><h1>{s.name}</h1><p className="mk-ticks"><SellerTicks s={s} /></p><p><RatingLine s={s} /></p>
        {s.since && <p className="muted-note">Selling on CoreCart since {new Date(s.since).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>}</div>
    </header>
    <div className="mk-store-layout">
      <aside className="mk-store-side" aria-label="Filters">
        <label className="field"><span>Search this store</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Game name" /></label>
        <fieldset className="mk-filter"><legend>Platform</legend>
          <label><input type="radio" name="mk-platform" checked={!platform} onChange={() => setPlatform("")} /> All <span className="muted-note">({items.length})</span></label>
          {platforms.map((x) => <label key={x.name}><input type="radio" name="mk-platform" checked={platform === x.name} onChange={() => setPlatform(x.name)} /> {x.name} <span className="muted-note">({x.n})</span></label>)}
        </fieldset>
      </aside>
      <section aria-label="Products">
        <div className="mk-store-bar"><p role="status"><b>{list.length}</b> result{list.length === 1 ? "" : "s"} found</p>
          <label className="mk-sort"><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="low">Lowest price</option><option value="high">Highest price</option><option value="name">Name A–Z</option></select></label></div>
        {!list.length ? <p className="muted-note">{items.length ? "No products match. Clear the search or the filter." : "This store has nothing for sale right now."}</p>
          : <div className="products lst-grid">{list.slice(0, shown).map((i) => <StoreCard key={i.p.id} p={i.p} unit={i.unit} />)}</div>}
        {list.length > shown && <button type="button" className="btn btn-outline mk-more" onClick={() => setShown((n) => n + STORE_PAGE_SIZE)}>Load more</button>}
      </section>
    </div>
  </>;
}
// Same look as the store cards, at the seller's price; opens the product page (the offer list is there).
function StoreCard({ p, unit }: { p: Product; unit: number }) {
  return <article className="product game"><div className="product-image"><Link href={productHref(p.id)} tabIndex={-1} aria-hidden="true"><Image src={assetPath(p.image)} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 17vw" /></Link></div>
    <div className="product-copy"><h3><Link className="product-link" href={productHref(p.id)}>{p.name}</Link></h3><p className="meta">{p.platform}</p><p className="card-region">{p.region}</p>
      <div className="price"><Price thb={unit} /></div>
      <Link className="cart-button mk-view" href={productHref(p.id)}>View offer</Link></div></article>;
}
