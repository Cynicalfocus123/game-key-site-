import { MARKET_ERRORS, parseRequest, REQUEST_LIMIT } from "@/lib/marketplace";
import { createRequest, myRequests, readBody, requireSeller } from "@/lib/server/marketplace";
import { hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// My product requests (newest first).
export async function GET(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  return json({ requests: await myRequests(r.user.id) });
}

// { name, platform, region, edition?, link?, note? } → { request } | 400 { errors } | 409 in catalog { productId } / 10 open.
export async function POST(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  const p = parseRequest(await readBody(req, 8_000));
  if (!p.ok) return json({ error: "Check the form.", errors: p.errors }, 400);
  if (!(await hitLimit(`product-request:${r.user.id}`, REQUEST_LIMIT.max, REQUEST_LIMIT.windowMs))) return json({ error: MARKET_ERRORS.requestLimit }, 429);
  const res = await createRequest(r.user.id, p.input);
  return res.ok ? json({ request: res.request }, 201) : json({ error: res.error, productId: res.productId }, res.status);
}
