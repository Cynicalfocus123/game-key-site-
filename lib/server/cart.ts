import { and, desc, eq } from "drizzle-orm";
import { cleanCart, lineKey, lineMax, mergeCarts, maxQty, productById, type CartEntry } from "@/lib/catalog";
import type { OfferQuote } from "@/lib/marketplace";
import { ensureCatalog } from "./catalog";
import { db } from "./db";
import { cartItem } from "./db/schema";
import { offerQuotes } from "./marketplace";

// Account cart. Quantities are capped by lib/catalog.ts rules (5 per game key, hardware ≤ stock). Newest rows first.
// Seller offer lines (marketplace step 4): price (THB at today's rate) + max keys come from the live offer on every read; an offer that
// is gone (paused, sold out, seller hidden) drops out of the cart.
const withQuote = (e: CartEntry, q: OfferQuote | undefined): CartEntry | null =>
  !e.offerId ? e : q && q.productId === e.productId ? { ...e, unit: q.unit, max: q.max, seller: q.seller } : null;
async function quoted(entries: { productId: string; qty: number; offerId?: string }[]) {
  const quotes = new Map((await offerQuotes(entries.flatMap((e) => (e.offerId ? [e.offerId] : [])))).map((q) => [q.offerId, q]));
  return entries.map((e) => withQuote(e as CartEntry, e.offerId ? quotes.get(e.offerId) : undefined)).filter((e): e is CartEntry => Boolean(e));
}
export async function getCart(userId: string): Promise<CartEntry[]> {
  await ensureCatalog();
  const rows = await db.select().from(cartItem).where(eq(cartItem.userId, userId)).orderBy(desc(cartItem.createdAt));
  return cleanCart(await quoted(rows.map((r) => ({ productId: r.productId, qty: r.quantity, ...(r.offerId ? { offerId: r.offerId } : {}) }))));
}

// offerId = a seller offer line (must be a live offer of that product); none = CoreCart's own stock.
export async function setCartItem(userId: string, productId: string, qty: number, offerId?: string) {
  await ensureCatalog();
  const p = productById(productId);
  if (!p) return null;
  let max = maxQty(p);
  if (offerId && qty > 0) { const [e] = await quoted([{ productId, qty: 1, offerId }]); if (!e) return null; max = lineMax(e); } // removing never needs a live offer
  const q = Math.min(Math.max(Math.floor(qty) || 0, 0), max); const oid = offerId ?? "";
  if (q === 0) await db.delete(cartItem).where(and(eq(cartItem.userId, userId), eq(cartItem.productId, productId), eq(cartItem.offerId, oid)));
  else await db.insert(cartItem).values({ userId, productId, offerId: oid, quantity: q })
    .onConflictDoUpdate({ target: [cartItem.userId, cartItem.productId, cartItem.offerId], set: { quantity: q, updatedAt: new Date() } });
  return getCart(userId);
}

// Sign-in/register merge of the browser's guest cart: same line → higher qty (capped), no duplicates.
export async function mergeCart(userId: string, guest: unknown) {
  const current = await getCart(userId);
  const merged = mergeCarts(current, await quoted(cleanCart(guest)));
  const now = Date.now();
  for (const [i, e] of merged.entries()) {
    const had = current.find((c) => lineKey(c) === lineKey(e));
    if (had?.qty === e.qty) continue;
    // New guest rows get newer created_at so they list first, in guest order.
    const createdAt = new Date(now - i);
    await db.insert(cartItem).values({ userId, productId: e.productId, offerId: e.offerId ?? "", quantity: e.qty, createdAt })
      .onConflictDoUpdate({ target: [cartItem.userId, cartItem.productId, cartItem.offerId], set: { quantity: e.qty, updatedAt: new Date() } });
  }
  return getCart(userId);
}

export async function clearCart(userId: string) {
  await db.delete(cartItem).where(eq(cartItem.userId, userId));
  return [] as CartEntry[];
}
