import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { ADMIN_CANCEL_REASON, ADMIN_ORDER_ERRORS, bkkStart, bkkToday, HOLD_REASON, isDay, maskName, noteOk, ORDER_NOTE_MAX, ORDER_TABS, ORDERS_PAGE, orderView, REPLACED_REASON, saleState,
  type AdminOrderDetail, type AdminOrderKey, type AdminOrderPage, type AdminOrderQuery, type AdminOrderRow, type KeyCountsLine, type OrderAction, type OrderTab, type SaleTab,
  type SellerSaleRow, type SellerSalesPage, type SellerSalesQuery, type TimelineEntry, SALE_TABS } from "@/lib/admin-orders";
import { youReceive } from "@/lib/marketplace";
import { paymentLabel } from "@/lib/orders";
import type { BillingAddress } from "@/lib/address-formats";
import { db } from "./db";
import { keyReveal, orderEvent, orderItems, orderKey, orders, productKey, sellerKey, sellerStore, ticket, user } from "./db/schema";
import { decryptKey } from "./key-inventory";
import { release } from "./checkout";
import { mailOrder } from "./orders";

// Admin Orders (section "orders") + seller Orders (own lines only). Rules + types: lib/admin-orders.ts. Sample orders (dev seed) are left out.
type OrderRow = typeof orders.$inferSelect;
const CLOSED_REASONS = [HOLD_REASON, REPLACED_REASON, ADMIN_CANCEL_REASON];
const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
const real = eq(orders.isSample, false);
const squash = (q: string) => q.toUpperCase().replace(/[\s-]/g, "");
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const paidSql = inArray(orders.status, ["paid", "completed"]);
const returnedSql = sql`(${orders.status} = 'refunded' or exists (select 1 from ${orderKey} k join ${orderItems} i on i.id = k.order_item_id where i.order_id = ${orders.id} and k.returned_at is not null))`;
function tabSql(tab: OrderTab): SQL | undefined {
  switch (tab) {
    case "paid": return paidSql;
    case "pending": return eq(orders.status, "pending");
    case "failed": return and(eq(orders.status, "cancelled"), or(isNull(orders.failureReason), notInArray(orders.failureReason, CLOSED_REASONS)));
    case "expired": return and(eq(orders.status, "cancelled"), eq(orders.failureReason, HOLD_REASON));
    case "cancelled": return and(eq(orders.status, "cancelled"), inArray(orders.failureReason, [REPLACED_REASON, ADMIN_CANCEL_REASON]));
    case "returned": return returnedSql;
    default: return undefined;
  }
}
// Filters except the tab (the tab counts use them too).
function baseWhere(q: AdminOrderQuery): SQL {
  const parts: (SQL | undefined)[] = [real];
  if (q.method) parts.push(eq(orders.paymentMethod, q.method));
  if (isDay(q.from)) parts.push(gte(orders.createdAt, new Date(bkkStart(q.from))));
  if (isDay(q.to)) parts.push(lt(orders.createdAt, new Date(bkkStart(q.to) + 86_400_000)));
  if (q.seller === "corecart") parts.push(sql`exists (select 1 from ${orderItems} i where i.order_id = ${orders.id} and i.seller_id is null)`);
  else if (q.seller) parts.push(sql`exists (select 1 from ${orderItems} i where i.order_id = ${orders.id} and i.seller_id = ${q.seller})`);
  const t = q.q.trim().slice(0, 100);
  if (t) parts.push(or(sql`replace(${orders.number}, '-', '') ilike ${like(squash(t))}`, sql`${user.email} ilike ${like(t)}`, sql`${user.name} ilike ${like(t)}`,
    sql`exists (select 1 from ${orderItems} i where i.order_id = ${orders.id} and i.name ilike ${like(t)})`));
  return and(...parts)!;
}
const count = async (where: SQL | undefined) => Number((await db.select({ n: sql<number>`count(*)::int` }).from(orders).innerJoin(user, eq(user.id, orders.userId)).where(where))[0]?.n ?? 0);

