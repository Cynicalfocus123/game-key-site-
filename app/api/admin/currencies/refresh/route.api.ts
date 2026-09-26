import { refreshRates } from "@/lib/server/rates";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Admin "Update rates now": fetch immediately, wait for the result.
export async function POST(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const res = await refreshRates(true);
  return res.ok ? json(res) : json({ error: res.error }, 502);
}
