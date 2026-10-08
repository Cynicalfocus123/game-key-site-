// Seller marketplace (wireframe approved by the user 2026-10-08: Claude outputs/wireframes/seller-marketplace-wireframe.html).
// Shared rules for the demo store, the server API and the pages (no server imports): offers, seller keys, product requests, store slugs.
// Seller prices are USD cents (user 2026-10-08); every buyer sees them converted with lib/currency/money.ts convertMinor.
import type { Product } from "./catalog";
import { KEYS_PER_UPLOAD, KEY_RE, normalizeKey } from "./key-inventory";
import { normalize, searchProducts } from "./search";

export const CORECART_STORE = { slug: "corecart", name: "CoreCart" } as const; // CoreCart's own stock is shown as this seller
export const LOW_STOCK_DEFAULT = 10; // user default 2026-10-08: low stock = 10 keys or fewer (seller can change)
export const LOW_STOCK_MAX = 1000;
export const PRICE_MIN_CENTS = 10; // $0.10
export const PRICE_MAX_CENTS = 1_000_000; // $10,000
export const OPEN_REQUESTS_MAX = 10; // open (waiting) product requests per seller
export const SELLER_KEY_LIMIT = { max: 30, windowMs: 10 * 60_000 }; // key uploads + checks per seller (same as admin uploads)
export const OFFER_WRITE_LIMIT = { max: 120, windowMs: 60_000 }; // offer edits per seller
export const REQUEST_LIMIT = { max: 20, windowMs: 60 * 60_000 }; // product requests sent per seller per hour
// Commission % is not decided (user 2026-10-02: answers later). null = "pending" everywhere; "You receive" = price − fee.
export const COMMISSION_BP: number | null = null;

export const MARKET_ERRORS = {
  notSeller: "Only approved sellers can sell on CoreCart.",
  product: "Pick a product from the CoreCart catalog.",
  notKeyProduct: "Only game keys can be sold by sellers.",
  price: "Enter a price between $0.10 and $10,000 (USD, up to 2 decimals).",
  offerExists: "You already have an offer for this product. Add keys to it instead.",
  offerNotFound: "Offer not found.",
  noKeys: "Paste at least one key (one per line).",
  tooMany: `Up to ${KEYS_PER_UPLOAD.toLocaleString("en-US")} keys per upload.`,
  noneNew: "No new keys to save: fix or remove the lines listed below.",
  limit: "Too many uploads. Wait a few minutes and try again.",
  writeLimit: "Too many changes. Wait a minute and try again.",
  lowStock: `Low stock: a whole number from 0 to ${LOW_STOCK_MAX}.`,
  config: "Key storage is not set up on the server (KEY_ENCRYPTION_KEY).",
  requestsOpen: `You already have ${OPEN_REQUESTS_MAX} open requests. Wait until we answer some of them.`,
  requestLimit: "Too many requests. Try again later.",
  inCatalog: "This product is already in the catalog — sell it.",
  requestNotFound: "Request not found.",
  requestClosed: "This request was already answered.",
  reason: "Write a reason (3–300 characters). The seller sees it.",
  storeNotFound: "Store not found.",
} as const;

// ---------- Offers ----------
export type OfferStatus = "active" | "paused" | "sold_out";
export const offerStatus = (active: boolean, stock: number): OfferStatus => (!active ? "paused" : stock > 0 ? "active" : "sold_out");
export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = { active: "Active", paused: "Paused", sold_out: "Sold out" };
export type SellerOffer = {
  id: string; productId: string; priceUsdCents: number; active: boolean; status: OfferStatus;
  stock: number; sold: number; lowestOtherUsdCents: number | null; createdAt: string; updatedAt: string;
};
export type OfferCounts = { all: number; active: number; paused: number; soldOut: number; keysInStock: number };
export function offerCounts(offers: SellerOffer[]): OfferCounts {
  return { all: offers.length, active: offers.filter((o) => o.status === "active").length, paused: offers.filter((o) => o.status === "paused").length,
    soldOut: offers.filter((o) => o.status === "sold_out").length, keysInStock: offers.reduce((t, o) => t + o.stock, 0) };
}
// Low stock panel: active offers with 1..lowStockAt keys; Out of stock tab = Sold out offers.
export const isLowStock = (o: SellerOffer, lowStockAt: number) => o.status === "active" && o.stock <= lowStockAt;
// "You receive": null while the commission is pending (pages show "price − fee").
export const youReceive = (priceUsdCents: number, bp: number | null = COMMISSION_BP) => (bp === null ? null : priceUsdCents - Math.round((priceUsdCents * bp) / 10_000));

