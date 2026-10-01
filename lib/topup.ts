// Wallet top-up rules (future task T1), shared by the demo store, the server and the UI.
// The customer pays in their charge currency (lib/currency/money.ts chargeCurrency); the wallet is credited in THB satang
// at the rate saved on the top-up. Limits are set in USD cents and converted into the paying currency.
import { convertMinor, formatMoney, type RateInfo } from "./currency/money";

export type TopUpStatus = "pending" | "paid" | "credited" | "failed" | "expired" | "cancelled";
// Top-up redesign (2026-10-01): card = payment provider (its webhook credits); bank = the customer sends a bank transfer, an admin confirms it arrived.
export type TopUpMethod = "card" | "bank";
// Customer view. amountMinor + currency = what is charged; creditMinor = THB satang added to the wallet on success.
export type TopUp = {
  id: string; number: string; method: TopUpMethod; amountMinor: number; currency: string; creditMinor: number; status: TopUpStatus; provider: string;
  failureReason: string | null; createdAt: string; expiresAt: string; paidAt: string | null; creditedAt: string | null; closedAt: string | null;
};
// reviewNote (R8, admin only): verified provider events that were refused (e.g. amount mismatch). Money may be taken with nothing credited: check it.
// customerRef = the customer's bank transfer reference (CC-…); confirmedBy = admin who confirmed that a bank transfer arrived.
export type AdminTopUp = TopUp & { userId: string; email: string; providerRef: string | null; fxRate: string; closedBy: string | null; reviewNote?: string | null; customerRef?: string | null; confirmedBy?: string | null };
export type PaymentEventRow = { id: string; eventId: string; type: string; result: string; receivedAt: string };
export type AdminTopUpDetail = AdminTopUp & { events: PaymentEventRow[] };
export type AdminTopUpQuery = { q?: string; status?: string; provider?: string; from?: string; to?: string; page?: number };
export type AdminTopUpPage = { total: number; page: number; pageSize: number; topUps: AdminTopUp[] };
export type NewTopUp = { amountMinor: number; currency: string; idempotencyKey: string; method?: TopUpMethod }; // method: card when left out
// What the browser does after "Pay": go to the provider page, hand data to the provider's script, or (demo / dev only) show simulate buttons.
export type PaymentStart = { kind: "redirect"; url: string } | { kind: "client"; data: Record<string, unknown> } | { kind: "simulate" };
// /api/config → payments. available = Pay works; simulate = demo or dev adapter (never on a live site).
export type PaymentsConfig = { provider: string; available: boolean; simulate: boolean };

// Top-up redesign (user 2026-09-29): presets $10 / $15 / $25 / $50 / $100, min $1 / max $100 per top-up (card and bank transfer alike).
export const TOPUP_PRESETS_USD = [1000, 1500, 2500, 5000, 10000]; // $10, $15, $25, $50, $100
export const TOPUP_MIN_USD = 100; // $1.00
export const TOPUP_MAX_USD = 10000; // $100.00 per top-up
export const TOPUP_DAILY_USD = 200000; // $2,000.00 per user in any 24 hours (pending + paid + credited)
export const PENDING_MS = 30 * 60_000; // pending card top-ups expire after 30 minutes
export const DAY_MS = 24 * 3600_000;
export const BANK_PENDING_MS = 7 * DAY_MS; // a bank transfer waits up to 7 days for the money to arrive
export const BANK_OPEN_MAX = 3; // bank transfers waiting at the same time, per customer
export const TOPUP_LIMIT = { max: 10, windowMs: 10 * 60_000 }; // new top-ups per user
export const WEBHOOK_LIMIT = { max: 300, windowMs: 60_000 }; // webhook calls per IP
export const CLOSE_REASON_MAX = 200;
export const TOPUP_PAGE_SIZE = 50;
export const USD_RATE: RateInfo = { code: "USD", decimals: 2, rate: "1" }; // rates are "units per 1 USD"

export const TOPUP_STATUSES: TopUpStatus[] = ["pending", "paid", "credited", "failed", "expired", "cancelled"];
export const isTopUpStatus = (v: unknown): v is TopUpStatus => typeof v === "string" && (TOPUP_STATUSES as string[]).includes(v);
export const STATUS_LABEL: Record<TopUpStatus, string> = { pending: "Pending", paid: "Paid", credited: "Credited", failed: "Failed", expired: "Expired", cancelled: "Cancelled" };
export const STATUS_CHIP: Record<TopUpStatus, string> = { pending: "chip-amber", paid: "chip-blue", credited: "chip-green", failed: "chip-red", expired: "", cancelled: "" };
// A pending bank transfer reads "Waiting for transfer" (customer + admin).
export const statusLabel = (t: Pick<TopUp, "status" | "method">) => (t.method === "bank" && t.status === "pending" ? "Waiting for transfer" : STATUS_LABEL[t.status]);
export const METHOD_LABEL: Record<TopUpMethod, string> = { card: "Card", bank: "Bank transfer" };
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
  bankOff: "Bank transfer is coming soon.",
  bankOpen: "You already have 3 bank transfers waiting. Wait until we confirm them, or contact support.",
  notBank: "Only bank transfers are confirmed here. Card top-ups are credited by the payment provider.",
  bankByAdmin: "Bank transfers are added by our team when the money arrives; they cannot be simulated.",
  notWaiting: "Only a bank transfer that is waiting (or expired) can be confirmed.",
  received: "Enter the amount that arrived, like 50 or 50.00.",
  bankRef: "Bank reference: up to 80 characters.",
} as const;
export const bankCurrencyError = (codes: string[]) => `We accept bank transfers in ${codes.join(" or ")} only.`;
// The amount an admin confirms must be exactly the top-up amount. A different amount: cancel the top-up and use Adjust balance on the user.
export const receivedMismatch = (expected: string) => `The amount received must be ${expected}. If a different amount arrived, cancel this top-up with a reason and use Adjust balance on the customer instead.`;

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
    && (b.method === undefined || b.method === "card" || b.method === "bank")
    ? { amountMinor: Number(b.amountMinor), currency: b.currency.toUpperCase(), idempotencyKey: b.idempotencyKey, method: b.method === "bank" ? "bank" : "card" } : null;

