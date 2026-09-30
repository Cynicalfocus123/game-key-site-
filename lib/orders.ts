// Order page, receipt and seller rating rules (email task, 2026-09-29). Shared by the server, the demo and the UI (no server imports).

import { billingShort, type BillingAddress } from "./address-formats";
import { pctText } from "./fees";

export const CORECART_SELLER = "CoreCart";

// Status shown to the customer (Eneba style). Stored statuses: pending | paid | completed | refunded | cancelled.
export type StatusTone = "ok" | "wait" | "bad";
export const ORDER_STATUS: Record<string, { label: string; tone: StatusTone; payment: string; paymentNote: string }> = {
  completed: { label: "Order fulfilled", tone: "ok", payment: "Payment complete", paymentNote: "Payment was completed successfully." },
  paid: { label: "Processing", tone: "wait", payment: "Payment complete", paymentNote: "Payment was completed successfully. We are preparing your order." },
  pending: { label: "Payment incomplete", tone: "bad", payment: "Payment incomplete", paymentNote: "We did not receive the payment. You were not charged." },
  cancelled: { label: "Cancelled", tone: "bad", payment: "Payment cancelled", paymentNote: "The order was cancelled. You were not charged." },
  refunded: { label: "Refunded", tone: "bad", payment: "Refunded", paymentNote: "The payment was refunded." },
};
export const orderStatus = (s: string) => ORDER_STATUS[s] ?? { label: s, tone: "wait" as StatusTone, payment: s, paymentNote: "" };
export const isPaidStatus = (s: string) => s === "paid" || s === "completed" || s === "refunded";

export const PAYMENT_LABEL: Record<string, string> = { card: "Credit or debit card", wallet: "CoreCart wallet", paypal: "PayPal", apple_pay: "Apple Pay", google_pay: "Google Pay", alipay: "Alipay" };
export const paymentLabel = (m: string | null | undefined) => (m ? PAYMENT_LABEL[m] ?? m : PAYMENT_LABEL.card);
export const paymentText = (m: string | null | undefined, last4?: string | null) => `${paymentLabel(m)}${last4 && (m ?? "card") === "card" ? ` •••• ${last4}` : ""}`;

// Order title: first item name, "+N more items" in grey next to it (the page adds the grey part).
export const orderTitle = (items: { name: string }[]) => items[0]?.name ?? "Order";
export const moreItems = (items: unknown[]) => (items.length > 1 ? `+${items.length - 1} more ${items.length === 2 ? "item" : "items"}` : "");

// Search by order ID: case-insensitive, ignores spaces and dashes ("cc 4k7q" finds CC-4K7Q2M9X).
const squash = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");
export const matchesOrder = (number: string, q: string) => !q.trim() || squash(number).includes(squash(q));

// Sellers on an order (one "Rate the seller" per seller), first-seen order.
export const sellersOf = (items: { seller?: string | null }[]) => [...new Set(items.map((i) => i.seller || CORECART_SELLER))];

// ---- Receipt (= the order details). Tax is always optional: a saved tax ID is only shown on the same receipt. ----
export type TaxInfo = { name: string; taxId: string; address: string };
export const TAX_LIMITS = { name: 120, taxId: 20, address: 300 };
export const TAX_ERRORS = { name: "Enter the name or company for the receipt.", taxId: "Tax ID: 5–20 letters, digits or dashes.", address: "Enter the billing address (up to 300 characters).", tooLong: "Too long." };
export function parseTaxInfo(input: unknown): { ok: true; tax: TaxInfo | null } | { ok: false; error: string } {
  if (input === null) return { ok: true, tax: null }; // remove tax details
  const o = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
  const name = str(o.name), taxId = str(o.taxId).toUpperCase(), address = str(o.address);
  if (!name || name.length > TAX_LIMITS.name) return { ok: false, error: TAX_ERRORS.name };
  if (!/^[A-Z0-9-]{5,20}$/.test(taxId)) return { ok: false, error: TAX_ERRORS.taxId };
  if (!address || address.length > TAX_LIMITS.address) return { ok: false, error: TAX_ERRORS.address };
  return { ok: true, tax: { name, taxId, address } };
}
// N3 (user 2026-09-30): always "Receipt", with or without the customer's tax ID (a receipt = the order details, not a tax invoice).
export const documentTitle = () => "Receipt";
export const canReceipt = (status: string) => isPaidStatus(status); // no receipt for unpaid / cancelled orders

// Store details on receipts and emails. Company name, address, tax ID and social links come later (user 2026-09-29): placeholders until then.
export const COMPANY = { name: "CoreCart", address: ["Company address will be added"], country: "TH", taxId: null as string | null, supportEmail: "support@corecart.example" }; // supportEmail: placeholder until the user gives it

// ---- Seller rating ----
export const RATING_COMMENT_MAX = 500;
export const RATING_ERRORS = { stars: "Choose 1 to 5 stars.", comment: `Comment: up to ${RATING_COMMENT_MAX} characters.`, notYours: "Order not found.", notRatable: "You can rate the seller after the order is paid.", seller: "This seller is not on the order." };
export type Rating = { seller: string; stars: number; comment: string; updatedAt: string };
export function checkRating(input: { stars?: unknown; comment?: unknown }) {
  const stars = Number(input.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false as const, error: RATING_ERRORS.stars };
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > RATING_COMMENT_MAX) return { ok: false as const, error: RATING_ERRORS.comment };
  return { ok: true as const, stars, comment };
}
export const canRate = (status: string) => status === "completed" || status === "paid";

// ---- Task 7: service fee + sales tax + billing on a paid order (order page, receipt, email). Zero lines are left out. ----
export type ChargeFacts = { serviceFeeMinor?: number; taxMinor?: number; taxRateBp?: number; billing?: BillingAddress | null };
export function chargeRows(o: ChargeFacts, money: (minor: number) => string): [string, string][] {
  const rows: [string, string][] = [];
  if ((o.serviceFeeMinor ?? 0) > 0) rows.push(["Service fee:", money(o.serviceFeeMinor!)]);
  if ((o.taxMinor ?? 0) > 0) rows.push([`Sales tax (${pctText(o.taxRateBp ?? 0)}${o.billing ? `, ${o.billing.country}` : ""}):`, money(o.taxMinor!)]);
  if (o.billing) rows.push(["Billing details:", billingShort(o.billing, true)]);
  return rows;
}
