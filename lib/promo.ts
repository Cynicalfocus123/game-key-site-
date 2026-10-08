// Promo codes (Handoff v12 step 3b): shared by admin pages, storefront cart/checkout, demo store and server.
// Layout follows the common Shopify / WooCommerce / Stripe / BigCommerce pattern. Only code + discount value are required.
// Money is THB satang (base currency); percent values are whole percent 1–100.
import { cartSubtotal, productById, type CartEntry, type Product } from "./catalog";
import { GUIDES, guideFor } from "./keys";

export type PromoType = "percent" | "fixed";
export type PromoCode = {
  id: string; code: string; type: PromoType; value: number; maxDiscount: number | null;
  appliesTo: "all" | "categories"; categories: string[]; minSubtotal: number | null;
  startsAt: string; expiresAt: string | null; maxUses: number | null; oncePerCustomer: boolean;
  uses: number; enabled: boolean; createdAt: string; updatedAt: string;
};
export type PromoInput = Omit<PromoCode, "id" | "uses" | "createdAt" | "updatedAt">;
// What the storefront gets back from validate (no usage counts, no ids).
export type PublicPromo = Pick<PromoCode, "code" | "type" | "value" | "maxDiscount" | "appliesTo" | "categories" | "minSubtotal" | "startsAt" | "expiresAt" | "oncePerCustomer">;
export type PromoStatus = "active" | "scheduled" | "expired" | "used_up" | "disabled";

export const PROMO_CODE_RE = /^[A-Z0-9-]{3,32}$/;
export const cleanPromoCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
export const VALIDATE_LIMIT = { max: 10, windowMs: 60_000 }; // unknown codes per IP per minute
export const MAX_FIXED = 10_000_000; // ฿100,000

// Categories: top level + platform sub-choices under Digital games. Picking "Digital games" covers every platform.
export const PROMO_CATEGORIES: { id: string; label: string; subs?: { id: string; label: string }[] }[] = [
  { id: "digital-games", label: "Digital games", subs: GUIDES.map((g) => ({ id: `platform-${g.slug}`, label: g.name })) },
  { id: "pc-parts", label: "PC parts" },
  { id: "monitors", label: "Monitors" },
  { id: "gaming-hardware", label: "Gaming hardware" },
];
const LABELS = new Map(PROMO_CATEGORIES.flatMap((c) => [[c.id, c.label] as const, ...(c.subs ?? []).map((s) => [s.id, s.label] as const)]));
export const isPromoCategory = (id: string) => LABELS.has(id);
export const categoryLabel = (id: string) => LABELS.get(id) ?? id;
export const scopeLabel = (p: Pick<PublicPromo, "appliesTo" | "categories">) => (p.appliesTo === "all" ? "All products" : p.categories.map(categoryLabel).join(", "));
export function productCategories(p: Product) {
  const g = p.kind === "game_key" ? guideFor(p.platform) : null;
  return g ? [p.category, `platform-${g.slug}`] : [p.category];
}
export const eligible = (promo: Pick<PublicPromo, "appliesTo" | "categories">, p: Product) => promo.appliesTo === "all" || productCategories(p).some((c) => promo.categories.includes(c));

export function promoStatus(p: Pick<PromoCode, "enabled" | "startsAt" | "expiresAt" | "maxUses" | "uses">, now = Date.now()): PromoStatus {
  if (!p.enabled) return "disabled";
  if (p.expiresAt && Date.parse(p.expiresAt) <= now) return "expired";
  if (p.maxUses !== null && p.uses >= p.maxUses) return "used_up";
  if (Date.parse(p.startsAt) > now) return "scheduled";
  return "active";
}
// Validate reasons (same text in demo + server). Minimum order is added with the amount by the caller.
export const PROMO_ERRORS: Record<Exclude<PromoStatus, "active"> | "not_found" | "limit", string> = {
  not_found: "This code was not found.",
  disabled: "This code is not active.",
  scheduled: "This code is not active yet.",
  expired: "This code has expired.",
  used_up: "This code has been used up.",
  limit: "Too many tries. Wait a minute and try again.",
};
export const toPublic = (p: PromoCode): PublicPromo => ({ code: p.code, type: p.type, value: p.value, maxDiscount: p.maxDiscount, appliesTo: p.appliesTo, categories: p.categories,
  minSubtotal: p.minSubtotal, startsAt: p.startsAt, expiresAt: p.expiresAt, oncePerCustomer: p.oncePerCustomer });

// Discount for a cart. Only eligible lines count. issue = why the discount is 0 while the code stays applied.
export type PromoResult = { discount: number; eligibleSubtotal: number; issue: null | { kind: "scope"; label: string } | { kind: "min"; missing: number } };
export function promoDiscount(p: PublicPromo, entries: CartEntry[]): PromoResult {
  const subtotal = cartSubtotal(entries);
  // Seller offer lines (marketplace) never count: a CoreCart code only discounts CoreCart's own stock. They still count toward the minimum order.
  const eligibleSubtotal = entries.reduce((t, e) => { const pr = productById(e.productId); return pr && !e.offerId && eligible(p, pr) ? t + pr.price * e.qty : t; }, 0);
  if (p.minSubtotal && subtotal < p.minSubtotal) return { discount: 0, eligibleSubtotal, issue: { kind: "min", missing: p.minSubtotal - subtotal } };
  if (!eligibleSubtotal) return { discount: 0, eligibleSubtotal, issue: subtotal ? { kind: "scope", label: scopeLabel(p) } : null };
  let discount = p.type === "percent" ? Math.round((eligibleSubtotal * p.value) / 100) : p.value;
  if (p.type === "percent" && p.maxDiscount) discount = Math.min(discount, p.maxDiscount);
  return { discount: Math.min(discount, eligibleSubtotal), eligibleSubtotal, issue: null };
}
// Still usable by time? (the client re-checks expiry without asking the server)
export const livePromo = (p: PublicPromo, now = Date.now()) => Date.parse(p.startsAt) <= now && (!p.expiresAt || Date.parse(p.expiresAt) > now);

