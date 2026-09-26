// Mock catalog (homepage products) with stable ids. Used by storefront, cart (client) and cart API (server) until the catalog DB exists.
// Prices are THB satang (base currency).
export type Product = {
  id: string; name: string; image: string; price: number; old?: number; rating?: string;
  kind: "game_key" | "hardware"; platform?: string; region?: string; os?: string; stock?: number;
};
export const hardware: Product[] = [
  { id: "hw-rtx-5070-ti-tuf", name: "ASUS TUF Gaming RTX 5070 Ti 16GB", image: "/images/placeholders/gpu-placeholder-01.jpg", price: 2699000, old: 2839000, rating: "4.8 (126)", kind: "hardware", stock: 8 },
  { id: "hw-ryzen-7-9800x3d", name: "AMD Ryzen 7 9800X3D Processor", image: "/images/placeholders/ram-placeholder-01.jpg", price: 1599000, rating: "4.9 (88)", kind: "hardware", stock: 12 },
  { id: "hw-990-pro-2tb", name: "Samsung 990 PRO 2TB NVMe SSD", image: "/images/placeholders/ssd-placeholder-01.jpg", price: 569000, old: 669000, rating: "4.7 (203)", kind: "hardware", stock: 20 },
  { id: "hw-vengeance-32gb-ddr5", name: "Corsair Vengeance 32GB DDR5 Memory", image: "/images/placeholders/ram-placeholder-01.jpg", price: 389000, rating: "4.8 (67)", kind: "hardware", stock: 15 },
  { id: "hw-msi-mag-27-qhd", name: "MSI MAG 27in QHD 180Hz Monitor", image: "/images/placeholders/monitor-placeholder-01.jpg", price: 839000, old: 969000, rating: "4.6 (41)", kind: "hardware", stock: 3 },
  { id: "hw-fractal-north", name: "Fractal Design North ATX Case", image: "/images/placeholders/gaming-pc-placeholder-01.jpg", price: 499000, rating: "4.7 (32)", kind: "hardware", stock: 6 },
];
export const games: Product[] = [
  { id: "key-cyberpunk-2077-steam", name: "Cyberpunk 2077", image: "/images/placeholders/game-placeholder-01.jpg", price: 62900, kind: "game_key", platform: "Steam", region: "Global", os: "Windows" },
  { id: "key-elden-ring-steam", name: "Elden Ring", image: "/images/placeholders/game-placeholder-02.jpg", price: 99000, kind: "game_key", platform: "Steam", region: "Global", os: "Windows" },
  { id: "key-baldurs-gate-3-steam", name: "Baldur's Gate 3", image: "/images/placeholders/game-placeholder-03.jpg", price: 119000, kind: "game_key", platform: "Steam", region: "Global", os: "Windows" },
  { id: "key-black-myth-wukong-steam", name: "Black Myth: Wukong", image: "/images/placeholders/game-placeholder-04.jpg", price: 139000, kind: "game_key", platform: "Steam", region: "Global", os: "Windows" },
];
const byId = new Map([...hardware, ...games].map((p) => [p.id, p]));
export const productById = (id: string) => byId.get(id);
// Cover image for an order item until order items store a product id (catalog DB step).
export const coverFor = (name: string) => [...games, ...hardware].find((p) => p.name === name)?.image;

// Cart rules (shared by client, demo and server). Max 5 per game key per order; hardware up to stock.
export const MAX_KEYS_PER_ORDER = 5;
export const maxQty = (p: Product) => (p.kind === "game_key" ? MAX_KEYS_PER_ORDER : Math.max(p.stock ?? 0, 0));
export type CartEntry = { productId: string; qty: number };
// Drops unknown products and bad quantities, caps at the limit, one row per product (first wins).
export function cleanCart(items: unknown): CartEntry[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>(); const out: CartEntry[] = [];
  for (const i of items) {
    const p = typeof i?.productId === "string" ? productById(i.productId) : undefined; const q = Math.floor(Number(i?.qty));
    if (!p || seen.has(p.id) || !(q > 0)) continue;
    seen.add(p.id); out.push({ productId: p.id, qty: Math.min(q, maxQty(p)) });
  }
  return out.filter((e) => e.qty > 0);
}
// Sign-in merge: same product → higher qty (capped), no duplicates. Account items keep their order; new guest items go first.
export function mergeCarts(account: CartEntry[], guest: CartEntry[]): CartEntry[] {
  const a = cleanCart(account); const g = cleanCart(guest);
  const merged = a.map((e) => { const x = g.find((y) => y.productId === e.productId); return x ? { ...e, qty: Math.max(e.qty, x.qty) } : e; });
  return cleanCart([...g.filter((x) => !a.some((e) => e.productId === x.productId)), ...merged]);
}

// Demo coupon until coupon admin exists.
export const COUPONS: Record<string, { percent: number; label: string }> = { WELCOME10: { percent: 10, label: "10% off" } };
export const findCoupon = (code: string | null | undefined) => { const c = code?.trim().toUpperCase(); return c && COUPONS[c] ? { code: c, ...COUPONS[c] } : null; };
export function cartTotals(entries: CartEntry[], coupon?: string | null) {
  const subtotal = entries.reduce((t, e) => t + (productById(e.productId)?.price ?? 0) * e.qty, 0);
  const c = findCoupon(coupon); const discount = c ? Math.round((subtotal * c.percent) / 100) : 0;
  return { count: entries.reduce((t, e) => t + e.qty, 0), subtotal, discount, total: subtotal - discount, coupon: c };
}
