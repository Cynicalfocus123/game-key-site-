// Purchase popup ("Someone just purchased", user 2026-09-29, wireframe approved 2026-09-30: Claude outputs/wireframes/purchase-popup-wireframe.png).
// Shared by the server feed, the demo store, the admin page and the storefront popup.
// Privacy: a feed row is product + time + the country saved in the buyer's account. Never name, email, order number or IP.

export type RecentPurchase = { id: string; productId: string; at: string; country: string | null };
export type PopupSettings = { enabled: boolean; hidden: string[] }; // hidden = product ids never shown
export type PopupEvent = { at: string; by: string | null; detail: string }; // admin audit row (by = admin email)
export type PopupFeed = { enabled: boolean; purchases: RecentPurchase[] };

export const POPUP_DEFAULTS: PopupSettings = { enabled: true, hidden: [] };
export const RECENT_HOURS = 24; // only paid orders from the last 24 hours (user default 2026-09-30)
export const RECENT_LIMIT = 10; // newest 10
export const POPUP_TIMING = { firstMs: 3_000, showMs: 6_000, gapMs: 8_000, pollMs: 30_000 };
export const MAX_HIDDEN = 500;
export const POPUP_WRITE_LIMIT = { max: 30, windowMs: 60_000 };
export const POPUP_ERRORS = { bad: "Invalid settings.", tooMany: `You can hide up to ${MAX_HIDDEN} products.`, unknown: "One of the hidden products does not exist.", limit: "Too many changes. Wait a minute and try again." };
// Only product orders that are really paid (refunded / cancelled / pending never show). Wallet top-ups are not orders, so they never show.
export const POPUP_ORDER_STATUSES = ["paid", "completed"];
// Buyer accounts only: admins' own test orders never show.
export const isBuyerRole = (role: string) => role === "customer" || role === "seller";

// Pages without the popup: cart, checkout, payment, account, admin and the sign-in / sign-up forms.
const NO_POPUP = ["/cart", "/checkout", "/account", "/admin", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/sell/apply"];
export const popupAllowedOn = (path: string) => { const p = path.replace(/\/+$/, "") || "/"; return !NO_POPUP.some((x) => p === x || p.startsWith(`${x}/`)); };

// "this minute", "3 min ago", "1 hour ago", "5 hours ago".
export function timeAgo(at: string, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - Date.parse(at)) / 60_000));
  if (min < 1) return "this minute";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60); return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

// Admin input → clean settings, or an error text. known(id) = the product exists (any status: a draft can be hidden ahead of time).
export function parsePopupSettings(input: unknown, known: (id: string) => boolean): PopupSettings | string {
  const o = (input ?? {}) as Record<string, unknown>;
  if (typeof o.enabled !== "boolean" || !Array.isArray(o.hidden)) return POPUP_ERRORS.bad;
  if (o.hidden.some((x) => typeof x !== "string" || !x || x.length > 100)) return POPUP_ERRORS.bad;
  const hidden = [...new Set(o.hidden as string[])];
  if (hidden.length > MAX_HIDDEN) return POPUP_ERRORS.tooMany;
  if (hidden.some((x) => !known(x))) return POPUP_ERRORS.unknown;
  return { enabled: o.enabled, hidden };
}

// Audit text for one save, e.g. "Popup turned off · Hidden: Steam Gift Card · Shown again: Elden Ring". null = nothing changed.
export function popupChange(before: PopupSettings, after: PopupSettings, nameOf: (id: string) => string): string | null {
  const parts: string[] = [];
  if (before.enabled !== after.enabled) parts.push(after.enabled ? "Popup turned on" : "Popup turned off");
  const added = after.hidden.filter((x) => !before.hidden.includes(x)); const removed = before.hidden.filter((x) => !after.hidden.includes(x));
  if (added.length) parts.push(`Hidden: ${added.map(nameOf).join(", ")}`);
  if (removed.length) parts.push(`Shown again: ${removed.map(nameOf).join(", ")}`);
  return parts.length ? parts.join(" · ").slice(0, 1000) : null;
}

// Candidate order lines (already paid + buyer account) → feed: last 24 h, not hidden, newest first, one row per order line, max 10.
export type PurchaseRow = { lineId: string; productId: string | null; at: string; country: string | null };
export function pickRecent(rows: PurchaseRow[], settings: PopupSettings, now = Date.now(), live: (id: string) => boolean = () => true): RecentPurchase[] {
  if (!settings.enabled) return [];
  const from = now - RECENT_HOURS * 3600_000; const hidden = new Set(settings.hidden);
  return rows.filter((r): r is PurchaseRow & { productId: string } => !!r.productId && !hidden.has(r.productId) && live(r.productId) && Date.parse(r.at) >= from && Date.parse(r.at) <= now + 60_000)
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT_LIMIT)
    .map((r) => ({ id: r.lineId, productId: r.productId, at: r.at, country: r.country && /^[A-Z]{2}$/.test(r.country) ? r.country : null }));
}
