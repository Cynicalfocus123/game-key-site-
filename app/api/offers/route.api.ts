import { offerQuotes, publicOffers } from "@/lib/server/marketplace";
import { clientIp, hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const LIMIT = { max: 240, windowMs: 60_000 }; // per IP (product pages + cart loads)

// Public (marketplace step 4). ?product=<id> → { offers } for the product page ([] = no seller sells it);
// ?quote=<offerId>,<offerId> → { quotes } (cart: today's price + keys left of each seller line; missing = gone).
export async function GET(req: Request) {
  if (!(await hitLimit(`offers:${clientIp(req)}`, LIMIT.max, LIMIT.windowMs))) return json({ error: "Too many requests. Try again in a minute." }, 429);
  const q = new URL(req.url).searchParams;
  const product = q.get("product"); const quote = q.get("quote");
  if (product && product.length <= 120) return json({ offers: await publicOffers(product) });
  if (quote !== null && quote.length <= 50 * 40) return json({ quotes: await offerQuotes(quote.split(",").filter(Boolean)) });
  return json({ error: "product or quote required" }, 400);
}