// "28.12" → 2812. null = not a valid USD price in range.
export function parseUsd(text: string): number | null {
  const t = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return null;
  const [i, f = ""] = t.split(".");
  const cents = Number(i) * 100 + Number(f.padEnd(2, "0"));
  return cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS ? cents : null;
}
export const usdInput = (cents: number) => (cents / 100).toFixed(2);
export const priceOk = (cents: unknown): cents is number => Number.isInteger(cents) && (cents as number) >= PRICE_MIN_CENTS && (cents as number) <= PRICE_MAX_CENTS;
export const lowStockOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= LOW_STOCK_MAX;

// ---------- Seller keys (paste or CSV / TXT, checked line by line) ----------
// Format per platform (the wireframe: "not a Steam key (XXXXX-XXXXX-XXXXX)"). Unknown platforms use the general key rule.
type KeyFormat = { name: string; example: string; re: RegExp };
const A = "[A-Z0-9]";
const KEY_FORMATS: { match: RegExp; format: KeyFormat }[] = [
  { match: /steam/i, format: { name: "Steam", example: "XXXXX-XXXXX-XXXXX", re: new RegExp(`^${A}{5}-${A}{5}-${A}{5}(-${A}{5}){0,2}$`) } },
  { match: /xbox|microsoft/i, format: { name: "Xbox", example: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX", re: new RegExp(`^${A}{5}(-${A}{5}){4}$`) } },
  { match: /playstation|psn/i, format: { name: "PlayStation", example: "XXXX-XXXX-XXXX", re: new RegExp(`^${A}{4}-${A}{4}-${A}{4}$`) } },
  { match: /nintendo/i, format: { name: "Nintendo", example: "XXXX-XXXX-XXXX-XXXX", re: new RegExp(`^${A}{4}(-?${A}{4}){3}$`) } },
  { match: /^(ea|ea app|origin)$/i, format: { name: "EA app", example: "XXXX-XXXX-XXXX-XXXX-XXXX", re: new RegExp(`^${A}{4}(-${A}{4}){4}$`) } },
];
const GENERAL: KeyFormat = { name: "game", example: "letters, digits and dashes, 5–64 characters", re: KEY_RE };
export const keyFormat = (platform?: string | null): KeyFormat => KEY_FORMATS.find((f) => f.match.test(platform ?? ""))?.format ?? GENERAL;

export type KeyLine = { line: number; code: string };
export type KeyCheck = {
  ok: KeyLine[]; // new keys, in upload order
  duplicates: { line: number; first: number }[]; // same key twice in this list (first = line kept)
  invalid: { line: number; text: string }[]; // wrong format for this platform
  existing: number[]; // lines whose key is already anywhere in CoreCart (filled by the store / server)
  format: { name: string; example: string };
  tooMany: boolean; // more than KEYS_PER_UPLOAD keys in one upload
};
// One key per line; a CSV / TXT line uses its first column. Blank lines and header words ("key", "code") are skipped. Line numbers are 1-based.
export function checkKeyText(text: string, platform?: string | null): KeyCheck {
  const f = keyFormat(platform); const seen = new Map<string, number>();
  const out: KeyCheck = { ok: [], duplicates: [], invalid: [], existing: [], format: { name: f.name, example: f.example }, tooMany: false };
  text.slice(0, 200_000).split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1; const cell = raw.split(/[,;\t]/)[0].trim().replace(/^"|"$/g, "");
    if (!cell || /^(key|keys|code|codes|game key|serial)$/i.test(cell)) return;
    const code = normalizeKey(cell);
    if (!f.re.test(code) || code.length > 64) { out.invalid.push({ line, text: cell.slice(0, 70) }); return; }
    const first = seen.get(code); if (first) { out.duplicates.push({ line, first }); return; }
    seen.set(code, line); out.ok.push({ line, code });
  });
  out.tooMany = out.ok.length > KEYS_PER_UPLOAD;
  return out;
}
// Moves keys already in CoreCart (by code) from ok to existing.
export function markExisting(check: KeyCheck, isKnown: (code: string) => boolean): KeyCheck {
  const existing = [...check.existing]; const ok: KeyLine[] = [];
  for (const k of check.ok) (isKnown(k.code) ? existing.push(k.line) : ok.push(k));
  return { ...check, ok, existing: existing.sort((a, b) => a - b) };
}
// What the page shows / the API returns: no key text ever leaves the store, only line numbers and counts.
export type KeyReport = Omit<KeyCheck, "ok"> & { okLines: number[]; okCount: number };
export const keyReport = (c: KeyCheck): KeyReport => ({ duplicates: c.duplicates, invalid: c.invalid, existing: c.existing, format: c.format, tooMany: c.tooMany, okLines: c.ok.map((k) => k.line), okCount: c.ok.length });
export type KeyAddResult = { added: number; report: KeyReport };
// "lines 3, 7, 9 and 4 more"
export function linesText(lines: number[], max = 6) {
  if (!lines.length) return "";
  const shown = lines.slice(0, max).join(", ");
  return `line${lines.length > 1 ? "s" : ""} ${shown}${lines.length > max ? ` and ${lines.length - max} more` : ""}`;
}

