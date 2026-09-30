import { SEED_COPY as seedCopy } from "./product-info";

// Product catalog (task B, 2026-09-29). The arrays below are the SEED: first run copies them into the database (server) or this
// browser (demo); after that the admin edits products in /admin/products. The live list (published only) is set with setCatalog():
// server = lib/server/catalog.ts from the `product` table, browser = lib/client/catalog.ts from /api/catalog (demo: localStorage).
// Prices are THB satang (base currency).
// Promo code categories (lib/promo.ts PROMO_CATEGORIES). Game keys also match their platform ("platform-steam" …).
export type ProductCategory = "digital-games" | "pc-parts" | "monitors" | "gaming-hardware";
export type Product = {
  id: string; name: string; image: string; price: number; old?: number; rating?: string;
  kind: "game_key" | "hardware"; category: ProductCategory; platform?: string; region?: string; os?: string; stock?: number;
  // Key region rules (ISO country codes). None = works everywhere. `only`: works only there. `excluded`: works everywhere except there.
  only?: string[]; excluded?: string[];
  // Listing + search (future task S1–S3): product type, genres, sold out, date added (newest sort), popularity (higher = more popular).
  type?: ProductType; genres?: string[]; soldOut?: boolean; added?: string; popularity?: number;
  // Catalog DB (task B): product page copy, platform / edition picker (same `family` = one game), menu flags, draft / published.
  description?: string; requirements?: [string, string][]; warranty?: string; family?: string; edition?: string;
  isNew?: boolean; trending?: boolean; status?: ProductStatus; updatedAt?: string;
};
export type ProductStatus = "published" | "draft";

// Genres (task C, user 2026-09-29; "Open world" back after Adventure, 25): one flat "Genres" list, in this order (menu + filters). The admin adds / renames / hides / deletes
// them in /admin/filters and ticks them per product in the product editor.
export const GENRES = ["Singleplayer", "Multiplayer", "Action", "First Person", "Third Person", "Simulation", "Sports", "Co-Op", "FPS/TPS", "Adventure", "Open world", "Strategy",
  "Racing", "Indie", "RPG", "Bird View", "Horror", "Virtual Reality", "Platformer", "Hack Slash", "Fighting", "Puzzle", "MMO", "Point-Click", "Arcade"];
