"use client";

import { useEffect, useSyncExternalStore } from "react";
import { allProducts, SEED_PRODUCTS, subscribeCatalog } from "@/lib/catalog";
import { catalogReady } from "@/lib/client/catalog";

const seedLive = SEED_PRODUCTS.filter((p) => (p.status ?? "published") === "published");
// Published products for rendering. The first (hydration) render uses the seed like the static HTML, then the live catalog.
export function useCatalog() {
  useEffect(() => { catalogReady(); }, []);
  return useSyncExternalStore(subscribeCatalog, allProducts, () => seedLive);
}