// ---------- Seller store (public page /store?s=<slug>) ----------
// logo = URL of the store logo (server route / demo data URL), null = letter frame.
export type SellerStore = { slug: string; name: string; invoices: boolean; lowStockAt: number; since: string | null; logo: string | null };
// Store slug from the merchant name: lower-case letters, digits and dashes (max 40). "corecart" is CoreCart's own store.
export function slugify(name: string) {
  const s = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return !s || s === CORECART_STORE.slug ? `seller-${s || "store"}` : s;
}
export const storeSlugOk = (s: string) => /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(s);
// Seller dashboard tiles (USD cents). available = 0 until payouts are built (separate wireframe).
export type SellerTiles = { availableUsdCents: number; incomeUsdCents7: number; sales7: number; activeOffers: number };
// holdUntil = sales freeze still running (KYC 10-day freeze / new seller hold): offers can be prepared, buyers do not see them yet.
export type SellerHome = { store: SellerStore; tiles: SellerTiles; holdUntil: string | null };

// ---------- Buyer side (step 4, user answers 2026-10-08) ----------
// Seller offers show ONLY on the product page ("Recommended offers" = Featured offer, then "N other offers"); a product without visible
// seller offers keeps the normal product page. Visible = offer on, keys in stock, seller approved, not on a sales hold, account not closed.
// Every approved seller is Verified. Trusted ★ = 5 five-star ratings within the last 30 days. Order: Trusted first, then lowest price.
// No stat lines (tickets ratio, dispute time…) and no cashback: "no need to show any other data to confuse people".
export const TRUSTED_FIVE_STARS = 5;
export const TRUSTED_DAYS = 30;
export const isTrusted = (fiveStarsInWindow: number) => fiveStarsInWindow >= TRUSTED_FIVE_STARS;
export type PublicSeller = {
  slug: string; name: string; logo: string | null; verified: boolean; trusted: boolean;
  rating: { average: number; count: number } | null; // null = no ratings yet ("New seller")
  since: string | null; own: boolean; // own = CoreCart's own stock
};
// One buyable offer. id = seller_offer id, or OWN_OFFER for CoreCart's own stock. unit = price in THB satang (site base) at today's rate,
// so totals, coupons, fees and every display currency work like CoreCart products; priceUsdCents = what the seller set.
export const OWN_OFFER = "corecart";
export type PublicOffer = { id: string; productId: string; seller: PublicSeller; priceUsdCents: number | null; unit: number; max: number };
// Trusted first, then cheapest, then the higher rating; CoreCart before a seller on a full tie.
export function sortOffers(offers: PublicOffer[]): PublicOffer[] {
  return [...offers].sort((a, b) => Number(b.seller.trusted) - Number(a.seller.trusted) || a.unit - b.unit
    || (b.seller.rating?.average ?? 0) - (a.seller.rating?.average ?? 0) || Number(b.seller.own) - Number(a.seller.own) || a.seller.name.localeCompare(b.seller.name));
}
// Featured = first after sorting; "Lowest price" = cheapest one (only when there is more than one offer).
export function offerList(offers: PublicOffer[]) {
  const sorted = sortOffers(offers); const low = Math.min(...sorted.map((o) => o.unit));
  return { featured: sorted[0] ?? null, others: sorted.slice(1), lowestId: sorted.length > 1 ? sorted.find((o) => o.unit === low)!.id : null };
}
export const ratingText = (r: PublicSeller["rating"]) => (r ? `${r.average.toFixed(1)} (${r.count} rating${r.count === 1 ? "" : "s"})` : "New seller");
export const MAX_PER_OFFER = 5; // same cap as a CoreCart key line
// Cart line of a seller offer (guest cart + account cart): the price is re-read from the offer on every load.
export type OfferQuote = { offerId: string; productId: string; unit: number; max: number; seller: { slug: string; name: string } };
export type PublicStore = { seller: PublicSeller; offers: { productId: string; priceUsdCents: number; unit: number }[] };
export const STORE_PAGE_SIZE = 24;