// Genre names used before 2026-09-29 → new name (null = removed; "Open world" was removed, then kept again). Stored products, filter settings and old links are upgraded with it.
export const GENRE_RENAMES: Record<string, string | null> = { "Single player": "Singleplayer", "First person": "First Person", "Third person": "Third Person", "Co-op": "Co-Op", FPS: "FPS/TPS" };
export const upgradeGenres = (list?: string[]) => (list ? [...new Set(list.map((g) => (g in GENRE_RENAMES ? GENRE_RENAMES[g] : g)).filter((g): g is string => !!g))] : list);
export const upgradeProduct = (p: Product): Product => (p.genres?.some((g) => g in GENRE_RENAMES) ? { ...p, genres: upgradeGenres(p.genres) } : p);
// "Random key" (task D, user 2026-09-29): a normal product — the customer gets one random game key of that platform (Eneba "1 Random Steam key").
export type ProductType = "Game" | "DLC" | "Software" | "Gift card" | "Random key";
const seedHardware: Product[] = [
  { id: "hw-rtx-5070-ti-tuf", name: "ASUS TUF Gaming RTX 5070 Ti 16GB", image: "/images/placeholders/gpu-placeholder-01.jpg", price: 2699000, old: 2839000, rating: "4.8 (126)", kind: "hardware", category: "pc-parts", stock: 8 },
  { id: "hw-ryzen-7-9800x3d", name: "AMD Ryzen 7 9800X3D Processor", image: "/images/placeholders/ram-placeholder-01.jpg", price: 1599000, rating: "4.9 (88)", kind: "hardware", category: "pc-parts", stock: 12 },
  { id: "hw-990-pro-2tb", name: "Samsung 990 PRO 2TB NVMe SSD", image: "/images/placeholders/ssd-placeholder-01.jpg", price: 569000, old: 669000, rating: "4.7 (203)", kind: "hardware", category: "pc-parts", stock: 20 },
  { id: "hw-vengeance-32gb-ddr5", name: "Corsair Vengeance 32GB DDR5 Memory", image: "/images/placeholders/ram-placeholder-01.jpg", price: 389000, rating: "4.8 (67)", kind: "hardware", category: "pc-parts", stock: 15 },
  { id: "hw-msi-mag-27-qhd", name: "MSI MAG 27in QHD 180Hz Monitor", image: "/images/placeholders/monitor-placeholder-01.jpg", price: 839000, old: 969000, rating: "4.6 (41)", kind: "hardware", category: "monitors", stock: 3 },
  { id: "hw-fractal-north", name: "Fractal Design North ATX Case", image: "/images/placeholders/gaming-pc-placeholder-01.jpg", price: 499000, rating: "4.7 (32)", kind: "hardware", category: "pc-parts", stock: 6 },
];
// "ROW" (rest of world) sample: excludes East + Southeast Asia, where a separate Asia key is sold.
const ASIA = ["CN", "HK", "MO", "TW", "JP", "KR", "TH", "SG", "MY", "ID", "PH", "VN", "KH", "LA", "MM", "BN"];
const seedGames: Product[] = [
  { id: "key-cyberpunk-2077-steam", name: "Cyberpunk 2077", image: "/images/placeholders/game-placeholder-01.jpg", price: 62900, kind: "game_key", category: "digital-games", platform: "Steam", region: "Global", os: "Windows", type: "Game", genres: ["Action", "RPG", "Open world", "First Person"], added: "2026-06-01", popularity: 96 },
  { id: "key-elden-ring-steam", name: "Elden Ring", image: "/images/placeholders/game-placeholder-02.jpg", price: 99000, kind: "game_key", category: "digital-games", platform: "Steam", region: "Global", os: "Windows", type: "Game", genres: ["Action", "RPG", "Open world", "Third Person"], added: "2026-05-10", popularity: 98 },
  { id: "key-baldurs-gate-3-steam", name: "Baldur's Gate 3", image: "/images/placeholders/game-placeholder-03.jpg", price: 119000, kind: "game_key", category: "digital-games", platform: "Steam", region: "Global", os: "Windows", type: "Game", genres: ["RPG", "Adventure", "Co-Op"], added: "2026-04-20", popularity: 97 },
  { id: "key-black-myth-wukong-steam", name: "Black Myth: Wukong", image: "/images/placeholders/game-placeholder-04.jpg", price: 139000, kind: "game_key", category: "digital-games", platform: "Steam", region: "ROW", os: "Windows", excluded: ASIA, type: "Game", genres: ["Action", "Adventure", "Third Person", "Singleplayer"], added: "2026-07-15", popularity: 94 },
];
// Sample game keys for search, filters and region testing (placeholder covers + prices until the catalog DB). Not on the home page.
const LATAM = ["MX", "AR", "BR", "CL", "CO", "PE", "UY", "PY", "BO", "EC", "VE", "CR", "PA", "GT", "HN", "SV", "NI", "DO"];
const EUROPE = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "NO", "CH", "IS"];
const cover = (n: number) => `/images/placeholders/game-placeholder-0${(n % 4) + 1}.jpg`;
type KeyRow = [id: string, name: string, platform: string, region: string, price: number, extra: Partial<Product>];
const sampleRows: KeyRow[] = [
  ["key-gta-4-complete-steam", "Grand Theft Auto IV: The Complete Edition", "Steam", "Global", 87686, { family: "grand-theft-auto-iv", edition: "Complete Edition", old: 129000, genres: ["Action", "Open world", "Third Person"], popularity: 90 }],
  ["key-gta-4-steam-europe", "Grand Theft Auto IV", "Steam", "Europe", 89432, { family: "grand-theft-auto-iv", edition: "Standard", only: EUROPE, genres: ["Action", "Open world", "Third Person"], popularity: 70 }],
  ["key-gta-4-xbox", "Grand Theft Auto IV", "Xbox", "Global", 79900, { family: "grand-theft-auto-iv", edition: "Standard", soldOut: true, genres: ["Action", "Open world", "Third Person"], popularity: 40 }],
  ["key-gta-collection-steam-europe", "Grand Theft Auto Collection", "Steam", "Europe", 309851, { only: EUROPE, genres: ["Action", "Open world"], popularity: 55 }],
  ["key-gta-online-whale-shark-xbox", "Grand Theft Auto Online: Whale Shark Cash Card", "Xbox", "Global", 136688, { type: "DLC", genres: ["Action", "Open world"], popularity: 60 }],
  ["key-tlou-1-steam-latam", "The Last of Us Part I", "Steam", "Latin America", 82575, { family: "the-last-of-us-part-i", edition: "Standard", old: 169000, only: LATAM, genres: ["Action", "Adventure", "Horror", "Third Person", "Singleplayer"], popularity: 88 }],
  ["key-tlou-1-steam-us", "The Last of Us Part I", "Steam", "United States", 94513, { family: "the-last-of-us-part-i", edition: "Standard", only: ["US"], genres: ["Action", "Adventure", "Horror", "Third Person", "Singleplayer"], popularity: 80 }],
  ["key-tlou-1-deluxe-steam-asia", "The Last of Us Part I Digital Deluxe Edition", "Steam", "Asia", 108985, { family: "the-last-of-us-part-i", edition: "Digital Deluxe", only: ASIA, genres: ["Action", "Adventure", "Horror", "Third Person"], popularity: 65 }],
  ["key-tlou-2-remastered-steam", "The Last of Us Part II Remastered", "Steam", "Global", 94246, { family: "the-last-of-us-part-ii", edition: "Standard", old: 129000, genres: ["Action", "Adventure", "Horror", "Third Person"], popularity: 86 }],
  ["key-tlou-2-remastered-psn-us", "The Last of Us Part II Remastered", "PlayStation", "United States", 115072, { family: "the-last-of-us-part-ii", edition: "Standard", only: ["US"], genres: ["Action", "Adventure", "Horror", "Third Person"], popularity: 62 }],
  ["key-cod-mw3-steam", "Call of Duty: Modern Warfare III", "Steam", "Global", 179000, { old: 229000, genres: ["Action", "FPS/TPS", "First Person", "Multiplayer"], popularity: 92 }],
  ["key-doom-eternal-steam", "DOOM Eternal", "Steam", "Global", 39900, { old: 139900, genres: ["Action", "FPS/TPS", "First Person"], popularity: 78 }],
  ["key-half-life-2-steam", "Half-Life 2", "Steam", "Global", 19900, { genres: ["Action", "FPS/TPS", "First Person", "Singleplayer"], popularity: 75 }],
  ["key-resident-evil-4-steam", "Resident Evil 4", "Steam", "Global", 89000, { old: 139000, genres: ["Action", "Horror", "Third Person"], popularity: 84 }],
  ["key-silent-hill-2-steam", "Silent Hill 2", "Steam", "Global", 199000, { genres: ["Horror", "Adventure", "Third Person", "Singleplayer"], popularity: 72 }],
  ["key-forza-horizon-5-xbox", "Forza Horizon 5", "Xbox", "Global", 149000, { genres: ["Racing", "Open world", "Sports", "Simulation"], popularity: 81 }],
  ["key-ea-fc-26-psn-europe", "EA Sports FC 26", "PlayStation", "Europe", 209000, { only: EUROPE, genres: ["Sports", "Multiplayer"], popularity: 83 }],
  ["key-cyberpunk-phantom-liberty-steam", "Cyberpunk 2077: Phantom Liberty", "Steam", "Global", 99000, { old: 119000, type: "DLC", genres: ["Action", "RPG", "First Person"], popularity: 77 }],
  ["key-ff7-rebirth-steam", "Final Fantasy VII Rebirth", "Steam", "Global", 219000, { genres: ["RPG", "Adventure", "Third Person", "Strategy"], popularity: 74 }],
  ["key-tekken-8-steam", "Tekken 8", "Steam", "Global", 169000, { old: 219000, genres: ["Fighting", "Multiplayer", "Arcade"], popularity: 69 }],
  ["key-hogwarts-legacy-psn-us", "Hogwarts Legacy", "PlayStation", "United States", 129000, { only: ["US"], genres: ["RPG", "Open world", "Adventure"], popularity: 79 }],
];
export const sampleGames: Product[] = sampleRows.map(([id, name, platform, region, price, extra], i) => ({
  id, name, image: cover(i), price, kind: "game_key", category: "digital-games", platform, region, os: platform === "Steam" ? "Windows" : undefined,
  type: "Game", added: new Date(Date.UTC(2026, 8, 20 - i)).toISOString().slice(0, 10), ...extra,
}));
// Random keys (task D): normal products listed by the "Random Steam Keys" menu item (type Random key + platform Steam). Placeholder covers.
const RANDOM_INFO = "You get one random game key for this platform. The game is shown when you reveal the key in your account.";
export const randomKeys: Product[] = ([
  ["key-random-steam-hidden-gem", "1 Random Steam Key – Hidden Gem", "Steam", 4699, 71],
  ["key-random-steam-black", "1 Random Steam Key – Black Edition", "Steam", 6953, 68],
  ["key-random-steam-playstation-pc", "1 Random Steam Key – PlayStation PC Games", "Steam", 27621, 66],
  ["key-random-xbox", "1 Random Xbox Key – Xbox Live", "Xbox", 15281, 60],
] as const).map(([id, name, platform, price, popularity], i) => ({ id, name, image: cover(i + 1), price, kind: "game_key" as const, category: "digital-games" as const, platform, region: "Global",
  os: platform === "Steam" ? "Windows" : undefined, type: "Random key" as const, genres: [], added: "2026-09-25", popularity, description: RANDOM_INFO }));
