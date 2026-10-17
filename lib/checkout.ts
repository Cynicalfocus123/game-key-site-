// Checkout rules (seller marketplace step 5: order + key delivery; wireframe approved 2026-10-08: Claude outputs/wireframes/order-pay-wireframe.png).
// Shared by the server (lib/server/checkout.ts), the demo store and the payment page (no server imports). Money = THB satang (catalog base).
// User 2026-10-08: the wallet is one payment method next to card / PayPal / Apple Pay / Google Pay; it pays only when the balance covers the
// whole total. Keys are held from Pay for HOLD_MINUTES so no one else buys them; they become the buyer's only when the payment goes through.
import { productById, type CartEntry } from "./catalog";
import { charges, type FeeSettings } from "./fees";
import { promoDiscount, type PublicPromo } from "./promo";
import type { BillingAddress } from "./address-formats";

export const HOLD_MINUTES = 30;
export const HOLD_MS = HOLD_MINUTES * 60_000;
export const MAX_ORDER_LINES = 20;
export const CHECKOUT_LIMIT = { max: 20, windowMs: 10 * 60_000 }; // Pay presses per customer
export const SIMULATE_LIMIT = { max: 30, windowMs: 10 * 60_000 };

// Payment methods in page order (wallet first, user 2026-10-08). Ids = orders.payment_method (lib/orders.ts PAYMENT_LABEL).
export type PayMethod = "wallet" | "paypal" | "card" | "apple_pay" | "google_pay";
export const PAY_METHODS: PayMethod[] = ["wallet", "paypal", "card", "apple_pay", "google_pay"];
export const isPayMethod = (v: unknown): v is PayMethod => typeof v === "string" && (PAY_METHODS as string[]).includes(v);

export const CHECKOUT_ERRORS = {
  empty: "Your cart is empty.", method: "Choose how to pay.", stock: "Not enough stock", product: "A product in your cart is no longer for sale. Check your cart.",
  wallet: "Not enough balance in your wallet.", walletEmpty: "No available funds in a wallet.", provider: "This payment method is coming soon.",
  promo: "Your promo code can no longer be used. Remove it in the cart and try again.", limit: "Too many tries. Wait a few minutes and try again.",
  notFound: "Order not found.", simulate: "Simulated payments are only for testing.", notPending: "This order is no longer waiting for payment.", verify: "Verify your email first.",
  start: "The payment could not be started. Try again.", bad: "Bad request",
} as const;

export type OrderLineInput = { productId: string; offerId?: string; qty: number };
export type PlaceOrderInput = { lines: OrderLineInput[]; method: PayMethod; promoCode: string | null; idempotencyKey: string; billing: BillingAddress | null };
// A line the store can no longer fill: shown in the "Not enough stock" message (left = keys still free, 0 = sold out).
export type StockProblem = { productId: string; offerId: string | null; name: string; seller: string; want: number; left: number };

// Request body → input (null = bad request). Same lines are merged; at most MAX_ORDER_LINES.
export function parsePlaceOrder(b: Record<string, unknown> | null): PlaceOrderInput | null {
  if (!b || !Array.isArray(b.lines) || !isPayMethod(b.method) || typeof b.idempotencyKey !== "string" || !/^[\w-]{8,80}$/.test(b.idempotencyKey)) return null;
  const merged = new Map<string, OrderLineInput>();
  for (const raw of b.lines as Record<string, unknown>[]) {
    const productId = typeof raw?.productId === "string" ? raw.productId.slice(0, 120) : ""; const offerId = typeof raw?.offerId === "string" && raw.offerId ? raw.offerId.slice(0, 80) : undefined;
    const qty = Number(raw?.qty); if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 100) return null;
    const k = `${productId}@${offerId ?? ""}`; const had = merged.get(k);
    merged.set(k, { productId, ...(offerId ? { offerId } : {}), qty: (had?.qty ?? 0) + qty });
  }
  if (!merged.size || merged.size > MAX_ORDER_LINES) return null;
  const code = typeof b.promoCode === "string" && b.promoCode.trim() ? b.promoCode.trim().toUpperCase().slice(0, 32) : null;
  return { lines: [...merged.values()], method: b.method, promoCode: code, idempotencyKey: b.idempotencyKey, billing: (b.billing && typeof b.billing === "object" ? b.billing : null) as BillingAddress | null };
}

// One order line priced by the server (never by the browser). unit = THB satang; seller lines: unitUsdCents = the offer price at order time.
export type PricedLine = { productId: string; offerId: string | null; name: string; kind: "game_key" | "hardware"; platform: string | null; region: string | null; qty: number; unit: number;
  seller: string; sellerId: string | null; unitUsdCents: number | null };
export type OrderMoney = { subtotal: number; discount: number; fee: number; tax: number; taxBp: number; total: number };
// Sub-total, promo discount (CoreCart lines only: lib/promo.ts), service fee + tax (lib/fees.ts, tax country = billing / account / store country).
export function orderMoney(lines: PricedLine[], promo: PublicPromo | null, fees: FeeSettings, country: string): OrderMoney {
  const subtotal = lines.reduce((t, l) => t + l.unit * l.qty, 0);
  const entries: CartEntry[] = lines.map((l) => ({ productId: l.productId, qty: l.qty, ...(l.offerId ? { offerId: l.offerId, unit: l.unit } : {}) }));
  const discount = promo ? promoDiscount(promo, entries).discount : 0;
  const c = charges(fees, subtotal - discount, country);
  return { subtotal, discount, fee: c.fee, tax: c.tax ?? 0, taxBp: c.taxBp ?? 0, total: c.total };
}

// Wallet row on the payment page (wireframe 1 / 1b / 1c). balance + total in THB satang.
export type WalletState = "enough" | "short" | "empty";
export const walletState = (balance: number, total: number): WalletState => (balance <= 0 ? "empty" : balance >= total ? "enough" : "short");
// Wallet debit: gift card balance first (it cannot be withdrawn), then the wallet. Returns the minor units taken from each bucket.
export function walletSplit(gift: number, wallet: number, total: number) {
  const fromGift = Math.min(Math.max(gift, 0), total);
  return { gift: fromGift, wallet: total - fromGift };
}

// Where the buyer goes once an order is paid: one game key line → Get your product (reveal page); else the order page.
export function afterPaidHref(o: { id: string; items: { id: string; kind: string }[] }) {
  const keys = o.items.filter((i) => i.kind === "game_key");
  return keys.length === 1 && o.items.length === 1 ? `/account/keys/get?item=${encodeURIComponent(keys[0].id)}` : `/account/orders/view?id=${encodeURIComponent(o.id)}`;
}
// Order status once paid: only keys → completed (delivered at once); any hardware → paid ("Processing", shipping comes later).
export const paidStatus = (items: { kind: string }[]) => (items.every((i) => i.kind === "game_key") ? "completed" : "paid");
// "Not enough stock" line text.
export const problemText = (p: StockProblem) => `${p.name}${p.seller ? ` · seller ${p.seller}` : ""} — you want ${p.want}, ${p.left ? `only ${p.left} left` : "sold out"}`;
export const productName = (productId: string) => productById(productId)?.name ?? "Product";
