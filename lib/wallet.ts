// Admin wallet (future task S8). Balance = sum of the unchangeable wallet_ledger; admins never edit a number.
// A correction is a new "adjustment" row (credit + / debit −) with a required reason (shown to the customer) and the admin's id.
import type { Bucket, LedgerRow } from "./gift-cards";

export type AdjustDirection = "credit" | "debit";
export type Adjustment = { userId: string; direction: AdjustDirection; bucket: Bucket; amountMinor: number; reason: string };
export type AdminLedgerRow = LedgerRow & { by: string | null }; // by = admin email for adjustments, null for customer actions
export type AdminWallet = { walletMinor: number; giftMinor: number; transactions: AdminLedgerRow[] };

export const ADJUST_MAX = 10_000_000; // ฿100,000 per adjustment
export const REASON_MAX = 200;
export const ADJUST_LIMIT = { max: 30, windowMs: 10 * 60_000 }; // per admin
export const ADJUST_ERRORS = {
  amount: "Amount must be between ฿0.01 and ฿100,000.",
  reason: `Reason is required (max ${REASON_MAX} characters). The customer sees it.`,
  bucket: "Choose Wallet or Gift card balance.",
  negative: "A debit cannot take the balance below ฿0.",
  notFound: "User not found.",
  limit: "Too many adjustments. Wait 10 minutes and try again.",
} as const;
export const BUCKET_LABEL: Record<Bucket, string> = { wallet: "Wallet", gift: "Gift card balance" };

export function parseAdjustment(b: Record<string, unknown> | null): Adjustment | null {
  if (!b || typeof b.userId !== "string" || (b.direction !== "credit" && b.direction !== "debit")) return null;
  return { userId: b.userId, direction: b.direction, bucket: b.bucket as Bucket, amountMinor: Number(b.amountMinor), reason: typeof b.reason === "string" ? b.reason.replace(/\s+/g, " ").trim() : "" };
}
// null = fine. `current` = balance of the chosen bucket now.
export function checkAdjustment(a: Adjustment, current: number): string | null {
  if (a.bucket !== "wallet" && a.bucket !== "gift") return ADJUST_ERRORS.bucket;
  if (!Number.isInteger(a.amountMinor) || a.amountMinor < 1 || a.amountMinor > ADJUST_MAX) return ADJUST_ERRORS.amount;
  if (!a.reason || a.reason.length > REASON_MAX) return ADJUST_ERRORS.reason;
  if (a.direction === "debit" && current - a.amountMinor < 0) return ADJUST_ERRORS.negative;
  return null;
}
export const signedAmount = (a: Adjustment) => (a.direction === "credit" ? a.amountMinor : -a.amountMinor);
// Admin form: "12.50" THB → 1250 satang (null when not a valid amount with at most 2 decimals).
export function toSatang(input: string) {
  const v = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [a, b = ""] = v.split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0"));
}