// Seed products added after the first release: copied into existing catalogs once (server: missing ids; demo: seedV).
export const SEED_ADDED: { v: number; ids: string[] }[] = [{ v: 2, ids: randomKeys.map((p) => p.id) }];
// Seed: the 4 home games are "Trending now"; the 3 newest samples are "New". Copy from lib/product-info.ts fills description / specs.
export const SEED_PRODUCTS: Product[] = [...seedHardware, ...seedGames.map((p) => ({ ...p, trending: true })), ...sampleGames.map((p, i) => (i < 3 ? { ...p, isNew: true } : p)), ...randomKeys]
  .map((p) => ({ ...p, status: "published" as const, ...seedInfo(p) }));

// Live catalog: published products only. Every lookup below reads it, so admin changes show without a rebuild.
let live: Product[] = SEED_PRODUCTS; let byId = new Map(live.map((p) => [p.id, p]));
const subs = new Set<() => void>();
export function setCatalog(list: Product[]) {
  live = list.map(upgradeProduct).filter((p) => (p.status ?? "published") === "published"); byId = new Map(live.map((p) => [p.id, p]));
  subs.forEach((f) => f());
}
export const subscribeCatalog = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
// Every product (listing pages, search, cart lookups), games only, hardware only.
export const allProducts = () => live;
export const allGames = () => live.filter((p) => p.kind === "game_key");
export const hardware = () => live.filter((p) => p.kind === "hardware");
// Home "Digital game deals": games the admin marked Trending now (newest first), else the most popular.
export const homeGames = (list: Product[] = live) => {
  const g = list.filter((p) => p.kind === "game_key"); const t = g.filter((p) => p.trending);
  return (t.length ? t : [...g].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))).slice(0, 8);
};
// Can a key be activated in `country`? null for hardware or unknown country.
export function regionWorks(p: Product, country: string | null | undefined) {
  if (p.kind !== "game_key" || !country) return null;
  if (p.only) return p.only.includes(country);
  return !(p.excluded ?? []).includes(country);
}
export const productById = (id: string) => byId.get(id);
// Cover image for an order item (order items store the name, not the product id).
export const coverFor = (name: string) => live.find((p) => p.name === name)?.image;

