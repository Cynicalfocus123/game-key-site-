"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { maxQty, productById, regionWorks, type Product } from "@/lib/catalog";
import { guideFor } from "@/lib/keys";
import { countryName } from "@/lib/profile";
import { productInfo } from "@/lib/product-info";
import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import { DemoBanner, readQuery } from "../components/auth-ui";
import { useCart } from "../components/cart-provider";
import { assetPath, RegionLine, TrustList, useVisitorCountry } from "../components/cart-ui";
import { Price } from "../components/currency-provider";
import { FavoriteButton } from "../components/favorites-provider";

// Product page (Handoff v12 2c): /product?id= for every catalog product (static export → query id).
export default function ProductPage() {
  const [p, setP] = useState<Product | null | undefined>(undefined);
  useEffect(() => { const id = readQuery("id"); setP(id ? productById(id) ?? null : null); }, []);
  useEffect(() => { if (p) document.title = `${p.name} | CoreCart`; }, [p]);
  return <><SiteHeader /><main className="pdp-main"><DemoBanner />
    {p === undefined ? <p className="muted-note">Loading…</p> : p === null ? <section className="cart-empty"><h1>Product not found</h1><p>This product is not in the store.</p><Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link></section> : <ProductView p={p} />}
  </main><SiteFooter /></>;
}

function ProductView({ p }: { p: Product }) {
  const { items, add, checkout } = useCart(); const country = useVisitorCountry();
  const game = p.kind === "game_key"; const info = productInfo(p); const guide = guideFor(p.platform);
  const max = maxQty(p); const inCart = items.find((e) => e.productId === p.id)?.qty ?? 0; const atLimit = inCart >= max;
  const works = regionWorks(p, country); const where = country ? countryName(country) : "your country";
  const [added, setAdded] = useState(false);
  useEffect(() => { if (!added) return; const t = setTimeout(() => setAdded(false), 1500); return () => clearTimeout(t); }, [added]);
  const addToCart = () => { if (add(p.id) === "added") setAdded(true); };
  const buyNow = () => { if (!inCart && add(p.id) !== "added") return; checkout(); };
  const addLabel = added ? "Added ✓" : atLimit ? "Limit reached" : "Add to cart";

  const tiles: { label: string; value: React.ReactNode; note?: React.ReactNode }[] = game ? [
    { label: "Region", value: p.region ?? "Global", note: <><span className={works === false ? "bad" : "ok"}>{works === false ? `Cannot be activated in ${where}` : `Can be activated in ${where}`}</span>{guide && <Link className="text-link" href={`/help/activate/${guide.slug}#region`}>Check region restrictions</Link>}</> },
    { label: "Platform", value: p.platform ?? "—", note: guide && <Link className="text-link" href={`/help/activate/${guide.slug}`}>Activation guide</Link> },
    { label: "Digital key", value: "Instant delivery", note: "Code in your Keys library after payment" },
    { label: "Refunds", value: "Before reveal", note: "Refundable until you reveal the key" },
  ] : [
    { label: "Stock", value: (p.stock ?? 0) > 5 ? "In stock" : (p.stock ?? 0) > 0 ? `Only ${p.stock} left` : "Out of stock", note: (p.stock ?? 0) > 0 && `${p.stock} available` },
    { label: "Shipping", value: "Free shipping", note: "Ships from Bangkok" },
    { label: "Warranty", value: info.warranty ?? "Manufacturer warranty" },
    { label: "Returns", value: "Support ticket", note: "Open a ticket for faulty items" },
  ];

  return <>
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span>{game ? "Digital games" : "PC parts"}</span> <span aria-hidden="true">›</span> <span aria-current="page">{p.name}</span></nav>
    <div className="pdp">
      <div className="pdp-media"><img src={assetPath(p.image)} alt={p.name} /></div>
      <div className="pdp-info">
        <div className="pdp-title"><h1>{p.name}</h1><FavoriteButton productId={p.id} name={p.name} variant="title" /></div>
        <p className="pdp-meta">{game ? [p.platform, p.region, "Instant key"].join(" · ") : [p.rating && `★ ${p.rating}`, "Hardware"].filter(Boolean).join(" · ")}</p>
        <div className="cart-row-info pdp-region"><RegionLine p={p} /></div>
        <dl className="pdp-facts">{tiles.map((t) => <div key={t.label}><dt>{t.label}</dt><dd>{t.value}</dd>{t.note && <div className="pdp-fact-note">{t.note}</div>}</div>)}</dl>
        <div className="pdp-buy">
          <div className="pdp-price"><Price thb={p.price} />{p.old && <del><Price thb={p.old} /></del>}</div>
          <p className="pdp-limit">{game ? `Max ${max} per order` : `Up to ${max} per order`}{inCart > 0 && ` · ${inCart} in your cart`}</p>
          {works === false && <p className="pdp-warn" role="note">This key does not work in {where}. Buy it only if you will activate it in another region.</p>}
          <div className="pdp-actions"><button type="button" className={`btn btn-outline${added ? " is-added" : ""}`} onClick={addToCart} disabled={atLimit && !added}>{addLabel}</button><button type="button" className="btn btn-primary" onClick={buyNow} disabled={max === 0}>Buy now</button></div>
          <TrustList keys={game} hardware={!game} />
        </div>
      </div>
    </div>
    <div className="pdp-more">
      <section><h2>Description</h2><p>{info.description}</p></section>
      {game && info.requirements && <section><h2>System requirements <small>(minimum)</small></h2><dl className="pdp-reqs">{info.requirements.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>}
      {game && guide && <section><h2>How to activate</h2><ol className="pdp-steps">{guide.steps.slice(0, 3).map((s) => <li key={s}>{s}</li>)}</ol><Link className="text-link" href={`/help/activate/${guide.slug}`}>Full {guide.name} activation guide ›</Link></section>}
    </div>
    <div className="pdp-sticky"><div><Price thb={p.price} /></div><button type="button" className="btn btn-outline" onClick={addToCart} disabled={atLimit && !added}>{addLabel}</button><button type="button" className="btn btn-primary" onClick={buyNow} disabled={max === 0}>Buy now</button></div>
  </>;
}
