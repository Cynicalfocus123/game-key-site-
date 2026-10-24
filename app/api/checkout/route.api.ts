import { CHECKOUT_ERRORS, CHECKOUT_LIMIT, parsePlaceOrder } from "@/lib/checkout";
import { orderHold, placeOrder } from "@/lib/server/checkout";
import { readBody } from "@/lib/server/marketplace";
import { clientIp, hitLimit } from "@/lib/server/rate-limit";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Checkout (seller marketplace step 5). POST { lines: [{ productId, offerId?, qty }], method, promoCode?, idempotencyKey, billing? }
// → { orderId, paid, payment } | 409 { error, problems } ("Not enough stock": nothing held, nothing charged). Prices + stock are re-read on the server.
// Wallet: paid in the same transaction. Card / PayPal …: pending order with keys held 30 minutes, then the provider webhook.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const okUser = await hitLimit(`checkout:user:${u.id}`, CHECKOUT_LIMIT.max, CHECKOUT_LIMIT.windowMs);
  const okIp = await hitLimit(`checkout:ip:${clientIp(req)}`, CHECKOUT_LIMIT.max * 3, CHECKOUT_LIMIT.windowMs);
  if (!okUser || !okIp) return json({ error: CHECKOUT_ERRORS.limit }, 429);
  const input = parsePlaceOrder(await readBody(req, 32_000));
  if (!input) return json({ error: CHECKOUT_ERRORS.bad }, 400);
  const ip = clientIp(req);
  const r = await placeOrder(u, input, new URL(req.url).origin, { ip: ip === "unknown" ? null : ip, userAgent: req.headers.get("user-agent") });
  return r.ok ? json({ orderId: r.orderId, paid: r.paid, payment: r.payment }) : json({ error: r.error, ...(r.problems ? { problems: r.problems } : {}) }, r.status);
}

// GET ?id= → { status, holdUntil } (processing screen: "Your keys are held for you: mm:ss left").
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  const h = id ? await orderHold(u.id, id.slice(0, 80)) : null;
  return h ? json(h) : json({ error: CHECKOUT_ERRORS.notFound }, 404);
}
