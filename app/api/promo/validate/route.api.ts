import { cleanCart } from "@/lib/catalog";
import { cleanPromoCode, PROMO_CODE_RE, PROMO_ERRORS, promoDiscount, promoStatus, toPublic, VALIDATE_LIMIT } from "@/lib/promo";
import { findPromo } from "@/lib/server/promo";
import { clientIp, hitLimit, isLimited } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";
import { dbReady } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Public. POST { code, items? } → { promo (public rules), result? (server discount for items) } or { error } with the reason.
// Unknown codes count against 10 per minute per IP (stops guessing); re-checking a valid applied code is free.
// Checkout will call promoDiscount again on the server; the client value is display only.
export async function POST(req: Request) {
  await dbReady();
  const key = `promo:ip:${clientIp(req)}`;
  if (await isLimited(key, VALIDATE_LIMIT.max, VALIDATE_LIMIT.windowMs)) return json({ error: PROMO_ERRORS.limit }, 429);
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const code = typeof b?.code === "string" ? cleanPromoCode(b.code) : "";
  const promo = PROMO_CODE_RE.test(code) ? await findPromo(code) : null;
  if (!promo) { await hitLimit(key, VALIDATE_LIMIT.max, VALIDATE_LIMIT.windowMs); return json({ error: PROMO_ERRORS.not_found }, 404); }
  const status = promoStatus(promo);
  if (status !== "active") return json({ error: PROMO_ERRORS[status] }, 400);
  const pub = toPublic(promo);
  return json({ promo: pub, ...(Array.isArray(b?.items) ? { result: promoDiscount(pub, cleanCart(b.items)) } : {}) });
}