// Keys per order line: held (reserved inventory), delivered / revealed / returned (order_key).
async function keyCounts(itemIds: string[]) {
  const out = new Map<string, KeyCountsLine>(); if (!itemIds.length) return out;
  const get = (id: string) => { let c = out.get(id); if (!c) out.set(id, (c = { held: 0, delivered: 0, revealed: 0, returned: 0 })); return c; };
  for (const r of await db.select({ item: orderKey.orderItemId, n: sql<number>`count(*)::int`, rev: sql<number>`count(${orderKey.revealedAt})::int`, ret: sql<number>`count(${orderKey.returnedAt})::int` })
    .from(orderKey).where(inArray(orderKey.orderItemId, itemIds)).groupBy(orderKey.orderItemId)) Object.assign(get(r.item), { delivered: Number(r.n), revealed: Number(r.rev), returned: Number(r.ret) });
  for (const t of [productKey, sellerKey]) for (const r of await db.select({ item: t.orderItemId, n: sql<number>`count(*)::int` }).from(t).where(and(inArray(t.orderItemId, itemIds), eq(t.status, "reserved"))).groupBy(t.orderItemId))
    if (r.item) get(r.item).held += Number(r.n);
  return out;
}
const sum = (list: KeyCountsLine[]) => list.reduce((a, c) => ({ held: a.held + c.held, delivered: a.delivered + c.delivered, revealed: a.revealed + c.revealed, returned: a.returned + c.returned }), { held: 0, delivered: 0, revealed: 0, returned: 0 });

function toRow(o: OrderRow, u: { id: string; name: string; email: string }, items: (typeof orderItems.$inferSelect)[], counts: Map<string, KeyCountsLine>): AdminOrderRow {
  return { id: o.id, number: o.number, createdAt: o.createdAt.toISOString(), paidAt: iso(o.paidAt), view: orderView(o.status, o.failureReason), holdUntil: o.status === "pending" ? iso(o.holdUntil) : null,
    buyer: u, items: items.map((i) => ({ name: i.name, platform: i.platform, quantity: i.quantity, seller: i.seller })), method: o.paymentMethod, last4: o.paymentLast4, currency: o.currency, totalCents: o.totalCents,
    keys: sum(items.map((i) => counts.get(i.id) ?? { held: 0, delivered: 0, revealed: 0, returned: 0 })), hardware: items.some((i) => i.kind !== "game_key") };
}

