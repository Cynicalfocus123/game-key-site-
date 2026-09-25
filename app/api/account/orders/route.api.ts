import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { orderItems, orders } from "@/lib/server/db/schema";
import { json, requireUser, sampleOrdersAllowed, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const list = await db.select().from(orders).where(eq(orders.userId, u.id)).orderBy(desc(orders.createdAt));
  const items = list.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, list.map((o) => o.id))) : [];
  return json({ orders: list.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) })) });
}

const samples = [
  { name: "Elden Ring", kind: "game_key", platform: "Steam", region: "Global", unitPriceCents: 2999 },
  { name: "Cyberpunk 2077", kind: "game_key", platform: "Steam", region: "Global", unitPriceCents: 1899 },
  { name: "Samsung 990 PRO 2TB NVMe SSD", kind: "hardware", platform: null, region: null, unitPriceCents: 16999 },
  { name: "Xbox Game Pass Ultimate 1 Month", kind: "game_key", platform: "Xbox", region: "Global", unitPriceCents: 1699 },
];

// Development only: creates a sample order so order history can be tested before checkout exists.
export async function POST(req: Request) {
  if (!sampleOrdersAllowed()) return json({ error: "Sample orders disabled" }, 403);
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const picks = samples.filter(() => Math.random() > 0.4);
  const chosen = picks.length ? picks : [samples[0]];
  const id = crypto.randomUUID();
  const number = `CC-${Date.now().toString().slice(-8)}`;
  const totalCents = chosen.reduce((s, i) => s + i.unitPriceCents, 0);
  await db.insert(orders).values({ id, number, userId: u.id, status: "completed", totalCents, isSample: true });
  await db.insert(orderItems).values(chosen.map((i) => ({ ...i, id: crypto.randomUUID(), orderId: id, quantity: 1 })));
  return json({ ok: true, number });
}
