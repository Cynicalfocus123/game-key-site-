import { parsePerms, PERM_ERRORS } from "@/lib/admin-perms";
import { USER_ADMIN_LIMIT, USER_ERRORS } from "@/lib/users";
import { hitLimit } from "@/lib/server/rate-limit";
import { adminList, setAdminPerms } from "@/lib/server/users";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// T2, master admin only: every admin + master with sections and the latest permission / role changes.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "master");
  if ("error" in r) return r.error;
  return json(await adminList());
}

// PATCH { id, perms: AdminPerm[] } → sections of one admin (audited: before → after). Same write limit as user changes.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "master");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const perms = parsePerms(b?.perms);
  if (typeof b?.id !== "string" || !perms) return json({ error: PERM_ERRORS.bad }, 400);
  if (!(await hitLimit(`users:${r.user.id}`, USER_ADMIN_LIMIT.max, USER_ADMIN_LIMIT.windowMs))) return json({ error: USER_ERRORS.limit }, 429);
  const res = await setAdminPerms(r.user.id, b.id, perms);
  return res.ok ? json({ ok: true, perms: res.perms }) : json({ error: res.error }, res.status);
}
