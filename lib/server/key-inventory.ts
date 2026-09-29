import { and, desc, eq, sql } from "drizzle-orm";
import { emptyCounts, KEY_ERRORS, type InventoryKey, type KeyCounts, type KeyStatus } from "@/lib/key-inventory";
import { db } from "./db";
import { decryptText, encryptionKey, encryptText, hmacOf } from "./secure";
import { product, productKey } from "./db/schema";

// Game key inventory (task B). Codes are encrypted at rest (AES-256-GCM); the admin page only ever gets the last 4 characters.
// Delivery at checkout (reserve → sold → order_key) comes with real payments; decryptKey is ready for it.
const secret = encryptionKey; // lib/server/secure.ts (same key + dev fallback as before)
const hashOf = hmacOf;
const encrypt = encryptText;
export function decryptKey(enc: string) {
  const key = secret(); if (!key) throw new Error(KEY_ERRORS.config);
  return decryptText(key, enc);
}

export async function keyCounts(productId?: string): Promise<Record<string, KeyCounts>> {
  const rows = await db.select({ productId: productKey.productId, status: productKey.status, n: sql<number>`count(*)::int` }).from(productKey)
    .where(productId ? eq(productKey.productId, productId) : undefined).groupBy(productKey.productId, productKey.status);
  const out: Record<string, KeyCounts> = {};
  for (const r of rows) (out[r.productId] ??= emptyCounts())[r.status as KeyStatus] = r.n;
  return out;
}
export async function listKeys(productId: string): Promise<InventoryKey[]> {
  return (await db.select().from(productKey).where(eq(productKey.productId, productId)).orderBy(desc(productKey.createdAt), productKey.id).limit(500))
    .map((k) => ({ id: k.id, last4: k.last4, status: k.status as KeyStatus, batch: k.batch, createdAt: k.createdAt.toISOString() }));
}
export async function isGameKeyProduct(productId: string) {
  const [p] = await db.select({ kind: product.kind, status: product.status }).from(product).where(eq(product.id, productId)).limit(1);
  return !p || p.status === "deleted" ? null : p.kind === "game_key";
}

// Adds new codes; codes already stored for this product (any status) are counted as duplicates, never stored twice.
export async function addKeys(productId: string, codes: string[], batch: string | null, adminId: string): Promise<{ ok: true; added: number; duplicates: number } | { ok: false; error: string }> {
  const key = secret(); if (!key) return { ok: false, error: KEY_ERRORS.config };
  const rows = codes.map((code) => ({ id: crypto.randomUUID(), productId, codeEnc: encrypt(key, code), codeHash: hashOf(key, code), last4: code.slice(-4), batch, addedBy: adminId }));
  let added = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const r = await db.insert(productKey).values(rows.slice(i, i + 200)).onConflictDoNothing({ target: [productKey.productId, productKey.codeHash] }).returning({ id: productKey.id });
    added += r.length;
  }
  return { ok: true, added, duplicates: codes.length - added };
}
export async function removeKey(productId: string, keyId: string) {
  const r = await db.delete(productKey).where(and(eq(productKey.id, keyId), eq(productKey.productId, productId), eq(productKey.status, "available"))).returning({ id: productKey.id });
  if (r.length) return { ok: true as const };
  const [k] = await db.select({ status: productKey.status }).from(productKey).where(and(eq(productKey.id, keyId), eq(productKey.productId, productId))).limit(1);
  return { ok: false as const, error: k ? KEY_ERRORS.notAvailable : KEY_ERRORS.keyNotFound };
}
