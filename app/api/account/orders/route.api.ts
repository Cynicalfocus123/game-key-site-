import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { orderItems, orders } from "@/lib/server/db/schema";
import { json, requireUser, sampleOrdersAllowed, unauthorized } from "@/lib/server/session";
import { chargeCurrency, convertMinor, crossRate } from "@/lib/currency/money";
import { publicCurrencies } from "@/lib/server/rates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const list = await db.select().from(orders).where(eq(orders.userId, u.id)).orderBy(desc(orders.createdAt));
  const items = list.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, list.map((o) => o.id))) : [];
  return json({ orders: list.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) })) });
}

const samples = [
  { name: "Elden Ring", kind: "game_key", platform: "Steam", region: "Global", thb: 99000 },
  { name: "Cyberpunk 2077", kind: "game_key", platform: "Steam", region: "Global", thb: 62900 },
  { name: "Samsung 990 PRO 2TB NVMe SSD", kind: "hardware", platform: null, region: null, thb: 569000 },
  { name: "Xbox Game Pass Ultimate 1 Month", kind: "game_key", platform: "Xbox", region: "Global", thb: 55900 },
];

// Development only: creates a sample order so order history can be tested before checkout exists.
export async function POST(req: Request) {
  if (!sampleOrdersAllowed()) return json({ error: "Sample orders disabled" }, 403);
  const u = await requireUser(req);
  if (!u) return unauthorized();
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
  await db.insert(orders).values({ id, number, userId: u.id, status: "completed", currency: charged.code, totalCents, baseTotalMinor, fxRate: crossRate(rates.base, charged), ratesAt: rates.updatedAt ? new Date(rates.updatedAt) : null, isSample: true });
  await db.insert(orderItems).values(lines.map(({ thb: _thb, ...i }) => ({ ...i, id: crypto.randomUUID(), orderId: id, quantity: 1 })));
  return json({ ok: true, number });
}
