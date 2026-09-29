// Admin product editor rules (task B, 2026-09-29). Shared by the demo store, the server API and the editor page (no server imports).
import type { Product, ProductCategory, ProductStatus, ProductType } from "./catalog";

// Product image (Eneba sizes, user 2026-09-29): every product has ONE 4:5 image, exactly 800 x 1000. Listing cards show it 5:7
// (sides trimmed), the product page shows all of it. The editor crops to this size in the browser, so the check below never fails in normal use.
export const IMAGE_W = 800;
export const IMAGE_H = 1000;
export const IMAGE_MAX_BYTES = 1_500_000;
export const IMAGE_TYPES = ["image/webp", "image/jpeg"] as const;
export const PRODUCT_TYPES: ProductType[] = ["Game", "DLC", "Software", "Gift card", "Random key"];
export const HARDWARE_CATEGORIES: { id: ProductCategory; label: string }[] = [{ id: "pc-parts", label: "PC parts" }, { id: "monitors", label: "Monitors" }, { id: "gaming-hardware", label: "Gaming hardware" }];
export const PLATFORM_SUGGESTIONS = ["Steam", "Xbox", "PlayStation", "Nintendo", "EA app", "Ubisoft Connect", "Epic Games", "GOG", "Battle.net", "Rockstar Games Launcher"];
export const REGION_SUGGESTIONS = ["Global", "ROW", "Europe", "United States", "Latin America", "Asia"];
// Country presets for the region rule (same lists as the seed products).
export const COUNTRY_PRESETS: { label: string; codes: string[] }[] = [
  { label: "Europe", codes: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "NO", "CH", "IS"] },
  { label: "Latin America", codes: ["MX", "AR", "BR", "CL", "CO", "PE", "UY", "PY", "BO", "EC", "VE", "CR", "PA", "GT", "HN", "SV", "NI", "DO"] },
  { label: "East + Southeast Asia", codes: ["CN", "HK", "MO", "TW", "JP", "KR", "TH", "SG", "MY", "ID", "PH", "VN", "KH", "LA", "MM", "BN"] },
  { label: "United States", codes: ["US"] },
];
export const PRICE_MAX = 100_000_000; // ฿1,000,000.00 in satang
export const ADMIN_PRODUCT_LIMIT = { max: 120, windowMs: 60_000 }; // writes per admin
export const IMAGE_UPLOAD_LIMIT = { max: 30, windowMs: 10 * 60_000 };
export const PRODUCT_ERRORS = {
  name: "Enter a name (up to 120 characters).", id: "ID: 3–80 characters, lowercase letters, numbers and dashes.", idTaken: "That ID is already used by another product.",
  price: "Enter a price between ฿0.01 and ฿1,000,000.", old: "The old price must be higher than the price (or empty).", platform: "Choose a platform for a game key.",
  region: "Enter the region name (for example Global or Europe).", countries: "Country codes must be 2 letters (for example TH, US).", countriesNeeded: "Add at least one country for this rule.",
  stock: "Stock must be a whole number from 0 to 100,000.", image: "Upload the product image (800 × 1000).", imageBad: `The image must be WebP or JPEG, exactly ${IMAGE_W} × ${IMAGE_H} px, up to 1.5 MB.`,
  text: "A text field is too long.", family: "Game group: lowercase letters, numbers and dashes (or empty).", notFound: "Product not found", limit: "Too many changes. Wait a minute and try again.",
  uploadLimit: "Too many uploads. Wait a few minutes and try again.", storage: "Browser storage is full. Remove some demo images or products.",
} as const;

export type RegionRule = "everywhere" | "only" | "excluded";
export const regionRule = (p: Pick<Product, "only" | "excluded">): RegionRule => (p.only?.length ? "only" : p.excluded?.length ? "excluded" : "everywhere");
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
// Suggested ID for a new product: key-{name}-{platform}-{region} (region left out when Global) or hw-{name}.
export function suggestId(name: string, kind: Product["kind"], platform?: string, region?: string) {
  const parts = kind === "hardware" ? ["hw", name] : ["key", name, platform ?? "", region && region !== "Global" ? region : ""];
  return slugify(parts.filter(Boolean).join(" "));
}
export const ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,78})[a-z0-9]$/;
const IMAGE_PATH_RE = /^(\/images\/[a-z0-9/_.-]+\.(?:jpg|jpeg|png|webp)|\/api\/images\/[0-9a-f-]{36})$/i;
export const isStoredImagePath = (s: string) => IMAGE_PATH_RE.test(s);