// ---------- Product requests ("Can't find? Request new name") ----------
export type RequestStatus = "waiting" | "added" | "rejected";
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = { waiting: "Waiting", added: "Added", rejected: "Rejected" };
export const PLATFORM_OPTIONS = ["Steam", "Xbox", "PlayStation", "Nintendo", "EA app", "Ubisoft Connect", "Epic Games", "GOG", "Battle.net", "Rockstar", "Other"] as const;
export const REGION_OPTIONS = ["Global", "Europe", "North America", "United States", "United Kingdom", "Latin America", "Asia", "ROW", "Other"] as const;
export type RequestInput = { name: string; platform: string; region: string; edition: string; link: string; note: string };
export type RequestErrors = Partial<Record<keyof RequestInput, string>>;
export const emptyRequest = (): RequestInput => ({ name: "", platform: "Steam", region: "Global", edition: "", link: "", note: "" });
export type ProductRequest = RequestInput & { id: string; number: string; status: RequestStatus; productId: string | null; reason: string | null; createdAt: string; decidedAt: string | null };
export const requestNumber = (seq: number) => `PR-${seq}`;
export const nameKey = (name: string) => normalize(name).join(" ");
const tidy = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");
// Same check in the form, the demo store and the API.
export function parseRequest(b: Record<string, unknown> | null): { ok: true; input: RequestInput } | { ok: false; errors: RequestErrors } {
  const input: RequestInput = { name: tidy(b?.name, 120), platform: tidy(b?.platform, 40), region: tidy(b?.region, 40), edition: tidy(b?.edition, 60), link: tidy(b?.link, 300), note: tidy(b?.note, 500) };
  const errors: RequestErrors = {};
  if (input.name.length < 2 || input.name.length > 120 || !nameKey(input.name)) errors.name = "Product name: 2–120 characters.";
  if (!(PLATFORM_OPTIONS as readonly string[]).includes(input.platform)) errors.platform = "Choose a platform.";
  if (!(REGION_OPTIONS as readonly string[]).includes(input.region)) errors.region = "Choose a region.";
  if (input.edition.length > 60) errors.edition = "Edition: up to 60 characters.";
  if (input.link && (input.link.length > 300 || !/^https:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(input.link))) errors.link = "Link: a full https:// address (or leave it empty).";
  if (input.note.length > 500) errors.note = "Note: up to 500 characters.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, input };
}
export const reasonOk = (r: string) => r.trim().length >= 3 && r.trim().length <= 300;

