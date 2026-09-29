import { isTopUpStatus, TOPUP_ERRORS } from "@/lib/topup";
import { USER_ADMIN_LIMIT } from "@/lib/users";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";
import { adminCloseTopUp, adminTopUp, adminTopUps } from "@/lib/server/topups";

export const dynamic = "force-dynamic";

// GET ?q=&status=&provider=&from=&to=&page= → { data } list (50 per page). GET ?id= (id or TU- number) → { topUp } with the webhook event log.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "topups");
  if ("error" in r) return r.error;
  const p = new URL(req.url).searchParams;
  const id = p.get("id");
  if (id) { const t = await adminTopUp(id); return t ? json({ topUp: t }) : json({ error: TOPUP_ERRORS.notFound }, 404); }
  const status = p.get("status") ?? "";
  return json({ data: await adminTopUps({ q: p.get("q") ?? "", status: isTopUpStatus(status) ? status : "", provider: p.get("provider") ?? "", from: p.get("from") ?? "", to: p.get("to") ?? "", page: Number(p.get("page")) || 1 }) });
}

// PATCH { id, action: fail | cancel, reason } → { topUp }. Pending only; reason required; audited (user_audit). Admins never credit here.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "topups");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (typeof b?.id !== "string" || (b.action !== "fail" && b.action !== "cancel")) return json({ error: TOPUP_ERRORS.notFound }, 400);
  if (!(await hitLimit(`topup-admin:${r.user.id}`, USER_ADMIN_LIMIT.max, USER_ADMIN_LIMIT.windowMs))) return json({ error: "Too many changes. Wait a few minutes." }, 429);
  const res = await adminCloseTopUp(r.user.id, b.id, b.action, b.reason);
  return res.ok ? json({ topUp: res.topUp }) : json({ error: res.error }, res.status);
}
