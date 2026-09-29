import { setCatalog } from "@/lib/catalog";
import { api, isDemo } from "./api";
import { DEMO_CATALOG_KEY, demoCatalogAll } from "./demo-catalog";

// Browser catalog (task B). Until it loads, lib/catalog.ts serves the built-in seed (same as the static HTML).
// Demo: this browser's catalog, set at once. Server: /api/catalog once per page load (the cart and favorites wait for it before cleaning).
let ready: Promise<void> | null = null;
export function catalogReady() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!ready) {
    if (isDemo) {
      setCatalog(demoCatalogAll()); ready = Promise.resolve();
      window.addEventListener("storage", (e) => { if (e.key === DEMO_CATALOG_KEY) setCatalog(demoCatalogAll()); }); // admin edit in another tab
    } else ready = api.catalog().then((list) => { if (list) setCatalog(list); }).catch(() => { /* seed stays */ });
  }
  return ready;
}
// Admin pages call this after a save so the storefront parts on screen show the change.
export function reloadCatalog() {
  if (isDemo) { setCatalog(demoCatalogAll()); return Promise.resolve(); }
  return api.catalog().then((list) => { if (list) setCatalog(list); }).catch(() => { /* keep */ });
}
