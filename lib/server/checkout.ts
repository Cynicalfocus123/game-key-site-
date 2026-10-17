import { and, asc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { MAX_PER_OFFER } from "@/lib/marketplace";
import { maxQty, productById } from "@/lib/catalog";
import { chargeCurrency, convertMinor, crossRate } from "@/lib/currency/money";
import { checkAddress } from "@/lib/address-formats";
import { promoStatus, toPublic, type PublicPromo } from "@/lib/promo";
import { COMPANY, CORECART_SELLER } from "@/lib/orders";
import { CHECKOUT_ERRORS, HOLD_MS, orderMoney, paidStatus, walletSplit, type PlaceOrderInput, type PricedLine, type StockProblem } from "@/lib/checkout";
import { ensureCatalog } from "./catalog";
import { addKeys } from "./key-inventory";
import { db } from "./db";
import { cartItem, orderItems, orderKey, orders, productKey, promoCode, sellerKey, sellerOffer, user, walletLedger } from "./db/schema";
import { feeSettings } from "./fees";
import { findPromo } from "./promo";
import { publicCurrencies } from "./rates";
import { usdToBase, visibleSellers } from "./marketplace";
import { mailOrder } from "./orders";
import { paymentProvider } from "./payments";
import { devSign } from "./payments/dev";
import { matchEvent, type PaymentEvent } from "./payments/event";
import { saveBilling, savedBilling } from "./billing";
import { handleWebhook } from "./topups";

// Checkout (seller marketplace step 5, wireframe approved 2026-10-08; rules: lib/checkout.ts, CODEBASE.md section 22).
// Pay → placeOrder: the server re-reads every price + stock (never the browser's), then ONE transaction holds the keys (row locks, skip locked:
// two buyers never get the same key) and makes a PENDING order. Wallet: paid in the same transaction. Card / PayPal …: the provider's verified
// webhook (orderEvent) or, in development, Simulate paid / failed. Paid = keys sold + copied (still encrypted) to order_key, exactly once per order.
// Failed / cancelled / not paid within HOLD_MINUTES → the held keys go back on sale.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type U = typeof user.$inferSelect;
type Fail = { ok: false; error: string; status: number; problems?: StockProblem[] };
type OrderRow = typeof orders.$inferSelect;
const fail = (error: string, status = 400, problems?: StockProblem[]): Fail => ({ ok: false, error, status, ...(problems ? { problems } : {}) });
const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const orderNumber = () => `CC-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => chars[b % 32]).join("")}`;
const PAID = ["paid", "completed"];

// ─── Hold release ───────────────────────────────────────────────────────────────────────────────────────────────────────
// Reserved keys of an order back on sale; the pending order becomes cancelled with the reason. Inside the caller's transaction.
async function release(tx: Tx, orderId: string, reason: string, now: Date) {
  const items = (await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId))).map((i) => i.id);
  if (items.length) {
    await tx.update(productKey).set({ status: "available", orderItemId: null }).where(and(inArray(productKey.orderItemId, items), eq(productKey.status, "reserved")));
    await tx.update(sellerKey).set({ status: "in_stock", orderItemId: null }).where(and(inArray(sellerKey.orderItemId, items), eq(sellerKey.status, "reserved")));
  }
  await tx.update(orders).set({ status: "cancelled", closedAt: now, failureReason: reason.slice(0, 200), holdUntil: null }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
}
// Pending orders past their hold → cancelled, keys back on sale. Lazy (before every checkout / stock read) + the timer in instrumentation.
export async function expireOrders(userId?: string) {
  const now = new Date();
  const due = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.status, "pending"), lte(orders.holdUntil, now), userId ? eq(orders.userId, userId) : undefined)).limit(200);
  for (const o of due) await db.transaction(async (tx) => {
    const [cur] = await tx.select({ status: orders.status, holdUntil: orders.holdUntil }).from(orders).where(eq(orders.id, o.id)).for("update");
    if (cur?.status === "pending" && cur.holdUntil && cur.holdUntil <= now) await release(tx, o.id, "Not paid within 30 minutes.", now);
  });
  return due.length;
}

