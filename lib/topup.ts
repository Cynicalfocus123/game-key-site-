// Wallet top-up rules (future task T1), shared by the demo store, the server and the UI.
// The customer pays in their charge currency (lib/currency/money.ts chargeCurrency); the wallet is credited in THB satang
// at the rate saved on the top-up. Limits are set in USD cents and converted into the paying currency.
import { convertMinor, formatMoney, type RateInfo } from "./currency/money";

export type TopUpStatus = "pending" | "paid" | "credited" | "failed" | "expired" | "cancelled";
// Customer view. amountMinor + currency = what is charged; creditMinor = THB satang added to the wallet on success.
export type TopUp = {
  id: string; number: string; amountMinor: number; currency: string; creditMinor: number; status: TopUpStatus; provider: string;
  failureReason: string | null; createdAt: string; expiresAt: string; paidAt: string | null; creditedAt: string | null; closedAt: string | null;
};
// reviewNote (R8, admin only): verified provider events that were refused (e.g. amount mismatch). Money may be taken with nothing credited: check it.
export type AdminTopUp = TopUp & { userId: string; email: string; providerRef: string | null; fxRate: string; closedBy: string | null; reviewNote?: string | null };
export type PaymentEventRow = { id: string; eventId: string; type: string; result: string; receivedAt: string };
export type AdminTopUpDetail = AdminTopUp & { events: PaymentEventRow[] };
export type AdminTopUpQuery = { q?: string; status?: string; provider?: string; from?: string; to?: string; page?: number };
export type AdminTopUpPage = { total: number; page: number; pageSize: number; topUps: AdminTopUp[] };
export type NewTopUp = { amountMinor: number; currency: string; idempotencyKey: string };
// What the browser does after "Pay": go to the provider page, hand data to the provider's script, or (demo / dev only) show simulate buttons.
export type PaymentStart = { kind: "redirect"; url: string } | { kind: "client"; data: Record<string, unknown> } | { kind: "simulate" };
// /api/config → payments. available = Pay works; simulate = demo or dev adapter (never on a live site).
export type PaymentsConfig = { provider: string; available: boolean; simulate: boolean };

export const TOPUP_PRESETS_USD = [500, 1000, 2500, 5000, 10000]; // $5, $10, $25, $50, $100
export const TOPUP_MIN_USD = 500; // $5.00
export const TOPUP_MAX_USD = 100000; // $1,000.00 per top-up
export const TOPUP_DAILY_USD = 200000; // $2,000.00 per user in any 24 hours (pending + paid + credited)
export const PENDING_MS = 30 * 60_000; // pending top-ups expire after 30 minutes
export const DAY_MS = 24 * 3600_000;
export const TOPUP_LIMIT = { max: 10, windowMs: 10 * 60_000 }; // new top-ups per user
export const WEBHOOK_LIMIT = { max: 300, windowMs: 60_000 }; // webhook calls per IP
export const CLOSE_REASON_MAX = 200;
export const TOPUP_PAGE_SIZE = 50;
export const USD_RATE: RateInfo = { code: "USD", decimals: 2, rate: "1" }; // rates are "units per 1 USD"

export const TOPUP_STATUSES: TopUpStatus[] = ["pending", "paid", "credited", "failed", "expired", "cancelled"];
export const isTopUpStatus = (v: unknown): v is TopUpStatus => typeof v === "string" && (TOPUP_STATUSES as string[]).includes(v);
export const STATUS_LABEL: Record<TopUpStatus, string> = { pending: "Pending", paid: "Paid", credited: "Credited", failed: "Failed", expired: "Expired", cancelled: "Cancelled" };
export const STATUS_CHIP: Record<TopUpStatus, string> = { pending: "chip-amber", paid: "chip-blue", credited: "chip-green", failed: "chip-red", expired: "", cancelled: "" };
// Rows that count toward the daily cap.
export const COUNTS_TOWARD_CAP: TopUpStatus[] = ["pending", "paid", "credited"];

export const TOPUP_ERRORS = {
  amount: "Enter an amount, like 25 or 25.50.",
  currency: "This currency can't be charged. Choose another currency.",
  unavailable: "Card payments are coming soon.",
  limit: "Too many top-ups. Wait 10 minutes and try again.",
  notFound: "Top-up not found.",
  notPending: "Only pending top-ups can be changed.",
  reason: "Enter a reason.",
  simulate: "Simulated payments only work in the demo and on a development server.",
} as const;

