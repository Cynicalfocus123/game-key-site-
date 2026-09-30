import { setCatalog } from "@/lib/catalog";
import { api, isDemo } from "./api";
import { DEMO_CATALOG_KEY, demoCatalogAll } from "./demo-catalog";

// Browser catalog (task B). Until it loads, lib/catalog.ts serves the built-in seed (same as the static HTML).
// Demo: this browser's catalog, set at once. Server: /api/catalog once per page load (the cart and favorites wait for it before cleaning).
// R5 (server): a failed load (error OR null answer) is retried (1 s, 2 s, 4 s … then every 30 s, and at once when the tab comes back
// online / into focus). catalogReady() resolves only when the real catalog is in, so the cart, favorites and checkout never treat the
// seed prices as current. catalogStatus() = "loading" | "live" | "retrying" for notices.
export type CatalogStatus = "loading" | "live" | "retrying";
let ready: Promise<void> | null = null;
let status: CatalogStatus = isDemo ? "live" : "loading";
const listeners = new Set<() => void>();
const setStatus = (s: CatalogStatus) => { if (status !== s) { status = s; listeners.forEach((f) => f()); } };
export const catalogStatus = () => status;
export const subscribeCatalogStatus = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

async function loadOnce() { const list = await api.catalog().catch(() => null); if (!list) return false; setCatalog(list); setStatus("live"); return true; }
function loadWithRetry() {
  return new Promise<void>((resolve) => {
    let tries = 0; let timer: ReturnType<typeof setTimeout> | null = null; let busy = false;
    const now = () => { if (busy || !timer) return; clearTimeout(timer); timer = null; attempt(); }; // only while waiting for a retry
    const stop = () => { window.removeEventListener("online", now); window.removeEventListener("focus", now); };
    const attempt = async () => {
      timer = null; busy = true; const done = await loadOnce(); busy = false;
      if (done) { stop(); resolve(); return; }
      setStatus("retrying"); tries++;
      timer = setTimeout(attempt, Math.min(1000 * 2 ** (tries - 1), 30_000));
    };
    window.addEventListener("online", now); window.addEventListener("focus", now);
    attempt();
  });
}

export function catalogReady() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!ready) {
    if (isDemo) {
      setCatalog(demoCatalogAll()); ready = Promise.resolve();
      window.addEventListener("storage", (e) => { if (e.key === DEMO_CATALOG_KEY) setCatalog(demoCatalogAll()); }); // admin edit in another tab
    } else ready = loadWithRetry();
  }
  return ready;
}
// Admin pages call this after a save so the storefront parts on screen show the change. A failed reload keeps the last live catalog.
export function reloadCatalog() {
  if (isDemo) { setCatalog(demoCatalogAll()); return Promise.resolve(); }
  return loadOnce().then(() => undefined);
}
