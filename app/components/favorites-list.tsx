"use client";

import Link from "next/link";
import { productById } from "@/lib/catalog";
import { AddToCartButton, assetPath, productHref, productMeta } from "./cart-ui";
import { Price } from "./currency-provider";
import { useFavorites } from "./favorites-provider";
import { HeartIcon } from "./icons";

// Saved products, newest first. Used by /account/favorites (signed in) and /favorites (guests, this browser).
export function FavoritesList() {
  const { ids, ready, remove } = useFavorites();
  const list = ids.map(productById).filter((p) => p !== undefined);
  return !ready ? <p className="muted-note">Loading…</p> : !list.length ? <div className="dash-card dash-empty">
    <span className="dash-empty-icon" aria-hidden="true"><HeartIcon /></span><strong>No favorites yet</strong><p>Tap ♡ on a game or part to save it here.</p>
    <Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link>
  </div> : <>
    <p className="muted-note fav-count">{list.length} saved {list.length === 1 ? "item" : "items"}</p>
    <ul className="fav-grid">{list.map((p) => <li key={p.id} className="fav-item">
      <Link href={productHref(p.id)} className="fav-cover" tabIndex={-1} aria-hidden="true"><img src={assetPath(p.image)} alt="" loading="lazy" /></Link>
      <div className="fav-body">
        <Link className="fav-title" href={productHref(p.id)}>{p.name}</Link>
        <span className="fav-meta">{productMeta(p)}</span>
        <strong className="fav-price"><Price thb={p.price} /></strong>
      </div>
      <div className="fav-actions"><AddToCartButton productId={p.id} /><button type="button" className="fav-remove" onClick={() => remove(p.id)} aria-label={`Remove ${p.name} from favorites`}><HeartIcon filled /> Remove</button></div>
    </li>)}</ul>
  </>;
}