// Admin form validation. Returns field → message (empty = ok).
export type PromoErrors = Partial<Record<"code" | "value" | "maxDiscount" | "categories" | "minSubtotal" | "maxUses" | "dates", string>>;
export function checkPromoInput(i: PromoInput): PromoErrors {
  const e: PromoErrors = {};
  if (!PROMO_CODE_RE.test(i.code)) e.code = "Use 3–32 letters, numbers or dashes.";
  if (i.type === "percent" ? !(Number.isInteger(i.value) && i.value >= 1 && i.value <= 100) : !(Number.isInteger(i.value) && i.value > 0 && i.value <= MAX_FIXED))
    e.value = i.type === "percent" ? "Enter a percentage from 1 to 100." : "Enter an amount greater than ฿0.";
  if (i.maxDiscount !== null && !(Number.isInteger(i.maxDiscount) && i.maxDiscount > 0)) e.maxDiscount = "Enter an amount greater than ฿0.";
  if (i.appliesTo === "categories" && (!i.categories.length || !i.categories.every(isPromoCategory))) e.categories = "Pick at least one category.";
  if (i.minSubtotal !== null && !(Number.isInteger(i.minSubtotal) && i.minSubtotal > 0)) e.minSubtotal = "Enter an amount greater than ฿0.";
  if (i.maxUses !== null && !(Number.isInteger(i.maxUses) && i.maxUses > 0)) e.maxUses = "Enter a number greater than 0.";
  if (Number.isNaN(Date.parse(i.startsAt)) || (i.expiresAt !== null && Number.isNaN(Date.parse(i.expiresAt)))) e.dates = "Enter a valid date and time.";
  else if (i.expiresAt !== null && Date.parse(i.expiresAt) <= Date.parse(i.startsAt)) e.dates = "End date must be after the start date.";
  return e;
}
// Untrusted JSON → PromoInput (types only; checkPromoInput does the rules).
export function parsePromoInput(b: Record<string, unknown> | null): PromoInput | null {
  if (!b) return null;
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : typeof v === "number" ? v : NaN);
  const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : typeof v === "string" ? v : "invalid");
  if (typeof b.code !== "string" || (b.type !== "percent" && b.type !== "fixed") || typeof b.value !== "number") return null;
  const cats = Array.isArray(b.categories) ? b.categories.filter((c): c is string => typeof c === "string").slice(0, 30) : [];
  return { code: cleanPromoCode(b.code), type: b.type, value: b.value, maxDiscount: b.type === "percent" ? num(b.maxDiscount) : null,
    appliesTo: b.appliesTo === "categories" ? "categories" : "all", categories: b.appliesTo === "categories" ? [...new Set(cats)] : [],
    minSubtotal: num(b.minSubtotal), startsAt: str(b.startsAt) ?? new Date().toISOString(), expiresAt: str(b.expiresAt), maxUses: num(b.maxUses),
    oncePerCustomer: b.oncePerCustomer === true, enabled: b.enabled !== false } as PromoInput;
}

// "10% off" / "฿200 off". fmt formats THB satang (admin: THB, storefront: chosen currency).
export const discountLabel = (p: Pick<PublicPromo, "type" | "value">, fmt: (thb: number) => string) => (p.type === "percent" ? `${p.value}% off` : `${fmt(p.value)} off`);
const bkk = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
// Plain-words summary for the admin Summary card and list.
export function promoSummary(p: Omit<PromoInput, "code" | "enabled">, fmt: (thb: number) => string, now = Date.now()) {
  const parts = [`${discountLabel(p, fmt)} ${p.appliesTo === "all" ? "all products" : scopeLabel(p) || "selected categories"}`];
  if (p.type === "percent" && p.maxDiscount) parts.push(`Max discount ${fmt(p.maxDiscount)}`);
  parts.push(p.minSubtotal ? `Min order ${fmt(p.minSubtotal)}` : "No minimum order");
  parts.push(p.maxUses ? `${p.maxUses} use${p.maxUses === 1 ? "" : "s"} total` : "Unlimited uses");
  if (p.oncePerCustomer) parts.push("1 per customer");
  if (!Number.isNaN(Date.parse(p.startsAt)) && Date.parse(p.startsAt) > now) parts.push(`Starts ${bkk(p.startsAt)}`);
  parts.push(p.expiresAt && !Number.isNaN(Date.parse(p.expiresAt)) ? `Ends ${bkk(p.expiresAt)}` : "No end date");
  return parts;
}
// Bangkok wall time for <input type="datetime-local"> and back.
export const toBkkInput = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 16);
export const fromBkkInput = (v: string) => (v ? new Date(`${v}:00+07:00`).toISOString() : "");
export function randomPromoCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `SAVE-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => chars[b % 32]).join("")}`;
}
// Built-in WELCOME10 (demo store seed; server seeds it too so the storefront works the same out of the box).
export const WELCOME10: PromoInput = { code: "WELCOME10", type: "percent", value: 10, maxDiscount: null, appliesTo: "all", categories: [], minSubtotal: null,
  startsAt: "2026-01-01T00:00:00.000Z", expiresAt: null, maxUses: null, oncePerCustomer: false, enabled: true };
