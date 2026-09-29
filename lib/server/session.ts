import { eq } from "drizzle-orm";
import { hasAdminAccess, hasPerm, isMasterRole, PERM_ERRORS, type AdminPerm } from "@/lib/admin-perms";
import { auth } from "./auth";
import { db, dbReady } from "./db";
import { user } from "./db/schema";

export async function requireUser(req: Request) {
  await dbReady();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return null;
  const [row] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  return row ?? null;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const unauthorized = () => json({ error: "Not signed in" }, 401);
export const sampleOrdersAllowed = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_SAMPLE_ORDERS === "1";

// Admin API guard: 401 when signed out, 403 when signed in without admin access.
// T2: need = the section this call belongs to (403 "No access" without it) or "master" (master admin only).
// The role + sections are read from the database on every call, so a change takes effect at once.
export async function requireAdmin(req: Request, need?: AdminPerm | "master") {
  const u = await requireUser(req);
  if (!u) return { error: unauthorized() } as const;
  if (!hasAdminAccess(u)) return { error: json({ error: "Admin access only" }, 403) } as const;
  if (need === "master" && !isMasterRole(u.role)) return { error: json({ error: PERM_ERRORS.masterOnly }, 403) } as const;
  if (need && need !== "master" && !hasPerm(u, need)) return { error: json({ error: PERM_ERRORS.noAccess }, 403) } as const;
  return { user: u } as const;
}
