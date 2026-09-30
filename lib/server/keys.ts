import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { GameKey } from "@/lib/keys";
import { db } from "./db";
import { keyReveal, orderItems, orderKey, orders } from "./db/schema";
import { lockLine, revealHeld } from "./returns";

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
// R2: one transaction that locks the order line (the same row lock createReturn takes), re-checks the units held by returns,
// then stamps revealed_at. A parallel return request waits for it (or it waits for the return), so both can never pass.
export async function revealKey(userId: string, id: string, ipAddress: string | null, userAgent: string | null): Promise<GameKey | null | "held"> {
  const out = await db.transaction(async (tx) => {
    const [k] = await tx.select({ itemId: orderKey.orderItemId }).from(orderKey).where(and(eq(orderKey.id, id), eq(orderKey.userId, userId))).limit(1);
    if (!k) return "missing" as const;
    await lockLine(tx, k.itemId);
    const [cur] = await tx.select({ revealedAt: orderKey.revealedAt }).from(orderKey).where(eq(orderKey.id, id)).for("update");
    if (!cur.revealedAt) {
      if (await revealHeld(tx, k.itemId)) return "held" as const; // showing an already revealed key again is fine
      await tx.update(orderKey).set({ revealedAt: new Date() }).where(and(eq(orderKey.id, id), isNull(orderKey.revealedAt)));
    }
    await tx.insert(keyReveal).values({ id: crypto.randomUUID(), keyId: id, userId, ipAddress, userAgent: userAgent?.slice(0, 500) ?? null });
    return "ok" as const;
  });
  if (out === "missing") return null;
  if (out === "held") return "held";
  return getKey(userId, id);
}
