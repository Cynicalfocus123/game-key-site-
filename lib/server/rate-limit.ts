import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "./db";
import { appRateLimit } from "./db/schema";

// Fixed-window counters in our own app_rate_limit table (not Better Auth rate_limit: Better Auth prunes that table every minute).
// Keys are prefixed (giftcard:, promo:, ticket:). hitLimit counts one request and returns true while the count is within max.
export async function hitLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const reset = sql`${now} - ${appRateLimit.windowStart} >= ${windowMs}`;
  const [r] = await db.insert(appRateLimit).values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({ target: appRateLimit.key, set: {
      count: sql`case when ${reset} then 1 else ${appRateLimit.count} + 1 end`,
      windowStart: sql`case when ${reset} then ${now} else ${appRateLimit.windowStart} end`,
    } }).returning({ count: appRateLimit.count });
  return r.count <= max;
}
// true when the key already used up its window (does not count a request).
export async function isLimited(key: string, max: number, windowMs: number) {
  const [r] = await db.select({ count: appRateLimit.count }).from(appRateLimit).where(and(eq(appRateLimit.key, key), gt(appRateLimit.windowStart, Date.now() - windowMs))).limit(1);
  return (r?.count ?? 0) >= max;
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
