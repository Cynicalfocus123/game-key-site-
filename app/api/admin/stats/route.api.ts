import { hasPerm } from "@/lib/admin-perms";
import { adminStats } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// Overview: every admin. T2: newest users only with Users, balance owed only with Wallet (null otherwise).
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const s = await adminStats(db);
  return json({ ...s, recent: hasPerm(r.user, "users") ? s.recent : null, owed: hasPerm(r.user, "wallet") ? s.owed : null });
}
