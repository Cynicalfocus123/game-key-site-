import { hitLimit } from "@/lib/server/rate-limit";
import { rateSeller } from "@/lib/server/orders";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// POST { orderId, seller, stars 1–5, comment? } → { rating }. One per customer, order and seller; sending again edits it. 30 / 10 min per user.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!(await hitLimit(`rating:${u.id}`, 30, 600_000))) return json({ error: "Too many ratings. Try again in a few minutes." }, 429);
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const r = await rateSeller(u.id, b ?? {});
  return r.ok ? json({ rating: r.rating }) : json({ error: r.error }, r.status);
}