const str = (v: unknown, max: number): string | null | undefined => (v === undefined || v === null || v === "" ? undefined : typeof v === "string" && v.trim().length <= max ? v.trim() : null);
const codes = (v: unknown): string[] | null => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 250) return null;
  const out = [...new Set(v.map((c) => (typeof c === "string" ? c.trim().toUpperCase() : "")))];
  return out.every((c) => /^[A-Z]{2}$/.test(c)) ? out : null;
};
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN);

// Checks an editor form (or API body). `image` rules: server mode needs an uploaded /api/images/{id} (or a seed /images path);
// the demo stores a data URL (allowData). Returns the clean product or the first error.
export function parseProduct(raw: unknown, opts: { allowData?: boolean } = {}): { ok: true; product: Product } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request" };
  const b = raw as Record<string, unknown>;
  const fail = (error: string) => ({ ok: false as const, error });
  const kind = b.kind === "hardware" ? "hardware" : b.kind === "game_key" ? "game_key" : null; if (!kind) return fail("Choose a product kind.");
  const name = str(b.name, 120); if (!name) return fail(PRODUCT_ERRORS.name);
  const id = typeof b.id === "string" ? b.id.trim() : ""; if (!ID_RE.test(id)) return fail(PRODUCT_ERRORS.id);
  const price = int(b.price); if (!(price >= 1 && price <= PRICE_MAX)) return fail(PRODUCT_ERRORS.price);
  const old = b.old === undefined || b.old === null || b.old === "" ? undefined : int(b.old); if (old !== undefined && !(old > price && old <= PRICE_MAX)) return fail(PRODUCT_ERRORS.old);
  const image = typeof b.image === "string" ? b.image : "";
  const dataOk = opts.allowData && /^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length <= IMAGE_MAX_BYTES * 1.4;
  if (!image) return fail(PRODUCT_ERRORS.image);
  if (!dataOk && !isStoredImagePath(image)) return fail(PRODUCT_ERRORS.imageBad);
  const status: ProductStatus = b.status === "draft" ? "draft" : "published";
  const description = str(b.description, 4000); const warranty = str(b.warranty, 120); const family = str(b.family, 60); const edition = str(b.edition, 40);
  if ([description, warranty, edition].includes(null)) return fail(PRODUCT_ERRORS.text);
  if (family === null || (family && !/^[a-z0-9-]+$/.test(family))) return fail(PRODUCT_ERRORS.family);
  const reqs = Array.isArray(b.requirements) ? b.requirements : [];
  if (reqs.length > 12 || !reqs.every((r) => Array.isArray(r) && r.length === 2 && typeof r[0] === "string" && typeof r[1] === "string" && r[0].length <= 40 && r[1].length <= 200)) return fail(PRODUCT_ERRORS.text);
  const requirements = (reqs as [string, string][]).map(([k, v]) => [k.trim(), v.trim()] as [string, string]).filter(([k, v]) => k && v);
  const genres = Array.isArray(b.genres) ? [...new Set(b.genres.filter((g): g is string => typeof g === "string").map((g) => g.trim()).filter(Boolean))] : [];
  if (genres.length > 12 || genres.some((g) => g.length > 40)) return fail(PRODUCT_ERRORS.text);
  const popularity = b.popularity === undefined ? 50 : int(b.popularity); if (!(popularity >= 0 && popularity <= 100)) return fail("Popularity must be 0–100.");
  const added = typeof b.added === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.added) ? b.added : new Date().toISOString().slice(0, 10);
  const common = { id, name, image, price, ...(old !== undefined ? { old } : {}), status, popularity, added, isNew: b.isNew === true, trending: b.trending === true,
    ...(description ? { description } : {}), ...(requirements.length ? { requirements } : {}), ...(warranty ? { warranty } : {}), ...(typeof b.rating === "string" && b.rating.length <= 20 ? { rating: b.rating } : {}) };
  if (kind === "hardware") {
    const category = HARDWARE_CATEGORIES.find((c) => c.id === b.category)?.id ?? "pc-parts";
    const stock = int(b.stock ?? 0); if (!(stock >= 0 && stock <= 100_000)) return fail(PRODUCT_ERRORS.stock);
    return { ok: true, product: { ...common, kind, category, stock, ...(b.soldOut === true ? { soldOut: true } : {}) } };
  }
  const platform = str(b.platform, 40); if (!platform) return fail(PRODUCT_ERRORS.platform);
  const region = str(b.region, 40); if (!region) return fail(PRODUCT_ERRORS.region);
  const os = str(b.os, 40); if (os === null) return fail(PRODUCT_ERRORS.text);
  const type = PRODUCT_TYPES.find((t) => t === b.type) ?? "Game";
  const rule: RegionRule = b.rule === "only" || b.rule === "excluded" ? b.rule : "everywhere";
  const list = codes(b.countries); if (!list) return fail(PRODUCT_ERRORS.countries);
  if (rule !== "everywhere" && !list.length) return fail(PRODUCT_ERRORS.countriesNeeded);
  return { ok: true, product: { ...common, kind, category: "digital-games", platform, region, ...(os ? { os } : {}), type, genres,
    ...(rule === "only" ? { only: list } : rule === "excluded" ? { excluded: list } : {}), ...(family ? { family } : {}), ...(edition ? { edition } : {}), ...(b.soldOut === true ? { soldOut: true } : {}) } };
}