// Every minute (instrumentation.api.ts starts it with the server): held keys of unpaid orders go back on sale on time, even with no visitors.
let holdTimer: ReturnType<typeof setInterval> | null = null;
export function startHoldTimer() {
  if (holdTimer) return;
  holdTimer = setInterval(() => { expireOrders().catch((e) => console.error("[checkout] hold timer:", e)); }, 60_000);
  holdTimer.unref?.();
}

// ─── Paid ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Reserved keys → sold + one order_key per unit ("enc:" + the stored ciphertext; decrypted only on reveal), order paid / completed,
// promo use counted. A late payment (hold ended) takes free keys again; still short → paid + admin review note (refund by hand).
// Returns false when the order was already paid (exactly once).
async function fulfil(tx: Tx, orderId: string, method: string, now: Date): Promise<boolean> {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o || PAID.includes(o.status) || o.status === "refunded") return false;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const short: string[] = [];
  for (const i of items) {
    if (i.kind !== "game_key") continue;
    const seller = Boolean(i.offerId);
    const t = seller ? sellerKey : productKey;
    let held = await tx.select({ id: t.id, codeEnc: t.codeEnc }).from(t).where(and(eq(t.orderItemId, i.id), eq(t.status, "reserved"))).for("update");
    if (held.length < i.quantity) { // late payment: hold released, try free keys again
      const more = seller
        ? await tx.select({ id: sellerKey.id, codeEnc: sellerKey.codeEnc }).from(sellerKey).where(and(eq(sellerKey.offerId, i.offerId!), eq(sellerKey.status, "in_stock"))).orderBy(asc(sellerKey.createdAt)).limit(i.quantity - held.length).for("update", { skipLocked: true })
        : await tx.select({ id: productKey.id, codeEnc: productKey.codeEnc }).from(productKey).where(and(eq(productKey.productId, i.productId ?? ""), eq(productKey.status, "available"))).orderBy(asc(productKey.createdAt)).limit(i.quantity - held.length).for("update", { skipLocked: true });
      held = [...held, ...more];
      if (held.length < i.quantity) short.push(`${i.name}: ${i.quantity - held.length} key(s) missing`);
    }
    if (!held.length) continue;
    const ids = held.map((k) => k.id);
    if (seller) await tx.update(sellerKey).set({ status: "sold", soldAt: now, orderItemId: i.id }).where(inArray(sellerKey.id, ids));
    else await tx.update(productKey).set({ status: "sold", soldAt: now, orderItemId: i.id }).where(inArray(productKey.id, ids));
    await tx.insert(orderKey).values(held.map((k) => ({ id: crypto.randomUUID(), orderItemId: i.id, userId: o.userId, code: `enc:${k.codeEnc}`, source: seller ? "seller" : "admin", sourceKeyId: k.id, createdAt: now })));
  }
  const late = o.status !== "pending" ? `Paid after it was ${o.status}.` : null;
  await tx.update(orders).set({ status: short.length ? "paid" : paidStatus(items), paidAt: now, paymentMethod: method, holdUntil: null, closedAt: null, failureReason: late,
    reviewNote: short.length ? `${now.toISOString()} paid but not enough keys — refund by hand: ${short.join("; ")}`.slice(0, 2000) : o.reviewNote }).where(eq(orders.id, o.id));
  if (o.promoCode) await tx.update(promoCode).set({ uses: sql`${promoCode.uses} + 1` }).where(eq(promoCode.code, o.promoCode));
  return true;
}
// After a paid order: the bought lines leave the account cart, then the "Order confirmed" email.
async function afterPaid(orderId: string) {
  const [o] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1); if (!o) return;
  const items = await db.select({ productId: orderItems.productId, offerId: orderItems.offerId }).from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const i of items) if (i.productId) await db.delete(cartItem).where(and(eq(cartItem.userId, o.userId), eq(cartItem.productId, i.productId), eq(cartItem.offerId, i.offerId ?? "")));
  await mailOrder(orderId);
}
// Local test server only (dev payment adapter, never production; user 2026-10-17): a CoreCart game key that never had any keys gets
// 10 "Local test stock" keys on its first order, so a game can be bought on localhost like on the demo. Once a product has keys
// (uploaded or test), stock counts normally and "Not enough stock" still works. A real site never runs this.
const chars5 = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => chars[b % 32]).join("");
async function localTestStock(lines: PlaceOrderInput["lines"]) {
  if (process.env.NODE_ENV === "production" || !paymentProvider().simulate) return;
  for (const l of lines) {
    if (l.offerId || productById(l.productId)?.kind !== "game_key") continue;
    const [any] = await db.select({ id: productKey.id }).from(productKey).where(eq(productKey.productId, l.productId)).limit(1);
    if (!any) await addKeys(l.productId, Array.from({ length: 10 }, () => `TEST-${chars5()}-${chars5()}-${chars5()}`), "Local test stock", null);
  }
}

