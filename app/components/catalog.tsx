"use client";

import { useEffect, useSyncExternalStore } from "react";
import { allProducts, SEED_PRODUCTS, subscribeCatalog } from "@/lib/catalog";
import { catalogReady, catalogStatus, subscribeCatalogStatus } from "@/lib/client/catalog";

const seedLive = SEED_PRODUCTS.filter((p) => (p.status ?? "published") === "published");
// Published products for rendering. The first (hydration) render uses the seed like the static HTML, then the live catalog.
export function useCatalog() {
  useEffect(() => { catalogReady(); }, []);
  return useSyncExternalStore(subscribeCatalog, allProducts, () => seedLive);
}

// R5: shown while the server catalog could not be loaded yet (it keeps retrying). Seed prices are never presented as current.
export function CatalogNotice() {
  const status = useSyncExternalStore(subscribeCatalogStatus, catalogStatus, () => "live" as const);
  return status === "retrying" ? <p className="coupon-note" role="status">Live prices could not be loaded yet. Retrying… Prices shown may be out of date; the cart and checkout wait for them.</p> : null;
}
