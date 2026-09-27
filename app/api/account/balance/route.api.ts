import { REDEEM_ERRORS, REDEEM_LIMIT } from "@/lib/gift-cards";
import { getBalance, hitLimit, redeemGiftCard } from "@/lib/server/gift-cards";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// GET → { walletMinor, giftMinor, transactions } (THB satang, newest first).
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  return json(await getBalance(u.id));
}

// POST { code } → redeem a gift card. Rate limited per user (5 / 10 min) and per IP (20 / 10 min) to stop code guessing.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const okUser = await hitLimit(`giftcard:user:${u.id}`, REDEEM_LIMIT.max, REDEEM_LIMIT.windowMs);
  const okIp = await hitLimit(`giftcard:ip:${ip}`, REDEEM_LIMIT.max * 4, REDEEM_LIMIT.windowMs);
  if (!okUser || !okIp) return json({ error: REDEEM_ERRORS.limit }, 429);
  let code: unknown; try { code = (await req.json())?.code; } catch { /* bad body */ }
  if (typeof code !== "string" || code.length > 40) return json({ error: REDEEM_ERRORS.format }, 400);
  const r = await redeemGiftCard(u.id, code);
  if (!r.ok) return json({ error: r.error }, 400);
  return json({ amountMinor: r.amountMinor, balance: await getBalance(u.id) });
}
