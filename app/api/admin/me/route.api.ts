import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  return "error" in r ? json({ admin: false }) : json({ admin: true });
}
