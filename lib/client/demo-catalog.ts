import { localPrices, SEED_ADDED, SEED_PRODUCTS, setCatalog, upgradeProduct, USD_RATE_INFO, type Product } from "@/lib/catalog";
import { rateString } from "@/lib/currency/money";
import fallback from "@/lib/currency/fallback-rates.json";

// USD prices (user 2026-10-18): the demo works out THB from the stored USD price with the built-in rate (lib/currency/fallback-rates.json).
const DEMO_THB = { code: "THB", decimals: 2, rate: rateString(fallback.rates.THB) };
export const demoLocal = (p: Product) => localPrices(p, USD_RATE_INFO, DEMO_THB);

// Demo catalog (task B, GitHub Pages): every product incl. drafts in this browser. Missing = the built-in seed.
// Uploaded images are data URLs saved with the product (browser storage holds about 5 MB, roughly 20–30 images).
export const DEMO_CATALOG_KEY = "corecart-demo-catalog-v1";
export function demoCatalogAll(): Product[] {
  try {
    const v = JSON.parse(localStorage.getItem(DEMO_CATALOG_KEY) || "null");
    if (Array.isArray(v?.products)) {
      // Seed products added later (SEED_ADDED) join a saved catalog once, so a product the admin deleted afterwards stays deleted.
      let list = v.products as Product[]; const seen = Number(v.seedV ?? 1); const add = SEED_ADDED.filter((a) => a.v > seen);
      if (add.length) {
        const have = new Set(list.map((p) => p.id)); const ids = new Set(add.flatMap((a) => a.ids));
        list = [...list, ...SEED_PRODUCTS.filter((p) => ids.has(p.id) && !have.has(p.id))];
        localStorage.setItem(DEMO_CATALOG_KEY, JSON.stringify({ products: list, seedV: Math.max(...add.map((a) => a.v)) }));
      }
      return list.map(upgradeProduct).map(demoLocal);
    }
  } catch { /* storage blocked or bad data */ }
  return SEED_PRODUCTS;
}
export function saveDemoCatalog(list: Product[]) {
  try { localStorage.setItem(DEMO_CATALOG_KEY, JSON.stringify({ products: list, seedV: Math.max(1, ...SEED_ADDED.map((a) => a.v)) })); } catch { return false; }
  setCatalog(list); return true;
}
