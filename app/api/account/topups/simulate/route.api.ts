import { TOPUP_ERRORS } from "@/lib/topup";
import { json, requireUser, unauthorized } from "@/lib/server/session";
import { simulateTopUp } from "@/lib/server/topups";

export const dynamic = "force-dynamic";

// POST { id, outcome: paid | failed | resend } → { topUp, result }. Dev adapter only (PAYMENT_PROVIDER=dev, never production):
// builds a signed provider event and runs it through the same webhook handler a real provider uses.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const outcome = b?.outcome;
  if (typeof b?.id !== "string" || (outcome !== "paid" && outcome !== "failed" && outcome !== "resend")) return json({ error: TOPUP_ERRORS.notFound }, 400);
  const r = await simulateTopUp(u.id, b.id, outcome);
  return r.ok ? json({ topUp: r.topUp, result: r.result }) : json({ error: r.error }, r.status);
}
