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
