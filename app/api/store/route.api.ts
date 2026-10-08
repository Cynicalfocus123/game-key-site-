import { MARKET_ERRORS, storeSlugOk } from "@/lib/marketplace";
import { publicStore } from "@/lib/server/marketplace";
import { clientIp, hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Public store page data (marketplace step 4): GET ?s=<slug> → { store }. Unknown, held or closed seller → 404 "Store not found."
export async function GET(req: Request) {
  if (!(await hitLimit(`store:${clientIp(req)}`, 120, 60_000))) return json({ error: "Too many requests. Try again in a minute." }, 429);
  const slug = new URL(req.url).searchParams.get("s") ?? "";
  const store = storeSlugOk(slug) ? await publicStore(slug) : null;
  return store ? json({ store }) : json({ error: MARKET_ERRORS.storeNotFound }, 404);
}
