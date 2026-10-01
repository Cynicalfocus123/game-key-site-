import { parseNewTopUp, TOPUP_ERRORS, TOPUP_LIMIT } from "@/lib/topup";
import { clientIp, hitLimit } from "@/lib/server/rate-limit";
import { json, requireUser, unauthorized } from "@/lib/server/session";
import { bankInfo, createTopUp, dailyLeftThb, getTopUp, listTopUps } from "@/lib/server/topups";

export const dynamic = "force-dynamic";

// GET → { topUps, dailyLeftMinor, bank } (own, newest first, max 50; daily cap left in THB satang; bank = our bank details + the customer's
// own transfer reference, null = not set up yet). GET ?id= (id, TU- or BT- number) → { topUp }.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ topUps: await listTopUps(u.id), dailyLeftMinor: await dailyLeftThb(u.id), bank: await bankInfo(u.id) });
  const t = await getTopUp(u.id, id);
  return t ? json({ topUp: t }) : json({ error: TOPUP_ERRORS.notFound }, 404);
}

// POST { amountMinor, currency, idempotencyKey, method?: card | bank } → { topUp, payment } (T1 + redesign). Rate limited per user (10 / 10 min) and IP.
// method bank = "I have sent the transfer": a pending BT- top-up (payment null); an admin confirms when the money arrives.
// Only creates a pending row; the wallet is credited later by the provider webhook (/api/payments/webhook), never here.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!u.emailVerified) return json({ error: "Verify your email first." }, 403);
  const okUser = await hitLimit(`topup:user:${u.id}`, TOPUP_LIMIT.max, TOPUP_LIMIT.windowMs);
  const okIp = await hitLimit(`topup:ip:${clientIp(req)}`, TOPUP_LIMIT.max * 3, TOPUP_LIMIT.windowMs);
  if (!okUser || !okIp) return json({ error: TOPUP_ERRORS.limit }, 429);
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const input = parseNewTopUp(b);
  if (!input) return json({ error: TOPUP_ERRORS.amount }, 400);
  const r = await createTopUp(u, input, new URL(req.url).origin);
  return r.ok ? json({ topUp: r.topUp, payment: r.payment }) : json({ error: r.error }, r.status);
}
