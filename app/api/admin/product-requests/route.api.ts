import { MARKET_ERRORS, reasonOk, REQUEST_ACTIONS, REQUEST_ADMIN_LIMIT, REQUEST_TABS, type RequestAction, type RequestStatus } from "@/lib/marketplace";
import { adminRequest, adminRequests, decideRequest, readBody } from "@/lib/server/marketplace";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Seller marketplace step 3 (section "products"): GET ?tab=waiting|added|rejected → { counts, rows }; GET ?id= → { request } (editor pre-fill).
export async function GET(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  const p = new URL(req.url).searchParams; const id = p.get("id");
  if (id) { const one = await adminRequest(id); return one ? json({ request: one }) : json({ error: MARKET_ERRORS.requestNotFound }, 404); }
  const tab = REQUEST_TABS.includes(p.get("tab") as RequestStatus) ? p.get("tab") as RequestStatus : "waiting";
  return json(await adminRequests(tab));
}

// PATCH { id, action: add | link, productId } or { id, action: reject, reason (3–300) } → { closed: ["PR-1042", …] }. History + seller emails.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  const b = await readBody(req, 8_000);
  const action = b?.action as RequestAction;
  if (typeof b?.id !== "string" || !REQUEST_ACTIONS.includes(action)) return json({ error: "id and action required" }, 400);
  const reason = typeof b.reason === "string" ? b.reason : "";
  if (action === "reject" && !reasonOk(reason)) return json({ error: MARKET_ERRORS.reason }, 400);
  if (!(await hitLimit(`product-requests:${r.user.id}`, REQUEST_ADMIN_LIMIT.max, REQUEST_ADMIN_LIMIT.windowMs))) return json({ error: "Too many changes. Wait a minute." }, 429);
  const res = await decideRequest(r.user.id, b.id, action, { productId: typeof b.productId === "string" ? b.productId : undefined, reason });
  return res.ok ? json({ closed: res.closed }) : json({ error: res.error }, res.status);
}
