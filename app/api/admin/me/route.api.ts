import { isMasterRole, permsOf } from "@/lib/admin-perms";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// { admin, master, perms }: the admin shell hides sections without permission (the API checks them again on every call).
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  return "error" in r ? json({ admin: false }) : json({ admin: true, master: isMasterRole(r.user.role), perms: permsOf(r.user) });
}
