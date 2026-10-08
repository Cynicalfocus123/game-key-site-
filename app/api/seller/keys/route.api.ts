import { MARKET_ERRORS, SELLER_KEY_LIMIT } from "@/lib/marketplace";
import { addSellerKeys, checkSellerKeys, readBody, requireSeller } from "@/lib/server/marketplace";
import { hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// { productId, text, check: true } → { report } (nothing stored: format, duplicates, already in CoreCart, by line number)
// { offerId, text } → { result: { added, report } }. Codes never come back, only line numbers + counts. 30 calls / 10 min per seller.
export async function POST(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  const b = await readBody(req); if (!b || typeof b.text !== "string") return json({ error: "Bad request" }, 400);
  if (!(await hitLimit(`seller-keys:${r.user.id}`, SELLER_KEY_LIMIT.max, SELLER_KEY_LIMIT.windowMs))) return json({ error: MARKET_ERRORS.limit }, 429);
  if (b.check === true) {
    const res = await checkSellerKeys(typeof b.productId === "string" ? b.productId : "", b.text);
    return res.ok ? json({ report: res.report }) : json({ error: res.error }, res.status);
  }
  const res = await addSellerKeys(r.user.id, typeof b.offerId === "string" ? b.offerId : "", b.text);
  return res.ok ? json({ result: res.result }, res.result.added ? 201 : 200) : json({ error: res.error }, res.status);
}
