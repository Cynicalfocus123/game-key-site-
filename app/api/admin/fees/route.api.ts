import { isCountry } from "@/lib/profile";
import { FEE_ERRORS, FEE_WRITE_LIMIT, parseFeeSettings } from "@/lib/fees";
import { feeHistory, feeSettings, saveFeeSettings } from "@/lib/server/fees";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Fees & tax settings (admin section "fees"). GET → { settings, history }. PUT settings → saved + audited (unchanged = no audit row).
export async function GET(req: Request) {
  const r = await requireAdmin(req, "fees");
  if ("error" in r) return r.error;
  return json({ settings: await feeSettings(), history: await feeHistory() });
}

export async function PUT(req: Request) {
  const r = await requireAdmin(req, "fees");
  if ("error" in r) return r.error;
  if (!(await hitLimit(`fees:${r.user.id}`, FEE_WRITE_LIMIT.max, FEE_WRITE_LIMIT.windowMs))) return json({ error: FEE_ERRORS.limit }, 429);
  const p = parseFeeSettings(await req.json().catch(() => null), isCountry);
  if (typeof p === "string") return json({ error: p }, 400);
  await saveFeeSettings(r.user.id, p);
  return json({ settings: await feeSettings(), history: await feeHistory() });
}
