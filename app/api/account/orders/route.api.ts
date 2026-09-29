import { db } from "@/lib/server/db";
import { orderItems, orders } from "@/lib/server/db/schema";
import { json, requireUser, sampleOrdersAllowed, unauthorized } from "@/lib/server/session";
import { chargeCurrency, convertMinor, crossRate } from "@/lib/currency/money";
import { publicCurrencies } from "@/lib/server/rates";
import { ensureCatalog } from "@/lib/server/catalog";
import { getOrder, listOrders, mailOrder, productIdFor, setTaxInfo } from "@/lib/server/orders";

export const dynamic = "force-dynamic";

// GET → { orders }; GET ?id= (id or CC- number) → { order } with the customer's seller ratings (order page + receipt).
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (id) { const order = await getOrder(u.id, id.slice(0, 80)); return order ? json({ order }) : json({ error: "Order not found." }, 404); }
  return json({ orders: await listOrders(u.id) });
}

// PATCH { id, taxInfo: { name, taxId, address } | null } → optional tax details for the receipt (tax invoice). null removes them.
export async function PATCH(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (!b || typeof b.id !== "string" || !("taxInfo" in b)) return json({ error: "id and taxInfo required" }, 400);
  const r = await setTaxInfo(u.id, b.id, b.taxInfo);
  return r.ok ? json({ taxInfo: r.taxInfo }) : json({ error: r.error }, r.status);
}

const samples = [
  { name: "Elden Ring", kind: "game_key", platform: "Steam", region: "Global", thb: 99000 },
  { name: "Cyberpunk 2077", kind: "game_key", platform: "Steam", region: "Global", thb: 62900 },
  { name: "Samsung 990 PRO 2TB NVMe SSD", kind: "hardware", platform: null, region: null, thb: 569000 },
  { name: "Xbox Game Pass Ultimate 1 Month", kind: "game_key", platform: "Xbox", region: "Global", thb: 55900 },
];

// Development only: creates a sample order so order history can be tested before checkout exists. Sends the "Order confirmed" email like a real paid order.
export async function POST(req: Request) {
  if (!sampleOrdersAllowed()) return json({ error: "Sample orders disabled" }, 403);
  const u = await requireUser(req);
  if (!u) return unauthorized();
  await ensureCatalog();
  const picks = samples.filter(() => Math.random() > 0.4);
  const chosen = picks.length ? picks : [samples[0]];
  // Prices are THB; charge in the account's currency when chargeable, else USD. Stores amount, currency and rate used.
  const rates = await publicCurrencies();
  const charged = chargeCurrency(rates.currencies.find((c) => c.code === u.currency), rates.currencies);
  if (!charged) return json({ error: "No chargeable currency" }, 500);
  const lines = chosen.map(({ thb, ...i }) => ({ ...i, unitPriceCents: convertMinor(thb, rates.base, charged), thb }));
  const id = crypto.randomUUID();
  const number = `CC-${Date.now().toString().slice(-8)}`;
  const totalCents = lines.reduce((s, i) => s + i.unitPriceCents, 0);
  const baseTotalMinor = lines.reduce((s, i) => s + i.thb, 0);
  const now = new Date();
  await db.insert(orders).values({ id, number, userId: u.id, status: "completed", currency: charged.code, totalCents, baseTotalMinor, fxRate: crossRate(rates.base, charged), ratesAt: rates.updatedAt ? new Date(rates.updatedAt) : null, isSample: true,
    paymentMethod: "card", paymentLast4: "4242", paidAt: now, subtotalMinor: totalCents, createdAt: now });
  await db.insert(orderItems).values(lines.map(({ thb: _thb, ...i }) => ({ ...i, id: crypto.randomUUID(), orderId: id, quantity: 1, productId: productIdFor(i.name) })));
  await mailOrder(id);
  return json({ ok: true, number, id });
}
