// Balance + gift cards (Handoff v8 C3): shared by the balance page, admin gift cards page, demo store and server.
// Amounts are THB satang (base currency) and shown converted. Codes are XXXX-XXXX-XXXX-XXXX, single use, full amount.
// Only a SHA-256 hash + last 4 characters are stored; the full code is shown once to the admin who creates it.

export type Bucket = "wallet" | "gift";
export type LedgerType = "gift_card_redeem" | "adjustment" | "top_up"; // later: purchase (pay with wallet), top_up_refund
export type LedgerRow = { id: string; createdAt: string; bucket: Bucket; type: LedgerType | string; ref: string; amountMinor: number; balanceMinor: number };
export type BalanceData = { walletMinor: number; giftMinor: number; transactions: LedgerRow[] }; // transactions newest first
export type GiftCardStatus = "active" | "redeemed" | "expired" | "disabled";
export type GiftCard = {
  id: string; last4: string; amountMinor: number; note: string | null; expiresAt: string | null; disabled: boolean; createdAt: string; createdBy: string | null;
  redeemedAt: string | null; redeemedBy: string | null; // redeemedBy = customer email
};
export type NewGiftCards = { amountMinor: number; count: number; expiresAt: string | null; note: string | null };

export const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
export const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const MAX_CREATE = 50;
export const MIN_AMOUNT = 100; // ฿1
export const MAX_AMOUNT = 10_000_000; // ฿100,000
export const MAX_NOTE = 120;
// Redeem attempts per signed-in user (server also limits per IP). Stops code guessing.
export const REDEEM_LIMIT = { max: 5, windowMs: 10 * 60_000 };

// Customer input → XXXX-XXXX-XXXX-XXXX (spaces and dashes ignored, upper case). null when it cannot be a code.
export function normalizeCode(input: string) {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{16}$/.test(raw)) return null;
  return raw.match(/.{4}/g)!.join("-");
}
// Live formatting while typing: groups of 4, max 16 characters.
export const formatTyping = (input: string) => (input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16).match(/.{1,4}/g) ?? []).join("-");
export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => CODE_CHARS[b % 32]).join("").match(/.{4}/g)!.join("-");
}
export async function hashCode(code: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`corecart-gift:${code}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const maskedCode = (last4: string) => `••••-••••-••••-${last4}`;

export function giftCardStatus(c: Pick<GiftCard, "redeemedAt" | "disabled" | "expiresAt">, now = Date.now()): GiftCardStatus {
  if (c.redeemedAt) return "redeemed";
  if (c.disabled) return "disabled";
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= now) return "expired";
  return "active";
}
// Why a code cannot be redeemed (same text in demo + server).
export const REDEEM_ERRORS = {
  format: "Enter the 16-character code, like ABCD-EFGH-JKLM-NPQR.",
  notFound: "This gift card code was not found. Check the code and try again.",
  redeemed: "This gift card was already redeemed.",
  expired: "This gift card has expired.",
  disabled: "This gift card is disabled. Contact support if you think this is wrong.",
  limit: "Too many attempts. Wait 10 minutes and try again.",
} as const;

export function checkNewGiftCards(input: Partial<NewGiftCards>): string | null {
  const { amountMinor, count, expiresAt, note } = input;
  if (!Number.isInteger(amountMinor) || amountMinor! < MIN_AMOUNT || amountMinor! > MAX_AMOUNT) return "Amount must be between ฿1 and ฿100,000.";
  if (!Number.isInteger(count) || count! < 1 || count! > MAX_CREATE) return `Create between 1 and ${MAX_CREATE} cards at a time.`;
  if (expiresAt != null && (Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) return "Expiry must be in the future.";
  if (note != null && (typeof note !== "string" || note.length > MAX_NOTE)) return `Note is too long (max ${MAX_NOTE} characters).`;
  return null;
}

// Ledger entries (oldest → newest) → rows newest first with the total balance after each entry.
export function withBalances(entries: Omit<LedgerRow, "balanceMinor">[]): LedgerRow[] {
  let total = 0;
  return [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((e) => ({ ...e, balanceMinor: (total += e.amountMinor) })).reverse();
}
export const balanceOf = (rows: LedgerRow[], bucket: Bucket) => rows.filter((r) => r.bucket === bucket).reduce((t, r) => t + r.amountMinor, 0);
export const typeLabel = (t: string) => ({ gift_card_redeem: "Gift card redeemed", adjustment: "Adjustment by CoreCart", top_up: "Wallet top-up", purchase: "Purchase", top_up_refund: "Top-up refunded" } as Record<string, string>)[t] ?? t;
