import { adminUserDetail } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const id = new URL(req.url).searchParams.get("id");
  const detail = id ? await adminUserDetail(db, id) : null;
  return detail ? json(detail) : json({ error: "User not found" }, 404);
}
