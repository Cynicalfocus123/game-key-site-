// Game key inventory (task B, 2026-09-29). Shared by the demo store, the server API and the admin page (no server imports).
// Admin pastes keys (one per line) or uploads a CSV (first column). Keys are stored encrypted on the server and never shown again in full.
export const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9-]{3,62}[A-Za-z0-9]$/;
export const KEYS_PER_UPLOAD = 1000;
export const KEY_UPLOAD_LIMIT = { max: 30, windowMs: 10 * 60_000 }; // uploads per admin
export type KeyStatus = "available" | "reserved" | "sold";
export type InventoryKey = { id: string; last4: string; status: KeyStatus; batch: string | null; createdAt: string };
export type KeyCounts = { available: number; reserved: number; sold: number };
export type KeyInventory = { counts: KeyCounts; keys: InventoryKey[] };
export type KeyUploadResult = { added: number; duplicates: number; invalid: string[] };
export const KEY_ERRORS = { empty: "Paste at least one key (one per line).", tooMany: `Up to ${KEYS_PER_UPLOAD} keys per upload.`, batch: "Batch name: up to 40 characters.",
  notFound: "Product not found", notKey: "Keys can only be added to game keys.", keyNotFound: "Key not found", notAvailable: "Only available keys can be removed.",
  limit: "Too many uploads. Wait a few minutes and try again.", config: "Key storage is not set up on the server (KEY_ENCRYPTION_KEY)." } as const;
export const emptyCounts = (): KeyCounts => ({ available: 0, reserved: 0, sold: 0 });
export const normalizeKey = (s: string) => s.trim().toUpperCase();
export const maskKey = (last4: string) => `•••••-${last4}`;
// One key per line; a CSV line uses its first column. Header-like lines ("key", "code") and blank lines are skipped.
export function parseKeyText(text: string): { codes: string[]; invalid: string[]; duplicates: number } {
  const seen = new Set<string>(); const invalid: string[] = []; let duplicates = 0;
  for (const line of text.split(/\r?\n/)) {
    const cell = line.split(/[,;\t]/)[0].trim().replace(/^"|"$/g, "");
    if (!cell || /^(key|keys|code|codes|game key)$/i.test(cell)) continue;
    const code = normalizeKey(cell);
    if (!KEY_RE.test(code)) { invalid.push(cell.slice(0, 70)); continue; }
    if (seen.has(code)) { duplicates++; continue; }
    seen.add(code);
  }
  return { codes: [...seen], invalid, duplicates };
}
