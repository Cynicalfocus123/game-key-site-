import { isRole, USER_ADMIN_LIMIT, USER_ERRORS } from "@/lib/users";
import { hitLimit } from "@/lib/server/rate-limit";
import { setUserRole } from "@/lib/server/users";
import { adminUserDetail } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { json, requireAdmin } from "@/lib/server/session";
import { closeAccount, reopenAccount } from "@/lib/server/account-close";
import { CLOSE_ERRORS } from "@/lib/account-close";
import { reasonOk } from "@/lib/sellers";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const r = await requireAdmin(req, "users");
  if ("error" in r) return r.error;
  const id = new URL(req.url).searchParams.get("id");
  const detail = id ? await adminUserDetail(db, id) : null;
  return detail ? json(detail) : json({ error: "User not found" }, 404);
}

// T3: PATCH { id, close: reason } → close the account (never admins); PATCH { id, reopen: note } → reopen. Audited.
// PATCH { id, role } → role change + audit row (S7). Not on yourself; never removes the last admin / master. T2: admin roles = master only.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "users");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (typeof b?.id === "string" && (b.close !== undefined || b.reopen !== undefined)) {
    const text = String(b.close ?? b.reopen ?? "").trim();
    if (!reasonOk(text)) return json({ error: CLOSE_ERRORS.reason }, 400);
    if (b.id === r.user.id) return json({ error: USER_ERRORS.self }, 400);
    if (!(await hitLimit(`users:${r.user.id}`, USER_ADMIN_LIMIT.max, USER_ADMIN_LIMIT.windowMs))) return json({ error: USER_ERRORS.limit }, 429);
    const res = b.close !== undefined ? await closeAccount(b.id, r.user.id, text) : await reopenAccount(r.user.id, b.id, text);
    return res.ok ? json({ ok: true }) : json({ error: res.error }, res.status);
  }
  if (typeof b?.id !== "string" || !isRole(b.role)) return json({ error: USER_ERRORS.role }, 400);
  if (!(await hitLimit(`users:${r.user.id}`, USER_ADMIN_LIMIT.max, USER_ADMIN_LIMIT.windowMs))) return json({ error: USER_ERRORS.limit }, 429);
  const res = await setUserRole(r.user, b.id, b.role);
  return res.ok ? json({ ok: true }) : json({ error: res.error }, res.status);
}
