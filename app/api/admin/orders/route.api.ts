import { ADMIN_ORDER_ERRORS, isOrderTab, ORDER_ADMIN_LIMIT, parseOrderAction } from "@/lib/admin-orders";
import { adminOrder, adminOrders, orderAction } from "@/lib/server/admin-orders";
import { readBody } from "@/lib/server/marketplace";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Admin Orders (section "orders", wireframe approved 2026-10-24). Every order (sample orders left out), everything on it.
// GET ?q=&tab=&method=&seller=&from=&to=&page=&since= → { data } (50 per page, tab counts, today tiles, newSince = orders made after `since`).
// GET ?id= (id or CC- number) → { order } with lines, keys (last 4), buyer, IP + browser, billing, timeline.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "orders");
  if ("error" in r) return r.error;
  const p = new URL(req.url).searchParams;
  const id = p.get("id");
  if (id) { const o = await adminOrder(id); return o ? json({ order: o }) : json({ error: ADMIN_ORDER_ERRORS.notFound }, 404); }
  const tab = p.get("tab");
  return json({ data: await adminOrders({ q: p.get("q") ?? "", tab: isOrderTab(tab) ? tab : "all", method: p.get("method") ?? "", seller: p.get("seller") ?? "", from: p.get("from") ?? "", to: p.get("to") ?? "",
    page: Number(p.get("page")) || 1, since: p.get("since") ?? undefined }) });
}

// POST { id, action: show_key, keyId } → { order, code } (logged in the order timeline) | { id, action: resend | cancel } | { id, action: note, text }.
export async function POST(req: Request) {
  const r = await requireAdmin(req, "orders");
  if ("error" in r) return r.error;
  const b = await readBody(req, 8_000); const a = parseOrderAction(b);
  if (!b || typeof b.id !== "string" || !a) return json({ error: ADMIN_ORDER_ERRORS.bad }, 400);
  if (!(await hitLimit(`orders-admin:${r.user.id}`, ORDER_ADMIN_LIMIT.max, ORDER_ADMIN_LIMIT.windowMs))) return json({ error: ADMIN_ORDER_ERRORS.limit }, 429);
  const res = await orderAction(r.user.id, b.id, a);
  return res.ok ? json({ order: res.order, ...(res.code ? { code: res.code } : {}) }) : json({ error: res.error }, res.status);
}
