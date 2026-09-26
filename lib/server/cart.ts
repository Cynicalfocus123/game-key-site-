import { and, desc, eq } from "drizzle-orm";
import { cleanCart, maxQty, mergeCarts, productById, type CartEntry } from "@/lib/catalog";
import { db } from "./db";
import { cartItem } from "./db/schema";

// Account cart. Quantities are capped by lib/catalog.ts rules (5 per game key, hardware ≤ stock). Newest rows first.
export async function getCart(userId: string): Promise<CartEntry[]> {
  const rows = await db.select().from(cartItem).where(eq(cartItem.userId, userId)).orderBy(desc(cartItem.createdAt));
  return cleanCart(rows.map((r) => ({ productId: r.productId, qty: r.quantity })));
}

export async function setCartItem(userId: string, productId: string, qty: number) {
  const p = productById(productId);
  if (!p) return null;
  const q = Math.min(Math.max(Math.floor(qty) || 0, 0), maxQty(p));
  if (q === 0) await db.delete(cartItem).where(and(eq(cartItem.userId, userId), eq(cartItem.productId, productId)));
  else await db.insert(cartItem).values({ userId, productId, quantity: q })
    .onConflictDoUpdate({ target: [cartItem.userId, cartItem.productId], set: { quantity: q, updatedAt: new Date() } });
  return getCart(userId);
}

// Sign-in/register merge of the browser's guest cart: same product → higher qty (capped), no duplicates.
export async function mergeCart(userId: string, guest: unknown) {
  const current = await getCart(userId);
  const merged = mergeCarts(current, cleanCart(guest));
  const now = Date.now();
  for (const [i, e] of merged.entries()) {
    const had = current.find((c) => c.productId === e.productId);
    if (had?.qty === e.qty) continue;
    // New guest rows get newer created_at so they list first, in guest order.
    const createdAt = new Date(now - i);
    await db.insert(cartItem).values({ userId, productId: e.productId, quantity: e.qty, createdAt })
      .onConflictDoUpdate({ target: [cartItem.userId, cartItem.productId], set: { quantity: e.qty, updatedAt: new Date() } });
  }
  return getCart(userId);
}

export async function clearCart(userId: string) {
  await db.delete(cartItem).where(eq(cartItem.userId, userId));
  return [] as CartEntry[];
}