// Cart rules (shared by client, demo and server). Max 5 per game key per order; hardware up to stock.
export const MAX_KEYS_PER_ORDER = 5;
export const maxQty = (p: Product) => (p.soldOut ? 0 : p.kind === "game_key" ? MAX_KEYS_PER_ORDER : Math.max(p.stock ?? 0, 0));
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

// Favorites (♡): list of product ids, newest first. Unknown ids dropped, no duplicates, max 200.
export const MAX_FAVORITES = 200;
export function cleanFavorites(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && Boolean(productById(x))))].slice(0, MAX_FAVORITES);
}
// Sign-in merge: guest favorites not yet saved go first, account order kept.
export const mergeFavorites = (account: string[], guest: string[]) => cleanFavorites([...cleanFavorites(guest).filter((g) => !account.includes(g)), ...cleanFavorites(account)]);

export const cartSubtotal = (entries: CartEntry[]) => entries.reduce((t, e) => t + (productById(e.productId)?.price ?? 0) * e.qty, 0);
export const cartCount = (entries: CartEntry[]) => entries.reduce((t, e) => t + e.qty, 0);

// Seed copy (lib/product-info.ts) moved onto the product so the admin can edit it.
function seedInfo(p: Product): Partial<Product> {
  const i = seedCopy[p.id]; return i ? { description: i.description, requirements: i.requirements, warranty: i.warranty } : {};
}
