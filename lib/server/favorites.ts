import { and, desc, eq } from "drizzle-orm";
import { cleanFavorites, MAX_FAVORITES, mergeFavorites, productById } from "@/lib/catalog";
import { ensureCatalog } from "./catalog";
import { db } from "./db";
import { favorite } from "./db/schema";

// Account favorites, newest first. Unknown product ids are skipped.
export async function getFavorites(userId: string) {
  await ensureCatalog();
  const rows = await db.select({ productId: favorite.productId }).from(favorite).where(eq(favorite.userId, userId)).orderBy(desc(favorite.createdAt));
  return cleanFavorites(rows.map((r) => r.productId));
}

export async function addFavorite(userId: string, productId: string) {
  await ensureCatalog();
  if (!productById(productId)) return null;
  const now = await getFavorites(userId);
  if (!now.includes(productId) && now.length >= MAX_FAVORITES) return now;
  await db.insert(favorite).values({ userId, productId }).onConflictDoNothing();
  return getFavorites(userId);
}

export async function removeFavorite(userId: string, productId: string) {
  await db.delete(favorite).where(and(eq(favorite.userId, userId), eq(favorite.productId, productId)));
  return getFavorites(userId);
}

// Sign-in merge of the browser's guest favorites. New ones get newer created_at so they list first, in guest order.
export async function mergeFavoriteList(userId: string, guest: unknown) {
  const current = await getFavorites(userId);
  const merged = mergeFavorites(current, cleanFavorites(guest));
  const fresh = merged.filter((id) => !current.includes(id));
  const now = Date.now();
  if (fresh.length) await db.insert(favorite).values(fresh.map((productId, i) => ({ userId, productId, createdAt: new Date(now - i)}))).onConflictDoNothing();
  return getFavorites(userId);
}
