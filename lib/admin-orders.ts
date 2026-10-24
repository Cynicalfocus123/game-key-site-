// Admin Orders + seller Orders (wireframe orders-admin-seller-wireframe.png, approved 2026-10-24). Shared by the server, the demo and the UI.
// Admin (section "orders") sees every order and everything on it: buyer email, billing address, IP + browser, the full key ("Show key" is logged).
// A seller sees only their own lines: order number, date, game, qty, price, You receive, key status and a masked buyer name (J***n). Never the
// buyer's email, address, IP, the order total or other lines of the same order (user 2026-10-24). Problems go through a CoreCart support ticket.

import type { BillingAddress } from "./address-formats";

// Why a pending order was closed (orders.failure_reason). Anything else = the payment failed.
export const HOLD_REASON = "Not paid within 30 minutes.";
export const REPLACED_REASON = "Replaced by a newer order.";
export const ADMIN_CANCEL_REASON = "Cancelled by CoreCart.";

// What admins see. Stored statuses: pending | paid | completed | refunded | cancelled.
export type OrderView = "paid" | "pending" | "failed" | "expired" | "cancelled" | "refunded";
export function orderView(status: string, failureReason: string | null | undefined): OrderView {
  if (status === "paid" || status === "completed") return "paid";
  if (status === "pending" || status === "refunded") return status;
  if (failureReason === HOLD_REASON) return "expired";
  if (failureReason === REPLACED_REASON || failureReason === ADMIN_CANCEL_REASON) return "cancelled";
  return "failed";
}
export const VIEW_LABEL: Record<OrderView, string> = { paid: "Paid", pending: "Pending", failed: "Failed", expired: "Expired", cancelled: "Cancelled", refunded: "Refunded" };
export const VIEW_CHIP: Record<OrderView, string> = { paid: "chip-green", pending: "chip-amber", failed: "chip-red", expired: "chip-grey", cancelled: "chip-grey", refunded: "chip-blue" };

// Tabs: Returned = a refunded order or one with a key taken back by an approved return.
export const ORDER_TABS = ["all", "paid", "pending", "failed", "expired", "cancelled", "returned"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export const TAB_LABEL: Record<OrderTab, string> = { all: "All", paid: "Paid", pending: "Pending", failed: "Failed", expired: "Expired", cancelled: "Cancelled", returned: "Returned" };
export const isOrderTab = (t: unknown): t is OrderTab => typeof t === "string" && (ORDER_TABS as readonly string[]).includes(t);
export const ORDERS_PAGE = 50;
export const ORDERS_POLL_MS = 30_000; // the list checks for new orders every 30 s

// "John Smith" → "J***h" (first + last letter of the first name). Empty → "Buyer".
export function maskName(name: string | null | undefined) {
  const w = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!w) return "Buyer";
  return w.length === 1 ? `${w}***` : `${w[0]}***${w[w.length - 1]}`;
}

export type AdminOrderQuery = { q: string; tab: OrderTab; method: string; seller: string; from: string; to: string; page: number; since?: string }; // seller: "" | "corecart" | seller user id; from / to = Bangkok days
export type KeyCountsLine = { held: number; delivered: number; revealed: number; returned: number };
export type AdminOrderRow = {
  id: string; number: string; createdAt: string; paidAt: string | null; view: OrderView; holdUntil: string | null;
  buyer: { id: string; name: string; email: string };
  items: { name: string; platform: string | null; quantity: number; seller: string }[];
  method: string | null; last4: string | null; currency: string; totalCents: number;
  keys: KeyCountsLine; hardware: boolean;
};
// Keys column of the admin list.
export function keysText(r: AdminOrderRow) {
  const k = r.keys;
  if (r.view === "pending") return k.held ? `${k.held} held` : "—";
  if (r.view !== "paid" && r.view !== "refunded") return k.delivered ? `${k.delivered} delivered` : r.items.some((i) => i.platform) ? "back on sale" : "—";
  if (!k.delivered) return r.hardware ? "Hardware · to ship" : "—";
  return `${k.delivered} delivered${k.revealed ? ` · ${k.revealed} revealed` : ""}${k.returned ? ` · ${k.returned} returned` : ""}`;
}
export type MoneyByCurrency = { currency: string; totalMinor: number }[];
export type AdminOrderTiles = { today: number; paidToday: number; paidTodayMoney: MoneyByCurrency; pendingNow: number; closedToday: number; sellerToday: { lines: number; sellers: number; usdCents: number } };
export type AdminOrderPage = { rows: AdminOrderRow[]; total: number; page: number; pageSize: number; counts: Record<OrderTab, number>; tiles: AdminOrderTiles; newSince: number; sellers: { id: string; name: string }[] };

