import { MARKET_ERRORS, OFFER_WRITE_LIMIT, priceOk, SELLER_KEY_LIMIT } from "@/lib/marketplace";
import { createOffer, readBody, requireSeller, sellerOffers, updateOffer } from "@/lib/server/marketplace";
import { hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// My offers: price, lowest other price, stock, status (Sold out when 0 keys).
export async function GET(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  return json({ offers: await sellerOffers(r.user.id) });
}

// New offer { productId, priceUsdCents, keys? } → { offer, keys: { added, report } | null }. Keys count as an upload (30 / 10 min).
export async function POST(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  const b = await readBody(req); if (!b) return json({ error: "Bad request" }, 400);
  const productId = typeof b.productId === "string" ? b.productId : ""; const keys = typeof b.keys === "string" ? b.keys : "";
  if (!productId) return json({ error: MARKET_ERRORS.product }, 400);
  if (!priceOk(b.priceUsdCents)) return json({ error: MARKET_ERRORS.price }, 400);
  if (!(await hitLimit(`seller-write:${r.user.id}`, OFFER_WRITE_LIMIT.max, OFFER_WRITE_LIMIT.windowMs))) return json({ error: MARKET_ERRORS.writeLimit }, 429);
  if (keys.trim() && !(await hitLimit(`seller-keys:${r.user.id}`, SELLER_KEY_LIMIT.max, SELLER_KEY_LIMIT.windowMs))) return json({ error: MARKET_ERRORS.limit }, 429);
  const res = await createOffer(r.user.id, productId, b.priceUsdCents, keys);
  return res.ok ? json({ offer: res.offer, keys: res.keys }, 201) : json({ error: res.error }, res.status);
}

// Edit { id, priceUsdCents?, active? } → { offer }
export async function PATCH(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  const b = await readBody(req, 4_000); if (!b || typeof b.id !== "string") return json({ error: "Bad request" }, 400);
  if (b.priceUsdCents !== undefined && !priceOk(b.priceUsdCents)) return json({ error: MARKET_ERRORS.price }, 400);
  if (b.active !== undefined && typeof b.active !== "boolean") return json({ error: "Bad request" }, 400);
  if (b.priceUsdCents === undefined && b.active === undefined) return json({ error: "Nothing to change" }, 400);
  if (!(await hitLimit(`seller-write:${r.user.id}`, OFFER_WRITE_LIMIT.max, OFFER_WRITE_LIMIT.windowMs))) return json({ error: MARKET_ERRORS.writeLimit }, 429);
  const res = await updateOffer(r.user.id, b.id, { priceUsdCents: b.priceUsdCents as number | undefined, active: b.active as boolean | undefined });
  return res.ok ? json({ offer: res.offer }) : json({ error: res.error }, res.status);
}
