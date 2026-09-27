import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "./db";
import { rateLimit } from "./db/schema";

// Fixed-window counters in the Better Auth rate_limit table. Keys are prefixed (giftcard:, promo:) so they never clash with Better Auth.
// hitLimit counts one request and returns true while the count is within max.
export async function hitLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const reset = sql`${now} - ${rateLimit.lastRequest} >= ${windowMs}`;
  const [r] = await db.insert(rateLimit).values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({ target: rateLimit.key, set: {
      count: sql`case when ${reset} then 1 else ${rateLimit.count} + 1 end`,
      lastRequest: sql`case when ${reset} then ${now} else ${rateLimit.lastRequest} end`,
    } }).returning({ count: rateLimit.count });
  return r.count <= max;
}
// true when the key already used up its window (does not count a request).
export async function isLimited(key: string, max: number, windowMs: number) {
  const [r] = await db.select({ count: rateLimit.count }).from(rateLimit).where(and(eq(rateLimit.key, key), gt(rateLimit.lastRequest, Date.now() - windowMs))).limit(1);
  return (r?.count ?? 0) >= max;
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