// ─── Place order ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Prices from the catalog / live offer, one hold per line. ok → { orderId, paid } (wallet: paid now; others: pending + payment start).
export async function placeOrder(u: U, input: PlaceOrderInput, origin: string): Promise<{ ok: true; orderId: string; paid: boolean; payment: unknown } | Fail> {
  if (!u.emailVerified) return fail(CHECKOUT_ERRORS.verify, 403);
  const provider = paymentProvider();
  if (input.method !== "wallet" && !provider.available) return fail(CHECKOUT_ERRORS.provider, 409);
  await ensureCatalog(); await expireOrders();
  await localTestStock(input.lines);
  // 1. Price every line on the server.
  const offerIds = input.lines.flatMap((l) => (l.offerId ? [l.offerId] : []));
  const offers = offerIds.length ? await db.select().from(sellerOffer).where(inArray(sellerOffer.id, offerIds)) : [];
  const visible = await visibleSellers(offers.map((o) => o.sellerId)); const toBase = await usdToBase();
  const lines: PricedLine[] = [];
  for (const l of input.lines) {
    const p = productById(l.productId); if (!p) return fail(CHECKOUT_ERRORS.product, 409);
    const base = { productId: p.id, name: p.name, kind: p.kind, platform: p.platform ?? null, region: p.region ?? null, qty: l.qty };
    if (l.offerId) {
      const o = offers.find((x) => x.id === l.offerId); const v = o && visible.get(o.sellerId);
      if (!o || !v || !o.active || o.productId !== p.id || p.kind !== "game_key") return fail(CHECKOUT_ERRORS.product, 409);
      if (l.qty > MAX_PER_OFFER) return fail(CHECKOUT_ERRORS.bad);
      lines.push({ ...base, offerId: o.id, unit: toBase(o.priceUsdCents), seller: v.store.name, sellerId: o.sellerId, unitUsdCents: o.priceUsdCents });
    } else {
      if (maxQty(p) < 1) return fail(CHECKOUT_ERRORS.product, 409);
      if (l.qty > maxQty(p)) return fail(CHECKOUT_ERRORS.stock, 409, [{ productId: p.id, offerId: null, name: p.name, seller: CORECART_SELLER, want: l.qty, left: maxQty(p) }]);
      lines.push({ ...base, offerId: null, unit: p.price, seller: CORECART_SELLER, sellerId: null, unitUsdCents: null });
    }
  }
  // 2. Promo (CoreCart lines only), fee + tax, billing (a new valid address is saved on the account, task 5 rule).
  let promo: PublicPromo | null = null;
  if (input.promoCode) {
    const row = await findPromo(input.promoCode);
    if (!row || promoStatus(row) !== "active") return fail(CHECKOUT_ERRORS.promo, 409);
    if (row.oncePerCustomer) {
      const [used] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.userId, u.id), eq(orders.promoCode, row.code), inArray(orders.status, PAID))).limit(1);
      if (used) return fail(CHECKOUT_ERRORS.promo, 409);
    }
    promo = toPublic(row);
  }
  let billing = savedBilling(u);
  if (input.billing) { const c = checkAddress(input.billing); if (c.ok) { billing = c.address; await saveBilling(u.id, savedBilling(u), c.address).catch(() => null); } }
  const money = orderMoney(lines, promo, await feeSettings(), billing?.country ?? u.country ?? COMPANY.country);
  // 3. Charged currency: wallet = THB (the wallet is kept in THB); others = the account currency when chargeable, else USD.
  const rates = await publicCurrencies();
  const charged = input.method === "wallet" ? { ...rates.base, roundStep: 1 } : chargeCurrency(rates.currencies.find((c) => c.code === u.currency), rates.currencies);
  if (!charged) return fail(CHECKOUT_ERRORS.provider, 409);
  if (input.method !== "wallet" && !provider.supports(charged.code)) return fail(CHECKOUT_ERRORS.provider, 409);
  const exact = { ...charged, roundStep: 1 };
  const conv = (thb: number) => (input.method === "wallet" ? thb : convertMinor(thb, rates.base, exact));
  const unitCharged = lines.map((l) => (input.method === "wallet" ? l.unit : convertMinor(l.unit, rates.base, charged)));
  const subtotalMinor = lines.reduce((t, l, i) => t + unitCharged[i] * l.qty, 0);
  const discountMinor = conv(money.discount), serviceFeeMinor = conv(money.fee), taxMinor = conv(money.tax);
  const totalCents = Math.max(0, subtotalMinor - discountMinor + serviceFeeMinor + taxMinor);

  // 4. One transaction: user lock, idempotency replay, older pending order released, keys held, order made (wallet: paid at once).
  const res = await db.transaction(async (tx): Promise<{ ok: true; id: string; paid: boolean; replay: boolean } | Fail> => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, u.id)).for("update");
    const [same] = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(and(eq(orders.userId, u.id), eq(orders.idempotencyKey, input.idempotencyKey))).limit(1);
    if (same) return { ok: true, id: same.id, paid: PAID.includes(same.status), replay: true };
    const now = new Date();
    // One open order per customer: a new Pay releases the keys of the older unpaid one.
    for (const old of await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.userId, u.id), eq(orders.status, "pending"))).for("update")) await release(tx, old.id, "Replaced by a newer order.", now);
    const problems: StockProblem[] = []; const holds: string[][] = [];
    for (const l of lines) {
      if (l.kind !== "game_key") { holds.push([]); continue; }
      const free = l.offerId
        ? await tx.select({ id: sellerKey.id }).from(sellerKey).where(and(eq(sellerKey.offerId, l.offerId), eq(sellerKey.status, "in_stock"))).orderBy(asc(sellerKey.createdAt)).limit(l.qty).for("update", { skipLocked: true })
        : await tx.select({ id: productKey.id }).from(productKey).where(and(eq(productKey.productId, l.productId), eq(productKey.status, "available"))).orderBy(asc(productKey.createdAt)).limit(l.qty).for("update", { skipLocked: true });
      if (free.length < l.qty) problems.push({ productId: l.productId, offerId: l.offerId, name: l.name, seller: l.seller, want: l.qty, left: free.length });
      holds.push(free.map((k) => k.id));
    }
    if (problems.length) return fail(CHECKOUT_ERRORS.stock, 409, problems); // nothing written: no order, no hold
    let walletMinor = 0, giftHave = 0;
    if (input.method === "wallet") {
      const sums = await tx.select({ bucket: walletLedger.bucket, n: sql<number>`coalesce(sum(${walletLedger.amountMinor}), 0)::int` }).from(walletLedger).where(eq(walletLedger.userId, u.id)).groupBy(walletLedger.bucket);
      const gift = Number(sums.find((r) => r.bucket === "gift")?.n ?? 0), wallet = Number(sums.find((r) => r.bucket === "wallet")?.n ?? 0);
      if (gift + wallet <= 0) return fail(CHECKOUT_ERRORS.walletEmpty, 409);
      if (gift + wallet < totalCents) return fail(CHECKOUT_ERRORS.wallet, 409);
      walletMinor = totalCents; giftHave = gift;
    }
    const id = crypto.randomUUID(); const number = orderNumber();
    await tx.insert(orders).values({ id, number, userId: u.id, status: "pending", currency: charged.code, totalCents, baseTotalMinor: money.total, fxRate: input.method === "wallet" ? "1" : crossRate(rates.base, charged),
      ratesAt: rates.updatedAt ? new Date(rates.updatedAt) : null, isSample: false, paymentMethod: input.method, subtotalMinor, discountMinor, promoCode: promo?.code ?? null, walletMinor,
      serviceFeeMinor, taxMinor, taxRateBp: money.taxBp, billing, idempotencyKey: input.idempotencyKey, holdUntil: new Date(now.getTime() + HOLD_MS),
      provider: input.method === "wallet" ? "wallet" : provider.id, createdAt: now });
    for (const [n, l] of lines.entries()) {
      const itemId = crypto.randomUUID();
      await tx.insert(orderItems).values({ id: itemId, orderId: id, name: l.name, kind: l.kind, platform: l.platform, region: l.region, quantity: l.qty, unitPriceCents: unitCharged[n], productId: l.productId,
        seller: l.seller, sellerId: l.sellerId, offerId: l.offerId, unitUsdCents: l.unitUsdCents });
      if (!holds[n].length) continue;
      if (l.offerId) await tx.update(sellerKey).set({ status: "reserved", orderItemId: itemId }).where(inArray(sellerKey.id, holds[n]));
      else await tx.update(productKey).set({ status: "reserved", orderItemId: itemId }).where(inArray(productKey.id, holds[n]));
    }
    if (input.method !== "wallet") return { ok: true, id, paid: false, replay: false };
    const split = walletSplit(giftHave, totalCents - giftHave, totalCents);
    const rows = [split.gift && { bucket: "gift", amountMinor: -split.gift }, split.wallet && { bucket: "wallet", amountMinor: -split.wallet }].filter(Boolean) as { bucket: string; amountMinor: number }[];
    if (rows.length) await tx.insert(walletLedger).values(rows.map((r) => ({ id: crypto.randomUUID(), userId: u.id, bucket: r.bucket, type: "purchase", amountMinor: r.amountMinor, ref: number, createdAt: now })));
    await fulfil(tx, id, "wallet", now);
    return { ok: true, id, paid: true, replay: false };
  });
  if (!res.ok) return res;
  if (res.paid) { if (!res.replay) await afterPaid(res.id); return { ok: true, orderId: res.id, paid: true, payment: null }; }
  // Card / PayPal …: start the provider payment (dev adapter = Simulate buttons on the processing screen).
  const [o] = await db.select().from(orders).where(eq(orders.id, res.id)).limit(1);
  if (o.status !== "pending") return { ok: true, orderId: o.id, paid: PAID.includes(o.status), payment: null };
  try {
    const processing = `${origin}/checkout/processing?order=${encodeURIComponent(o.id)}`;
    const created = await provider.createPayment({ orderId: o.id, number: o.number, amountMinor: o.totalCents, currency: o.currency, email: u.email, returnUrl: processing, cancelUrl: `${origin}/checkout/payment` });
    if (created.providerRef && created.providerRef !== o.providerRef) await db.update(orders).set({ providerRef: created.providerRef }).where(eq(orders.id, o.id));
    return { ok: true, orderId: o.id, paid: false, payment: created.start };
  } catch (e) {
    console.error("[CoreCart payments] order createPayment failed", e);
    if (!res.replay) await db.transaction((tx) => release(tx, o.id, "The payment could not be started.", new Date()));
    return fail(CHECKOUT_ERRORS.start, 502);
  }
}