export type AdminOrderKey = { id: string; last4: string; state: "delivered" | "revealed" | "returned"; revealedAt: string | null; returnedAt: string | null };
export type AdminOrderLine = {
  id: string; name: string; productId: string | null; platform: string | null; region: string | null; kind: string; quantity: number; unitPriceCents: number;
  seller: string; sellerId: string | null; sellerSlug: string | null; offerId: string | null; unitUsdCents: number | null; receiveUsdCents: number | null;
  keys: AdminOrderKey[]; held: number;
};
export type TimelineTone = "info" | "ok" | "bad";
export type TimelineEntry = { at: string; text: string; tone: TimelineTone };
export type AdminOrderDetail = AdminOrderRow & {
  status: string; failureReason: string | null; reviewNote: string | null; provider: string | null; providerRef: string | null;
  buyerSince: string | null; ipAddress: string | null; userAgent: string | null; billing: BillingAddress | null;
  subtotalMinor: number | null; discountMinor: number; promoCode: string | null; serviceFeeMinor: number; taxMinor: number; walletMinor: number; fxRate: string | null; ratesAt: string | null;
  lines: AdminOrderLine[]; timeline: TimelineEntry[]; tickets: number; canCancel: boolean; canResend: boolean;
};
export type OrderAction = { action: "show_key"; keyId: string } | { action: "resend" } | { action: "note"; text: string } | { action: "cancel" };
export const ORDER_NOTE_MAX = 1000;
export const ORDER_ADMIN_LIMIT = { max: 60, windowMs: 60_000 }; // actions per admin per minute
export const ADMIN_ORDER_ERRORS = {
  notFound: "Order not found.", key: "Key not found on this order.", note: `Write a note (up to ${ORDER_NOTE_MAX} characters).`, cancel: "Only a pending order can be cancelled.",
  resend: "Only a paid order has an \"Order confirmed\" email.", limit: "Too many changes. Wait a minute.", bad: "Unknown action.",
} as const;
export function parseOrderAction(b: unknown): OrderAction | null {
  const o = (b ?? {}) as Record<string, unknown>;
  if (o.action === "show_key" && typeof o.keyId === "string" && o.keyId.length <= 80) return { action: "show_key", keyId: o.keyId };
  if (o.action === "resend" || o.action === "cancel") return { action: o.action };
  if (o.action === "note" && typeof o.text === "string") return { action: "note", text: o.text };
  return null;
}
export const noteOk = (t: string) => t.trim().length > 0 && t.trim().length <= ORDER_NOTE_MAX;

// ---- Seller Orders (own lines only) ----
export const SALE_TABS = ["all", "sold", "held", "returned", "cancelled"] as const;
export type SaleTab = (typeof SALE_TABS)[number];
export const SALE_TAB_LABEL: Record<SaleTab, string> = { all: "All", sold: "Sold", held: "Held", returned: "Returned", cancelled: "Cancelled" };
export const isSaleTab = (t: unknown): t is SaleTab => typeof t === "string" && (SALE_TABS as readonly string[]).includes(t);
export type SaleState = "sold" | "held" | "returned" | "cancelled";
// One order line of this seller. buyer = masked name only.
export type SellerSaleRow = {
  itemId: string; orderNumber: string; createdAt: string; buyer: string; productId: string | null; name: string; platform: string | null; region: string | null;
  quantity: number; unitUsdCents: number; receiveUsdCents: number | null; state: SaleState; delivered: number; revealed: number; returned: number; last4: string[]; note: string;
};
export type SellerSalesQuery = { q: string; tab: SaleTab; from: string; to: string; page: number };
export type SellerSalesPage = { rows: SellerSaleRow[]; total: number; page: number; pageSize: number; counts: Record<SaleTab, number>;
  tiles: { soldTodayKeys: number; soldTodayOrders: number; incomeTodayUsdCents: number; receiveTodayUsdCents: number | null; heldNow: number } };
// Line state from the order + its keys. note = the grey line under the chip.
export function saleState(view: OrderView, k: { delivered: number; revealed: number; returned: number; quantity: number }): { state: SaleState; note: string } {
  if (view === "pending") return { state: "held", note: "waiting for payment" };
  if (view !== "paid" && view !== "refunded") return { state: "cancelled", note: view === "expired" ? "not paid in time · key back in stock" : view === "failed" ? "payment failed · key back in stock" : "order cancelled · key back in stock" };
  if (k.returned && k.returned >= k.quantity) return { state: "returned", note: k.revealed ? "returned after reveal · never resold" : "unrevealed → back on sale" };
  return { state: "sold", note: k.revealed ? `${k.revealed} of ${k.quantity} revealed` : "not revealed" };
}
export const SALE_CHIP: Record<SaleState, string> = { sold: "chip-green", held: "chip-amber", returned: "chip-blue", cancelled: "chip-grey" };
export const saleLabel = (r: Pick<SellerSaleRow, "state" | "revealed">) => (r.state === "sold" ? (r.revealed ? "Revealed" : "Delivered") : SALE_TAB_LABEL[r.state]);
export const tabOfSale = (s: SaleState): SaleTab => s;

// Bangkok day bounds for date filters ("2026-10-24" → [start, end) in ms).
export const bkkStart = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00+07:00`);
export const bkkToday = (now = Date.now()) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
export const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