// Nice numbers: 2 significant digits (฿162.53 → ฿170 with ceil). step is in minor units, never below 1 major unit.
function niceStep(minor: number, decimals: number) {
  const mag = Math.floor(Math.log10(Math.max(1, minor)));
  return 10 ** Math.max(decimals, mag - 1);
}
const niceCeil = (minor: number, decimals: number) => { const s = niceStep(minor, decimals); return Math.ceil(minor / s) * s; };
const niceFloor = (minor: number, decimals: number) => { const s = niceStep(minor, decimals); return Math.floor(minor / s) * s; };

export type TopUpLimits = { currency: string; decimals: number; min: number; max: number; presets: number[] };
// Limits in `cur` minor units. usd = the USD rate from the same rate table (USD_RATE by default).
export function topUpLimits(cur: RateInfo, usd: RateInfo = USD_RATE): TopUpLimits {
  const conv = (c: number) => convertMinor(c, usd, cur);
  const min = cur.code === "USD" ? TOPUP_MIN_USD : niceCeil(conv(TOPUP_MIN_USD), cur.decimals);
  const max = cur.code === "USD" ? TOPUP_MAX_USD : niceFloor(conv(TOPUP_MAX_USD), cur.decimals);
  const presets = TOPUP_PRESETS_USD.map((p) => (cur.code === "USD" ? p : niceCeil(conv(p), cur.decimals))).filter((p) => p >= min && p <= max);
  return { currency: cur.code, decimals: cur.decimals, min, max, presets: [...new Set(presets)] };
}

// "25" | "25.5" | "1,000.00" → minor units in a currency with `decimals`; null when not a plain positive amount.
export function toMinor(input: string, decimals: number): number | null {
  const s = input.trim().replace(/,/g, "");
  const m = decimals > 0 ? new RegExp(`^(\\d{1,9})(?:\\.(\\d{1,${decimals}}))?$`).exec(s) : /^(\d{1,12})$/.exec(s);
  if (!m) return null;
  const v = Number(m[1]) * 10 ** decimals + Number((m[2] ?? "").padEnd(decimals, "0") || 0);
  return v > 0 && Number.isSafeInteger(v) ? v : null;
}

const fmt = (minor: number, l: { currency: string; decimals: number }, symbol?: string) => formatMoney(minor, { code: l.currency, decimals: l.decimals, symbol });
// Amount check against the per-top-up limits (same text in demo + server). symbol is only for the message.
export function checkAmount(amountMinor: unknown, l: TopUpLimits, symbol?: string): string | null {
  if (!Number.isSafeInteger(amountMinor) || (amountMinor as number) <= 0) return TOPUP_ERRORS.amount;
  if ((amountMinor as number) < l.min) return `The minimum top-up is ${fmt(l.min, l, symbol)}.`;
  if ((amountMinor as number) > l.max) return `The maximum top-up is ${fmt(l.max, l, symbol)}.`;
  return null;
}

// Daily cap in THB satang. usedThb = credit of the user's pending / paid / credited top-ups in the last 24 hours.
export const dailyCapThb = (base: RateInfo, usd: RateInfo = USD_RATE) => convertMinor(TOPUP_DAILY_USD, usd, base);
// CAP_SLACK: each top-up is rounded to the satang when converted, so e.g. 2 × $1,000 may land 1 satang over the $2,000 cap.
const CAP_SLACK = 100; // ฿1
export function checkDailyCap(newThb: number, usedThb: number, capThb: number, leftText: (thb: number) => string): string | null {
  if (usedThb + newThb <= capThb + CAP_SLACK) return null;
  const left = Math.max(0, capThb - usedThb);
  return left > 0 ? `This goes over the daily top-up limit. You can add up to ${leftText(left)} more today.` : "You reached the daily top-up limit. Try again tomorrow.";
}

export const parseNewTopUp = (b: Record<string, unknown> | null): NewTopUp | null =>
  b && typeof b.currency === "string" && typeof b.idempotencyKey === "string" && /^[A-Za-z0-9-]{8,64}$/.test(b.idempotencyKey)
    ? { amountMinor: Number(b.amountMinor), currency: b.currency.toUpperCase(), idempotencyKey: b.idempotencyKey } : null;

export const topUpNumber = () => `TU-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b % 10).join("")}`;
export const isExpiredNow = (t: Pick<TopUp, "status" | "expiresAt">, now = Date.now()) => t.status === "pending" && new Date(t.expiresAt).getTime() <= now;
export const closeReasonOk = (r: unknown): r is string => typeof r === "string" && r.trim().length > 0 && r.length <= CLOSE_REASON_MAX;