// ---------- Admin: Product requests (step 3, wireframe screen 7; section "products") ----------
// add = the admin made the product in the editor; link = the product was already there under another name; reject = reason the seller sees.
// add / link close every waiting request for the same product (same name + platform + region) and email each seller "Sell it ›".
export type RequestAction = "add" | "link" | "reject";
export const REQUEST_ACTIONS: RequestAction[] = ["add", "link", "reject"];
export const REQUEST_ADMIN_LIMIT = { max: 60, windowMs: 60_000 }; // decisions per admin
export type RequestEventRow = { action: string; detail: string; by: string | null; createdAt: string };
export type AdminRequestRow = ProductRequest & {
  seller: { id: string; name: string; email: string; verified: boolean };
  same: { sellers: string[]; numbers: string[]; otherVariants: number }; // other waiting requests: same product / same name on another platform or region
  decidedBy: string | null; events: RequestEventRow[];
};
export type AdminRequestList = { counts: Record<RequestStatus, number>; rows: AdminRequestRow[] };
export const REQUEST_TABS: RequestStatus[] = ["waiting", "added", "rejected"];
// Same product = same normalized name + platform + region (edition is free text and not part of it).
export const requestGroup = (r: { name: string; platform: string; region: string }) => `${nameKey(r.name)}|${r.platform.trim().toLowerCase()}|${r.region.trim().toLowerCase()}`;
export const REQUEST_EVENT_LABEL: Record<string, string> = { sent: "Sent by the seller", added: "Added", linked: "Linked to an existing product", rejected: "Rejected" };
export const ADMIN_REQUEST_ERRORS = {
  product: "Pick a published game key product.",
  draft: "Product saved as a draft. The request stays Waiting: publish the product, then use Link to existing.",
} as const;

// ---------- Catalog search for sellers (same matcher as the store header) ----------
// Only published game keys can be sold. Picking a result fills product + platform + region + edition.
export const sellableProducts = (products: Product[]) => products.filter((p) => p.kind === "game_key");
export const searchSellable = (products: Product[], query: string, max = 8) => searchProducts(sellableProducts(products), query).slice(0, max);
// "Already in the catalog — sell it": same name (normalized) + platform + region (an edition, when given, must match too).
export function catalogMatch(products: Product[], input: Pick<RequestInput, "name" | "platform" | "region" | "edition">): Product | null {
  const key = nameKey(input.name); const low = (s?: string) => (s ?? "").trim().toLowerCase();
  const platform = low(input.platform) === "ea app" ? "ea" : low(input.platform);
  return sellableProducts(products).find((p) => nameKey(p.name) === key && (low(p.platform) === platform || (platform === "ea" && /^(ea|ea app|origin)$/.test(low(p.platform))))
    && low(p.region) === low(input.region) && (!input.edition.trim() || low(p.edition) === low(input.edition) || (!p.edition && low(input.edition) === "standard"))) ?? null;
}
// "Elden Ring (PC) Steam Key GLOBAL" (seller pages, admin requests, emails).
export const productTitle = (p: Pick<Product, "name" | "platform" | "region" | "edition" | "os">) =>
  `${p.name}${p.edition && p.edition !== "Standard" ? ` – ${p.edition}` : ""}${p.os ? " (PC)" : ""}${p.platform ? ` ${p.platform} Key` : ""}${p.region ? ` ${p.region.toUpperCase()}` : ""}`;
// What the seller asked for: "Hades II · Steam · EUROPE · Deluxe".
export const requestLine = (r: Pick<RequestInput, "name" | "platform" | "region" | "edition">) => [r.name, r.platform, r.region.toUpperCase(), r.edition].filter(Boolean).join(" · ");
export const productLine = (p: Pick<Product, "platform" | "region" | "edition">) => [p.platform, p.region, p.edition && p.edition !== "Standard" ? p.edition : ""].filter(Boolean).join(" · ");
