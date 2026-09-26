import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { loginEvent } from "@/lib/server/db/schema";
import { json, requireUser, unauthorized } from "@/lib/server/session";
import { LOGIN_HISTORY_DAYS, maskIp } from "@/lib/profile";

export const dynamic = "force-dynamic";

// Customer login history: own sign-ins from the last 90 days, IP masked, newest first.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const since = new Date(Date.now() - LOGIN_HISTORY_DAYS * 86400_000);
  const rows = await db.select({ method: loginEvent.method, ipAddress: loginEvent.ipAddress, userAgent: loginEvent.userAgent, createdAt: loginEvent.createdAt })
    .from(loginEvent).where(and(eq(loginEvent.userId, u.id), gte(loginEvent.createdAt, since))).orderBy(desc(loginEvent.createdAt)).limit(200);
  return json({ logins: rows.map((r) => ({ method: r.method, ip: maskIp(r.ipAddress), userAgent: r.userAgent, createdAt: r.createdAt.toISOString() })) });
}