// Width + height from the file header (WebP VP8 / VP8L / VP8X, JPEG SOF). null = not a WebP or JPEG.
export function imageSize(bytes: Uint8Array): { type: (typeof IMAGE_TYPES)[number]; width: number; height: number } | null {
  const at = (i: number) => bytes[i] ?? 0; const txt = (i: number, n: number) => String.fromCharCode(...bytes.slice(i, i + n));
  if (txt(0, 4) === "RIFF" && txt(8, 4) === "WEBP") {
    const chunk = txt(12, 4);
    if (chunk === "VP8X") return { type: "image/webp", width: 1 + (at(24) | (at(25) << 8) | (at(26) << 16)), height: 1 + (at(27) | (at(28) << 8) | (at(29) << 16)) };
    if (chunk === "VP8L" && at(20) === 0x2f) { const b = at(21) | (at(22) << 8) | (at(23) << 16) | (at(24) << 24); return { type: "image/webp", width: 1 + (b & 0x3fff), height: 1 + ((b >>> 14) & 0x3fff) }; }
    if (chunk === "VP8 " && at(23) === 0x9d && at(24) === 0x01 && at(25) === 0x2a) return { type: "image/webp", width: (at(26) | (at(27) << 8)) & 0x3fff, height: (at(28) | (at(29) << 8)) & 0x3fff };
    return null;
  }
  if (at(0) === 0xff && at(1) === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (at(i) !== 0xff) { i++; continue; }
      const m = at(i + 1);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: "image/jpeg", height: (at(i + 5) << 8) | at(i + 6), width: (at(i + 7) << 8) | at(i + 8) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + ((at(i + 2) << 8) | at(i + 3));
    }
  }
  return null;
}
export const imageOk = (bytes: Uint8Array) => { const s = imageSize(bytes); return !!s && s.width === IMAGE_W && s.height === IMAGE_H && bytes.length <= IMAGE_MAX_BYTES ? s : null; };
export function dataUrlBytes(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/(?:webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl); if (!m) return null;
  try { return Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)); } catch { return null; }
}

// Platform / edition / region picker on the product page: every published product of the same game group.
export function familyOf(p: Product, list: Product[]) {
  return p.family ? list.filter((x) => x.family === p.family) : [p];
}
// Best sibling for a choice: same values as `p` where possible, else the first one with that value.
export function pickSibling(p: Product, siblings: Product[], field: "platform" | "edition" | "region", value: string) {
  const ok = siblings.filter((x) => (x[field] ?? "") === value);
  const score = (x: Product) => (["platform", "edition", "region"] as const).reduce((s, f) => s + (f !== field && (x[f] ?? "") === (p[f] ?? "") ? 1 : 0), 0);
  return [...ok].sort((a, b) => score(b) - score(a))[0];
}
