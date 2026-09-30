import { and, desc, eq, inArray } from "drizzle-orm";
import { allProducts, coverFor } from "@/lib/catalog";
import { emailMoney, emailTime, type EmailItem } from "@/lib/emails";
import { canRate, chargeRows, checkRating, CORECART_SELLER, parseTaxInfo, paymentText, RATING_ERRORS, sellersOf, type Rating, type TaxInfo } from "@/lib/orders";
import type { BillingAddress } from "@/lib/address-formats";
import { ensureCatalog } from "./catalog";
import { db } from "./db";
import { orderItems, orders, sellerRating, user } from "./db/schema";
import { sendTemplate, siteUrl } from "./email";

// Customer orders: list, one order (order page + receipt), tax details, seller rating, order emails (email task, 2026-09-29).
type OrderRow = typeof orders.$inferSelect; type ItemRow = typeof orderItems.$inferSelect;
const iso = (d: Date | null) => d?.toISOString() ?? null;
const toOrder = (o: OrderRow, items: ItemRow[]) => ({
  id: o.id, number: o.number, status: o.status, currency: o.currency, totalCents: o.totalCents, baseCurrency: o.baseCurrency, baseTotalMinor: o.baseTotalMinor, fxRate: o.fxRate,
  ratesAt: iso(o.ratesAt), isSample: o.isSample, createdAt: o.createdAt.toISOString(), paymentMethod: o.paymentMethod, paymentLast4: o.paymentLast4, paidAt: iso(o.paidAt),
  subtotalMinor: o.subtotalMinor, discountMinor: o.discountMinor, promoCode: o.promoCode, walletMinor: o.walletMinor, taxInfo: (o.taxInfo as TaxInfo | null) ?? null,
  serviceFeeMinor: o.serviceFeeMinor, taxMinor: o.taxMinor, taxRateBp: o.taxRateBp, billing: (o.billing as BillingAddress | null) ?? null,
  items: items.map((i) => ({ id: i.id, name: i.name, kind: i.kind, platform: i.platform, region: i.region, quantity: i.quantity, unitPriceCents: i.unitPriceCents, productId: i.productId, seller: i.seller })),
});

export async function listOrders(userId: string) {
  const list = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  const items = list.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, list.map((o) => o.id))) : [];
  return list.map((o) => toOrder(o, items.filter((i) => i.orderId === o.id)));
}

// One order of this customer (id or order number), with the customer's seller ratings.
export async function getOrder(userId: string, idOrNumber: string) {
  const [o] = await db.select().from(orders).where(and(eq(orders.userId, userId), idOrNumber.startsWith("CC-") ? eq(orders.number, idOrNumber.toUpperCase()) : eq(orders.id, idOrNumber))).limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const ratings: Rating[] = (await db.select().from(sellerRating).where(and(eq(sellerRating.userId, userId), eq(sellerRating.orderId, o.id))))
    .map((r) => ({ seller: r.seller, stars: r.stars, comment: r.comment, updatedAt: r.updatedAt.toISOString() }));
  return { ...toOrder(o, items), ratings };
}

export async function setTaxInfo(userId: string, id: string, input: unknown) {
  const t = parseTaxInfo(input); if (!t.ok) return { ok: false as const, error: t.error, status: 400 };
  const r = await db.update(orders).set({ taxInfo: t.tax }).where(and(eq(orders.id, id), eq(orders.userId, userId))).returning({ id: orders.id });
  return r.length ? { ok: true as const, taxInfo: t.tax } : { ok: false as const, error: RATING_ERRORS.notYours, status: 404 };
}

// One rating per customer, order and seller; sending again edits it.
export async function rateSeller(userId: string, input: { orderId?: unknown; seller?: unknown; stars?: unknown; comment?: unknown }) {
  const c = checkRating(input); if (!c.ok) return { ok: false as const, error: c.error, status: 400 };
  if (typeof input.orderId !== "string") return { ok: false as const, error: RATING_ERRORS.notYours, status: 404 };
  const [o] = await db.select({ id: orders.id, status: orders.status }).from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, userId))).limit(1);
  if (!o) return { ok: false as const, error: RATING_ERRORS.notYours, status: 404 };
  if (!canRate(o.status)) return { ok: false as const, error: RATING_ERRORS.notRatable, status: 409 };
  const seller = typeof input.seller === "string" && input.seller ? input.seller : CORECART_SELLER;
  const items = await db.select({ seller: orderItems.seller }).from(orderItems).where(eq(orderItems.orderId, o.id));
  if (!sellersOf(items).includes(seller)) return { ok: false as const, error: RATING_ERRORS.seller, status: 400 };
  const now = new Date();
  const [r] = await db.insert(sellerRating).values({ id: crypto.randomUUID(), userId, orderId: o.id, seller, stars: c.stars, comment: c.comment })
    .onConflictDoUpdate({ target: [sellerRating.userId, sellerRating.orderId, sellerRating.seller], set: { stars: c.stars, comment: c.comment, updatedAt: now } }).returning();
  return { ok: true as const, rating: { seller: r.seller, stars: r.stars, comment: r.comment, updatedAt: r.updatedAt.toISOString() } as Rating };
}

// Email lines: absolute cover URL, "Digital product · Qty 1 · ฿159.00".
export async function emailItems(o: { currency: string; items: { id?: string; name: string; kind: string; quantity: number; unitPriceCents: number; seller?: string | null }[] }): Promise<EmailItem[]> {
  await ensureCatalog();
  const site = siteUrl();
  return o.items.map((i) => { const img = coverFor(i.name) ?? null;
    return { name: i.name, sub: `${i.kind === "game_key" ? "Digital product" : "Hardware"} · Qty ${i.quantity} · ${emailMoney(i.unitPriceCents * i.quantity, o.currency)}`, image: img ? (img.startsWith("/") ? `${site}${img}` : img) : null, seller: i.seller || CORECART_SELLER,
      ...(i.kind === "game_key" && i.id ? { keyUrl: `${site}/account/keys/get?item=${encodeURIComponent(i.id)}` } : {}) }; });
}

// "Order confirmed" (paid) or "Payment not completed" (pending / cancelled). Real checkout will call this after the payment webhook.
export async function mailOrder(orderId: string) {
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1); if (!o) return;
    const [u] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, o.userId)).limit(1);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const lines = await emailItems({ currency: o.currency, items });
    if (o.status === "pending" || o.status === "cancelled") await sendTemplate(u?.email, "paymentFailed", { name: u?.name ?? "", orderId: o.id, number: o.number, items: lines });
    else await sendTemplate(u?.email, "orderConfirmed", { name: u?.name ?? "", orderId: o.id, number: o.number, date: emailTime(o.paidAt ?? o.createdAt), total: emailMoney(o.totalCents, o.currency), payment: paymentText(o.paymentMethod, o.paymentLast4), items: lines,
      charges: chargeRows({ ...o, billing: o.billing as BillingAddress | null }, (m) => emailMoney(m, o.currency)) });
  } catch (e) { console.error("[CoreCart email] order", e); }
}

// Catalog id for a sample line (cover + link on the order page).
export const productIdFor = (name: string) => allProducts().find((p) => p.name === name)?.id ?? null;
