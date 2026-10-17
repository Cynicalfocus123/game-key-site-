import { CHECKOUT_ERRORS, SIMULATE_LIMIT } from "@/lib/checkout";
import { simulateOrder } from "@/lib/server/checkout";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// POST { id, outcome: paid | failed } → { status, result }. Dev adapter only (PAYMENT_PROVIDER=dev, never production): builds a signed
// provider event for the order and runs it through the same webhook handler a real provider uses (processing screen "Simulate" buttons).
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!(await hitLimit(`checkout-sim:${u.id}`, SIMULATE_LIMIT.max, SIMULATE_LIMIT.windowMs))) return json({ error: CHECKOUT_ERRORS.limit }, 429);
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (typeof b?.id !== "string" || (b.outcome !== "paid" && b.outcome !== "failed")) return json({ error: CHECKOUT_ERRORS.bad }, 400);
  const r = await simulateOrder(u.id, b.id, b.outcome);
  return r.ok ? json({ status: r.status, result: r.result }) : json({ error: r.error }, r.status);
}
