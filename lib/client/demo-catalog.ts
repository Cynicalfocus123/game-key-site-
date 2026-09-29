import { SEED_PRODUCTS, setCatalog, upgradeProduct, type Product } from "@/lib/catalog";

// Demo catalog (task B, GitHub Pages): every product incl. drafts in this browser. Missing = the built-in seed.
// Uploaded images are data URLs saved with the product (browser storage holds about 5 MB, roughly 20–30 images).
export const DEMO_CATALOG_KEY = "corecart-demo-catalog-v1";
export function demoCatalogAll(): Product[] {
  try { const v = JSON.parse(localStorage.getItem(DEMO_CATALOG_KEY) || "null"); if (Array.isArray(v?.products)) return (v.products as Product[]).map(upgradeProduct); } catch { /* storage blocked or bad data */ }
  return SEED_PRODUCTS;
}
export function saveDemoCatalog(list: Product[]) {
  try { localStorage.setItem(DEMO_CATALOG_KEY, JSON.stringify({ products: list })); } catch { return false; }
  setCatalog(list); return true;
}
