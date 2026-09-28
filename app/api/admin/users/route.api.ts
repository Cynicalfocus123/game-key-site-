import { USER_ADMIN_LIMIT, USER_ERRORS, type Role } from "@/lib/users";
import { hitLimit } from "@/lib/server/rate-limit";
import { addUserByAdmin } from "@/lib/server/users";
import { adminUsers } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const p = new URL(req.url).searchParams;
  const get = (k: string) => p.get(k) || undefined;
  return json(await adminUsers(db, { q: get("q"), method: get("method"), verified: get("verified"), role: get("role"), sort: get("sort"), page: Number(p.get("page")) || 1 }));
}

// POST { name, email, role } → { id }. Admin "Add user" (S7): no password; a set-password email goes to the address.
// 60 user writes / 10 min per admin (app_rate_limit key users:{adminId}).
export async function POST(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (!b) return json({ error: "Invalid request" }, 400);
  if (!(await hitLimit(`users:${r.user.id}`, USER_ADMIN_LIMIT.max, USER_ADMIN_LIMIT.windowMs))) return json({ error: USER_ERRORS.limit }, 429);
  const res = await addUserByAdmin(r.user.id, { name: String(b.name ?? ""), email: String(b.email ?? ""), role: b.role as Role }, new URL(req.url).origin);
  return res.ok ? json({ id: res.id }) : json({ error: res.error }, res.status);
}
