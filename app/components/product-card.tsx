"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { AddToCartButton, assetPath, productHref } from "./cart-ui";
import { Price } from "./currency-provider";
import { FavoriteButton } from "./favorites-provider";

// Card image + title open the product page; ♡ sits in the image corner.
export function ProductCard({ item }: { item: Product }) { const game = item.kind === "game_key"; return <article className={`product ${game ? "game" : ""}`}><div className="product-image"><Link href={productHref(item.id)} tabIndex={-1} aria-hidden="true"><Image src={assetPath(item.image)} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 17vw" /></Link><FavoriteButton productId={item.id} name={item.name} variant="card" /></div><div className="product-copy"><h3><Link className="product-link" href={productHref(item.id)}>{item.name}</Link></h3>{game ? <p className="meta">{item.platform} · {item.region}</p> : <p className="rating">★★★★★ <span>{item.rating}</span></p>}<div className="price">{game && <small>From </small>}<Price thb={item.price} /> {item.old && <del><Price thb={item.old} /></del>}</div><div className="product-bottom">{game ? <span className="stock">Instant delivery</span> : <><span className="stock">In Stock</span><span className="shipping">Free shipping</span></>} </div><AddToCartButton productId={item.id} /></div></article> }
