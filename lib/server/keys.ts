import { and, desc, eq, inArray } from "drizzle-orm";
import type { GameKey } from "@/lib/keys";
import { db } from "./db";
import { keyReveal, orderItems, orderKey, orders } from "./db/schema";

const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const block = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => chars[b % 32]).join("");

// Sample orders only (dev): make sure every game_key unit has a key row. Real orders get keys from the supplier at checkout.
async function ensureSampleKeys(userId: string) {
  const lines = await db.select({ id: orderItems.id, quantity: orderItems.quantity }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.userId, userId), eq(orders.isSample, true), eq(orderItems.kind, "game_key")));
  if (!lines.length) return;
  const have = await db.select({ itemId: orderKey.orderItemId }).from(orderKey).where(inArray(orderKey.orderItemId, lines.map((l) => l.id)));
  const rows = lines.flatMap((l) => Array.from({ length: Math.max(l.quantity - have.filter((h) => h.itemId === l.id).length, 0) },
    () => ({ id: crypto.randomUUID(), orderItemId: l.id, userId, code: `SAMPLE-${block()}-${block()}-${block()}` })));
  if (rows.length) await db.insert(orderKey).values(rows);
}

const select = { id: orderKey.id, code: orderKey.code, revealedAt: orderKey.revealedAt, orderItemId: orderKey.orderItemId, name: orderItems.name, platform: orderItems.platform,
  region: orderItems.region, priceMinor: orderItems.unitPriceCents, orderId: orders.id, orderNumber: orders.number, currency: orders.currency, createdAt: orders.createdAt };
type Row = { [K in keyof typeof select]: unknown };
const toKey = (r: Row): GameKey => ({
  id: r.id as string, orderId: r.orderId as string, orderNumber: r.orderNumber as string, orderItemId: r.orderItemId as string, name: r.name as string,
  platform: (r.platform as string | null) ?? null, region: (r.region as string | null) ?? null, priceMinor: r.priceMinor as number, currency: r.currency as string,
  createdAt: (r.createdAt as Date).toISOString(), revealedAt: r.revealedAt ? (r.revealedAt as Date).toISOString() : null,
  code: r.revealedAt ? (r.code as string) : null, // never send an unrevealed code
});
const base = () => db.select(select).from(orderKey).innerJoin(orderItems, eq(orderItems.id, orderKey.orderItemId)).innerJoin(orders, eq(orders.id, orderItems.orderId));

export async function listKeys(userId: string) {
  await ensureSampleKeys(userId);
  return (await base().where(eq(orderKey.userId, userId)).orderBy(desc(orders.createdAt), orderItems.id, orderKey.createdAt)).map(toKey);
}
export async function getKey(userId: string, id: string) {
  const [r] = await base().where(and(eq(orderKey.userId, userId), eq(orderKey.id, id))).limit(1);
  return r ? toKey(r) : null;
}
// First reveal stamps revealed_at (ends the refund window). Every reveal is logged.
export async function revealKey(userId: string, id: string, ipAddress: string | null, userAgent: string | null) {
  const found = await getKey(userId, id);
  if (!found) return null;
  if (!found.revealedAt) await db.update(orderKey).set({ revealedAt: new Date() }).where(and(eq(orderKey.id, id), eq(orderKey.userId, userId)));
  await db.insert(keyReveal).values({ id: crypto.randomUUID(), keyId: id, userId, ipAddress, userAgent: userAgent?.slice(0, 500) ?? null });
  return getKey(userId, id);
}