const digits = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b % 10).join("");
export const topUpNumber = (method: TopUpMethod = "card") => `${method === "bank" ? "BT" : "TU"}-${digits()}`;
// The customer's bank transfer reference: CC- + 6 characters without look-alikes (0/O, 1/I). Same for that customer every time.
const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const transferRef = () => `CC-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => REF_CHARS[b % REF_CHARS.length]).join("")}`;

// ─── Bank transfer details (admin Top-ups section). Not filled in = the Bank transfer card shows "Coming soon". ────────────────
export type BankSettings = { bankName: string; accountName: string; accountNumber: string; swift: string; currencies: string[] };
export type BankEvent = { at: string; by: string | null; detail: string };
// Customer view: our details + their own reference. null = not set up yet ("Coming soon").
export type BankInfo = BankSettings & { reference: string };
export const BANK_DEFAULTS: BankSettings = { bankName: "", accountName: "", accountNumber: "", swift: "", currencies: ["THB", "USD"] };
export const bankReady = (b: BankSettings) => Boolean(b.bankName && b.accountName && b.accountNumber && b.currencies.length);
export const BANK_WRITE_LIMIT = { max: 30, windowMs: 10 * 60_000 };
export const BANK_ERRORS = {
  bankName: "Bank name: up to 80 characters.",
  accountName: "Account name: up to 80 characters.",
  accountNumber: "Account number / IBAN: 4–40 letters, digits, spaces or dashes.",
  swift: "SWIFT / BIC: 8 or 11 letters and digits.",
  currencies: "Choose at least one currency that can be charged.",
  partial: "Fill in bank name, account name and account number together (or leave all three empty to hide bank transfer).",
  limit: "Too many changes. Wait a few minutes.",
} as const;
const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
// Body → settings, or an error text. isChargeable = currency is enabled + chargeable (the same list as card top-ups).
export function parseBankSettings(b: unknown, isChargeable: (code: string) => boolean): BankSettings | string {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const s: BankSettings = { bankName: clean(o.bankName), accountName: clean(o.accountName), accountNumber: clean(o.accountNumber), swift: clean(o.swift).toUpperCase(),
    currencies: Array.isArray(o.currencies) ? [...new Set(o.currencies.filter((c): c is string => typeof c === "string").map((c) => c.toUpperCase()))] : [] };
  if (s.bankName.length > 80) return BANK_ERRORS.bankName;
  if (s.accountName.length > 80) return BANK_ERRORS.accountName;
  if (s.accountNumber && !/^[A-Za-z0-9 -]{4,40}$/.test(s.accountNumber)) return BANK_ERRORS.accountNumber;
  if (s.swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(s.swift)) return BANK_ERRORS.swift;
  const filled = [s.bankName, s.accountName, s.accountNumber].filter(Boolean).length;
  if (filled > 0 && filled < 3) return BANK_ERRORS.partial;
  if (!s.currencies.length || s.currencies.some((c) => !isChargeable(c))) return BANK_ERRORS.currencies;
  return s;
}
export const cleanBankSettings = (v: unknown): BankSettings => { const p = parseBankSettings(v, () => true); return typeof p === "string" ? { ...BANK_DEFAULTS } : p; };
// Audit text for a change (null = nothing changed). Only admins with the Top-ups section see the history.
export function bankChange(a: BankSettings, b: BankSettings): string | null {
  const parts: string[] = [];
  const f = (label: string, x: string, y: string) => { if (x !== y) parts.push(`${label} ${x || "(empty)"} → ${y || "(empty)"}`); };
  f("Bank", a.bankName, b.bankName); f("Account name", a.accountName, b.accountName); f("Account number", a.accountNumber, b.accountNumber); f("SWIFT", a.swift, b.swift);
  f("Currencies", a.currencies.join(", "), b.currencies.join(", "));
  if (bankReady(a) !== bankReady(b)) parts.push(bankReady(b) ? "Bank transfer turned on" : "Bank transfer turned off (Coming soon)");
  return parts.length ? parts.join(" · ").slice(0, 1000) : null;
}
export const isExpiredNow = (t: Pick<TopUp, "status" | "expiresAt">, now = Date.now()) => t.status === "pending" && new Date(t.expiresAt).getTime() <= now;
export const closeReasonOk = (r: unknown): r is string => typeof r === "string" && r.trim().length > 0 && r.length <= CLOSE_REASON_MAX;
