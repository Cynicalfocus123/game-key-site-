import { ADJUST_ERRORS, ADJUST_LIMIT, parseAdjustment } from "@/lib/wallet";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";
import { adjustBalance, adminWallet } from "@/lib/server/wallet";
import { mailAdjustment } from "@/lib/server/wallet-mail";

export const dynamic = "force-dynamic";

// POST { userId, direction: credit | debit, bucket: wallet | gift, amountMinor (THB satang), reason } → { wallet }.
// Admin only; 30 adjustments / 10 min per admin (app_rate_limit key adjust:{adminId}). Writes a new ledger row, never edits one.
export async function POST(req: Request) {
  const r = await requireAdmin(req, "wallet");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const a = parseAdjustment(b);
  if (!a) return json({ error: "userId and direction required" }, 400);
  if (!(await hitLimit(`adjust:${r.user.id}`, ADJUST_LIMIT.max, ADJUST_LIMIT.windowMs))) return json({ error: ADJUST_ERRORS.limit }, 429);
  const res = await adjustBalance(r.user.id, a);
  if (!res.ok) return json({ error: res.error }, res.status);
  await mailAdjustment(a); // reason is shown to the customer (S8 decision)
  return json({ wallet: await adminWallet(a.userId) });
}