// Order facts the processing screen needs (hold deadline). null = not this customer's order.
export async function orderHold(userId: string, id: string) {
  await expireOrders(userId);
  const [o] = await db.select({ status: orders.status, holdUntil: orders.holdUntil }).from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId))).limit(1);
  return o ? { status: o.status, holdUntil: o.holdUntil?.toISOString() ?? null } : null;
}

// ─── Provider events for orders (called by lib/server/topups.ts handleWebhook when the event names an order) ────────────
// Same checks as top-ups (provider, payment reference, gross amount + currency) before anything changes.
export async function orderEvent(ev: PaymentEvent, verifier: string): Promise<{ result: string; orderId: string | null; deferred?: boolean }> {
  const out = await db.transaction(async (tx) => {
    const [byId] = ev.orderId ? await tx.select().from(orders).where(eq(orders.id, ev.orderId)).for("update") : [];
    const [byRef] = !byId && ev.providerRef ? await tx.select().from(orders).where(and(eq(orders.provider, verifier), eq(orders.providerRef, ev.providerRef))).for("update") : [];
    const o: OrderRow | undefined = byId ?? byRef;
    if (!o) return { result: "ignored: unknown order", orderId: null };
    if (ev.type !== "payment.succeeded" && ev.type !== "payment.failed") return { result: `ignored: ${ev.rawType}`, orderId: o.id };
    const m = matchEvent(ev, { id: o.id, provider: o.provider ?? "", providerRef: o.providerRef, amountMinor: o.totalCents, currency: o.currency }, verifier);
    if (!m.ok && m.kind === "transient") return { result: `deferred: ${m.reason}`, orderId: o.id, deferred: true };
    if (!m.ok) {
      await tx.update(orders).set({ reviewNote: `${o.reviewNote ? o.reviewNote + "\n" : ""}${new Date().toISOString()} ${verifier} event ${ev.eventId}: ${m.reason}`.slice(-2000) }).where(eq(orders.id, o.id));
      return { result: `rejected: ${m.reason}`, orderId: o.id };
    }
    const now = new Date();
    if (ev.type === "payment.succeeded") return (await fulfil(tx, o.id, o.paymentMethod ?? "card", now)) ? { result: "paid", orderId: o.id } : { result: "ignored: already paid", orderId: o.id };
    if (o.status !== "pending") return { result: `ignored: order is ${o.status}`, orderId: o.id };
    await release(tx, o.id, (ev.type === "payment.failed" && ev.reason) || "The payment failed.", now);
    return { result: "failed", orderId: o.id };
  });
  if (out.result === "paid" && out.orderId) await afterPaid(out.orderId);
  if (out.result === "failed" && out.orderId) await mailOrder(out.orderId);
  return out;
}

// Dev adapter + demo only: Simulate paid / failed builds a signed provider event and sends it through the real webhook path.
export async function simulateOrder(userId: string, id: string, outcome: "paid" | "failed"): Promise<{ ok: true; status: string; result: string } | Fail> {
  if (!paymentProvider().simulate) return fail(CHECKOUT_ERRORS.simulate, 403);
  const [o] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId), ne(orders.provider, "wallet"))).limit(1);
  if (!o) return fail(CHECKOUT_ERRORS.notFound, 404);
  const raw = JSON.stringify({ id: `dev_evt_${crypto.randomUUID()}`, type: outcome === "paid" ? "payment.succeeded" : "payment.failed", orderId: o.id, providerRef: o.providerRef, amountMinor: o.totalCents, currency: o.currency,
    ...(outcome === "failed" ? { reason: "Card declined (simulated)." } : {}) });
  const r = await handleWebhook(raw, new Headers({ "x-dev-signature": devSign(raw) }));
  const [after] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, o.id)).limit(1);
  return { ok: true, status: after.status, result: r.result };
}