export async function adminOrders(q: AdminOrderQuery): Promise<AdminOrderPage> {
  const base = baseWhere(q); const page = Math.max(1, Math.min(10_000, Math.floor(q.page) || 1));
  const where = and(base, tabSql(q.tab));
  const list = await db.select({ o: orders, u: { id: user.id, name: user.name, email: user.email } }).from(orders).innerJoin(user, eq(user.id, orders.userId)).where(where)
    .orderBy(desc(orders.createdAt)).limit(ORDERS_PAGE).offset((page - 1) * ORDERS_PAGE);
  const items = list.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, list.map((r) => r.o.id))) : [];
  const counts = await keyCounts(items.map((i) => i.id));
  const tabCounts = Object.fromEntries(await Promise.all(ORDER_TABS.map(async (t) => [t, await count(and(base, tabSql(t)))]))) as Record<OrderTab, number>;
  // Tiles: Bangkok "today".
  const today = new Date(bkkStart(bkkToday()));
  const paid = await db.select({ currency: orders.currency, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${orders.totalCents}), 0)::bigint` }).from(orders).where(and(real, paidSql, gte(orders.paidAt, today))).groupBy(orders.currency);
  const [sellerDay] = await db.select({ lines: sql<number>`count(*)::int`, sellers: sql<number>`count(distinct ${orderItems.sellerId})::int`, usd: sql<number>`coalesce(sum(${orderItems.unitUsdCents} * ${orderItems.quantity}), 0)::bigint` })
    .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(real, paidSql, gte(orders.paidAt, today), isNotNull(orderItems.sellerId)));
  const since = q.since && !Number.isNaN(Date.parse(q.since)) ? new Date(q.since) : null;
  const sellers = await db.select({ id: sellerStore.userId, name: sellerStore.name }).from(sellerStore).orderBy(sellerStore.name);
  return {
    rows: list.map((r) => toRow(r.o, r.u, items.filter((i) => i.orderId === r.o.id), counts)), total: tabCounts[q.tab], page, pageSize: ORDERS_PAGE, counts: tabCounts, sellers,
    tiles: { today: await count(and(real, gte(orders.createdAt, today))), paidToday: paid.reduce((t, r) => t + Number(r.n), 0), paidTodayMoney: paid.map((r) => ({ currency: r.currency, totalMinor: Number(r.total) })),
      pendingNow: await count(and(real, eq(orders.status, "pending"))), closedToday: await count(and(real, eq(orders.status, "cancelled"), gte(orders.closedAt, today), ne(orders.failureReason, REPLACED_REASON))),
      sellerToday: { lines: Number(sellerDay?.lines ?? 0), sellers: Number(sellerDay?.sellers ?? 0), usdCents: Number(sellerDay?.usd ?? 0) } },
    newSince: since ? await count(and(real, gt(orders.createdAt, since))) : 0,
  };
}

// Last 4 of a delivered key: from the inventory row it came from (sample keys: the plain code).
async function last4s(keys: (typeof orderKey.$inferSelect)[]) {
  const ids = (src: string) => keys.filter((k) => k.source === src && k.sourceKeyId).map((k) => k.sourceKeyId!);
  const rows = [...(ids("admin").length ? await db.select({ id: productKey.id, last4: productKey.last4 }).from(productKey).where(inArray(productKey.id, ids("admin"))) : []),
    ...(ids("seller").length ? await db.select({ id: sellerKey.id, last4: sellerKey.last4 }).from(sellerKey).where(inArray(sellerKey.id, ids("seller"))) : [])];
  const map = new Map(rows.map((r) => [r.id, r.last4]));
  return (k: typeof orderKey.$inferSelect) => (k.sourceKeyId && map.get(k.sourceKeyId)) || (k.code.startsWith("enc:") ? "????" : k.code.slice(-4));
}
const findOrder = async (idOrNumber: string) => (await db.select().from(orders).where(and(real, idOrNumber.toUpperCase().startsWith("CC-") ? eq(orders.number, idOrNumber.toUpperCase()) : eq(orders.id, idOrNumber))).limit(1))[0];

export async function adminOrder(idOrNumber: string): Promise<AdminOrderDetail | null> {
  const o = await findOrder(idOrNumber.slice(0, 80)); if (!o) return null;
  const [u] = await db.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }).from(user).where(eq(user.id, o.userId)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const itemIds = items.map((i) => i.id); const counts = await keyCounts(itemIds);
  const keys = itemIds.length ? await db.select().from(orderKey).where(inArray(orderKey.orderItemId, itemIds)).orderBy(orderKey.createdAt) : [];
  const last4 = await last4s(keys);
  const stores = await db.select({ id: sellerStore.userId, slug: sellerStore.slug }).from(sellerStore).where(inArray(sellerStore.userId, items.flatMap((i) => (i.sellerId ? [i.sellerId] : [""]))));
  const reveals = keys.length ? await db.select({ keyId: keyReveal.keyId, at: keyReveal.createdAt }).from(keyReveal).where(and(inArray(keyReveal.keyId, keys.map((k) => k.id)), eq(keyReveal.userId, o.userId))).orderBy(keyReveal.createdAt) : [];
  const events = await db.select({ action: orderEvent.action, detail: orderEvent.detail, at: orderEvent.createdAt, by: user.email }).from(orderEvent).leftJoin(user, eq(user.id, orderEvent.adminId)).where(eq(orderEvent.orderId, o.id)).orderBy(orderEvent.createdAt);
  const [tk] = await db.select({ n: sql<number>`count(*)::int` }).from(ticket).where(eq(ticket.orderId, o.id));
  const nameOf = (itemId: string) => items.find((i) => i.id === itemId)?.name ?? "Key";
  const lines = items.map((i) => ({ id: i.id, name: i.name, productId: i.productId, platform: i.platform, region: i.region, kind: i.kind, quantity: i.quantity, unitPriceCents: i.unitPriceCents,
    seller: i.seller, sellerId: i.sellerId, sellerSlug: stores.find((s) => s.id === i.sellerId)?.slug ?? null, offerId: i.offerId, unitUsdCents: i.unitUsdCents, receiveUsdCents: i.unitUsdCents === null ? null : youReceive(i.unitUsdCents),
    held: counts.get(i.id)?.held ?? 0,
    keys: keys.filter((k) => k.orderItemId === i.id).map((k): AdminOrderKey => ({ id: k.id, last4: last4(k), state: k.returnedAt ? "returned" : k.revealedAt ? "revealed" : "delivered", revealedAt: iso(k.revealedAt), returnedAt: iso(k.returnedAt) })) }));
  // Timeline: order facts + reveals + returns + admin events, oldest first.
  const tl: TimelineEntry[] = [];
  const gameUnits = items.filter((i) => i.kind === "game_key").reduce((t, i) => t + i.quantity, 0);
  tl.push({ at: o.createdAt.toISOString(), tone: "info", text: `Order created (${paymentLabel(o.paymentMethod)})${gameUnits ? ` · ${gameUnits} key${gameUnits === 1 ? "" : "s"} held for 30 minutes` : ""}` });
  if (o.paidAt) {
    tl.push({ at: o.paidAt.toISOString(), tone: "ok", text: `Payment confirmed${o.providerRef ? ` (provider ref ${o.providerRef})` : o.provider === "wallet" ? " (wallet)" : ""}` });
    tl.push({ at: o.paidAt.toISOString(), tone: "ok", text: `${keys.length ? `${keys.length} key${keys.length === 1 ? "" : "s"} delivered to the Keys library · ` : ""}"Order confirmed" email sent` });
  }
  if (o.status === "cancelled" && o.closedAt) tl.push({ at: o.closedAt.toISOString(), tone: "bad", text: `Closed: ${o.failureReason ?? "cancelled"}${o.failureReason !== REPLACED_REASON && o.failureReason !== ADMIN_CANCEL_REASON ? " · held keys back on sale" : ""}` });
  const seen = new Set<string>();
  for (const r of reveals) { const k = keys.find((x) => x.id === r.keyId)!; const first = !seen.has(r.keyId); seen.add(r.keyId); tl.push({ at: r.at.toISOString(), tone: "info", text: `Buyer ${first ? "revealed" : "opened again"} the ${nameOf(k.orderItemId)} key …${last4(k)}` }); }
  for (const k of keys) if (k.returnedAt) tl.push({ at: k.returnedAt.toISOString(), tone: "bad", text: `${nameOf(k.orderItemId)} key …${last4(k)} taken back by a return${k.revealedAt ? " (revealed: never resold)" : " (back on sale)"}` });
  for (const e of events) tl.push({ at: e.at.toISOString(), tone: e.action === "cancelled" ? "bad" : "info", text: e.action === "key_shown" ? `${e.by ?? "Deleted admin"} showed the full key for ${e.detail}` : e.action === "note" ? `Note by ${e.by ?? "Deleted admin"}: "${e.detail}"`
    : e.action === "email_resent" ? `${e.by ?? "Deleted admin"} resent the "Order confirmed" email` : e.action === "cancelled" ? `${e.by ?? "Deleted admin"} cancelled the order · held keys back on sale` : `${e.action} ${e.detail}` });
  if (o.reviewNote) tl.push({ at: (o.closedAt ?? o.paidAt ?? o.createdAt).toISOString(), tone: "bad", text: `Review: ${o.reviewNote}` });
  tl.sort((a, b) => a.at.localeCompare(b.at));
  const row = toRow(o, { id: u?.id ?? o.userId, name: u?.name ?? "Deleted user", email: u?.email ?? "—" }, items, counts);
  return { ...row, status: o.status, failureReason: o.failureReason, reviewNote: o.reviewNote, provider: o.provider, providerRef: o.providerRef, buyerSince: iso(u?.createdAt), ipAddress: o.ipAddress, userAgent: o.userAgent,
    billing: (o.billing as BillingAddress | null) ?? null, subtotalMinor: o.subtotalMinor, discountMinor: o.discountMinor, promoCode: o.promoCode, serviceFeeMinor: o.serviceFeeMinor, taxMinor: o.taxMinor, walletMinor: o.walletMinor,
    fxRate: o.fxRate, ratesAt: iso(o.ratesAt), lines, timeline: tl, tickets: Number(tk?.n ?? 0), canCancel: o.status === "pending", canResend: o.status === "paid" || o.status === "completed" };
}

// Show key (logged), resend email, note, cancel a pending order (held keys back on sale).
export async function orderAction(adminId: string, idOrNumber: string, a: OrderAction): Promise<{ ok: true; code?: string; order: AdminOrderDetail } | { ok: false; error: string; status: number }> {
  const o = await findOrder(idOrNumber.slice(0, 80)); if (!o) return { ok: false, error: ADMIN_ORDER_ERRORS.notFound, status: 404 };
  const log = (action: string, detail = "") => db.insert(orderEvent).values({ id: crypto.randomUUID(), orderId: o.id, adminId, action, detail: detail.slice(0, ORDER_NOTE_MAX) });
  let code: string | undefined;
  if (a.action === "show_key") {
    const [k] = await db.select({ key: orderKey, name: orderItems.name }).from(orderKey).innerJoin(orderItems, eq(orderItems.id, orderKey.orderItemId)).where(and(eq(orderKey.id, a.keyId), eq(orderItems.orderId, o.id))).limit(1);
    if (!k) return { ok: false, error: ADMIN_ORDER_ERRORS.key, status: 404 };
    code = k.key.code.startsWith("enc:") ? decryptKey(k.key.code.slice(4)) : k.key.code;
    await log("key_shown", `${k.name} …${code.slice(-4)}`);
  } else if (a.action === "note") {
    if (!noteOk(a.text)) return { ok: false, error: ADMIN_ORDER_ERRORS.note, status: 400 };
    await log("note", a.text.trim());
  } else if (a.action === "resend") {
    if (o.status !== "paid" && o.status !== "completed") return { ok: false, error: ADMIN_ORDER_ERRORS.resend, status: 409 };
    await mailOrder(o.id); await log("email_resent");
  } else {
    const done = await db.transaction(async (tx) => {
      const [cur] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, o.id)).for("update");
      if (cur?.status !== "pending") return false;
      await release(tx, o.id, ADMIN_CANCEL_REASON, new Date());
      await tx.insert(orderEvent).values({ id: crypto.randomUUID(), orderId: o.id, adminId, action: "cancelled", detail: "" });
      return true;
    });
    if (!done) return { ok: false, error: ADMIN_ORDER_ERRORS.cancel, status: 409 };
  }
  return { ok: true, ...(code ? { code } : {}), order: (await adminOrder(o.id))! };
}

// Latest orders box on the admin Overview (5 newest real orders).
export async function latestOrders(n = 5) {
  return (await adminOrders({ q: "", tab: "all", method: "", seller: "", from: "", to: "", page: 1 })).rows.slice(0, n);
}

// ---- Seller Orders: only this seller's lines; buyer = masked name. ----
export async function sellerSales(sellerId: string, q: SellerSalesQuery): Promise<SellerSalesPage> {
  const parts: (SQL | undefined)[] = [real, eq(orderItems.sellerId, sellerId)];
  if (isDay(q.from)) parts.push(gte(orders.createdAt, new Date(bkkStart(q.from))));
  if (isDay(q.to)) parts.push(lt(orders.createdAt, new Date(bkkStart(q.to) + 86_400_000)));
  const t = q.q.trim().slice(0, 100);
  if (t) parts.push(or(sql`replace(${orders.number}, '-', '') ilike ${like(squash(t))}`, sql`${orderItems.name} ilike ${like(t)}`));
  const rows = await db.select({ i: orderItems, o: { number: orders.number, status: orders.status, failureReason: orders.failureReason, createdAt: orders.createdAt, paidAt: orders.paidAt }, buyer: user.name })
    .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).innerJoin(user, eq(user.id, orders.userId)).where(and(...parts)).orderBy(desc(orders.createdAt)).limit(5000);
  const ids = rows.map((r) => r.i.id); const counts = await keyCounts(ids);
  const mine = ids.length ? await db.select({ item: sellerKey.orderItemId, last4: sellerKey.last4 }).from(sellerKey).where(and(eq(sellerKey.sellerId, sellerId), inArray(sellerKey.orderItemId, ids), inArray(sellerKey.status, ["sold", "returned"]))) : [];
  const all: SellerSaleRow[] = rows.map((r) => {
    const c = counts.get(r.i.id) ?? { held: 0, delivered: 0, revealed: 0, returned: 0 };
    const st = saleState(orderView(r.o.status, r.o.failureReason), { ...c, quantity: r.i.quantity });
    const unit = r.i.unitUsdCents ?? 0; const rec = youReceive(unit);
    return { itemId: r.i.id, orderNumber: r.o.number, createdAt: r.o.createdAt.toISOString(), buyer: maskName(r.buyer), productId: r.i.productId, name: r.i.name, platform: r.i.platform, region: r.i.region,
      quantity: r.i.quantity, unitUsdCents: unit, receiveUsdCents: st.state === "sold" ? (rec === null ? null : rec * r.i.quantity) : 0, state: st.state, delivered: c.delivered, revealed: c.revealed, returned: c.returned,
      last4: mine.filter((m) => m.item === r.i.id).map((m) => m.last4), note: st.note };
  });
  const countsTab = Object.fromEntries(SALE_TABS.map((tab) => [tab, tab === "all" ? all.length : all.filter((r) => r.state === tab).length])) as Record<SaleTab, number>;
  const shown = q.tab === "all" ? all : all.filter((r) => r.state === q.tab);
  const page = Math.max(1, Math.floor(q.page) || 1);
  const today = bkkStart(bkkToday()); const sold = rows.filter((r) => r.o.paidAt && r.o.paidAt.getTime() >= today && all.find((a) => a.itemId === r.i.id)!.state !== "cancelled");
  const income = sold.reduce((s, r) => s + (r.i.unitUsdCents ?? 0) * r.i.quantity, 0); const rec = youReceive(income);
  return { rows: shown.slice((page - 1) * ORDERS_PAGE, page * ORDERS_PAGE), total: shown.length, page, pageSize: ORDERS_PAGE, counts: countsTab,
    tiles: { soldTodayKeys: sold.reduce((s, r) => s + r.i.quantity, 0), soldTodayOrders: new Set(sold.map((r) => r.o.number)).size, incomeTodayUsdCents: income, receiveTodayUsdCents: rec, heldNow: all.filter((r) => r.state === "held").reduce((s, r) => s + r.quantity, 0) } };
}
