import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { allProducts, productById } from "@/lib/catalog";
import { convertMinor } from "@/lib/currency/money";
import { holdActive } from "@/lib/sellers";
import { USD_RATE } from "@/lib/topup";
import { ADMIN_REQUEST_ERRORS, catalogMatch, checkKeyText, keyReport, markExisting, MARKET_ERRORS, nameKey, offerStatus, OPEN_REQUESTS_MAX, productTitle, requestGroup, requestLine, requestNumber, REQUEST_TABS, slugify,
  type AdminRequestList, type AdminRequestRow, type KeyAddResult, type KeyCheck, type KeyReport, type ProductRequest, type RequestAction, type RequestInput, type RequestStatus, type SellerHome, type SellerOffer, type SellerStore } from "@/lib/marketplace";
import { sendTemplate } from "./email";
import { ensureCatalog } from "./catalog";
import { db } from "./db";
import { keyRegistry, orderItems, orders, productRequest, productRequestEvent, sellerKey, sellerOffer, sellerStore, user } from "./db/schema";
import { publicCurrencies } from "./rates";
import { encryptionKey, encryptText, hmacOf } from "./secure";
import { myApplication } from "./sellers";
import { json, requireUser, unauthorized } from "./session";

// Seller marketplace (wireframe approved 2026-10-08; CODEBASE.md section 21). Only approved sellers; prices in USD cents; keys encrypted at once
// (AES-256-GCM like admin keys) and refused when the code is already anywhere in CoreCart (key_registry).
type Fail = { ok: false; error: string; status: number; productId?: string };
const fail = (error: string, status = 400, extra: Partial<Fail> = {}): Fail => ({ ok: false, error, status, ...extra });
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const PAID = ["paid", "completed"];

// Route guard: 401 signed out, 403 not an approved seller (verified email like every account route).
export async function requireSeller(req: Request) {
  const u = await requireUser(req);
  if (!u) return { error: unauthorized() } as const;
  if (!u.emailVerified) return { error: json({ error: MARKET_ERRORS.notSeller }, 403) } as const;
  const seller = await sellerOf(u.id);
  if (!seller) return { error: json({ error: MARKET_ERRORS.notSeller }, 403) } as const;
  return { user: u, seller } as const;
}
export async function readBody(req: Request, max = 256_000): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  try { const t = await req.text(); if (t.length > max) return null; const b = JSON.parse(t); return b && typeof b === "object" && !Array.isArray(b) ? b : null; } catch { return null; }
}

// ---------- Seller + store ----------
export type Seller = { userId: string; store: SellerStore; holdUntil: string | null };
const storeOut = (s: typeof sellerStore.$inferSelect, since: string | null): SellerStore => ({ slug: s.slug, name: s.name, invoices: s.invoices, lowStockAt: s.lowStockAt, since });
// Approved seller (latest application approved) → their store, made on first use from the merchant name (slug made unique with -2, -3 …).
export async function sellerOf(userId: string): Promise<Seller | null> {
  const app = await myApplication(userId);
  if (!app || app.status !== "approved") return null;
  const holdUntil = holdActive(app.hold) ? app.hold!.until : null;
  let [row] = await db.select().from(sellerStore).where(eq(sellerStore.userId, userId)).limit(1);
  if (!row) {
    const base = slugify(app.merchantName);
    for (let n = 1; !row && n < 50; n++) {
      const slug = n === 1 ? base : `${base.slice(0, 36)}-${n}`;
      [row] = await db.insert(sellerStore).values({ userId, slug, name: app.merchantName }).onConflictDoNothing().returning();
      if (!row) [row] = await db.select().from(sellerStore).where(eq(sellerStore.userId, userId)).limit(1); // made by a parallel request
    }
    if (!row) throw new Error("Could not make a store slug");
  }
  return { userId, store: storeOut(row, app.decidedAt), holdUntil };
}
export async function saveStore(seller: Seller, patch: { invoices?: boolean; lowStockAt?: number }): Promise<SellerStore> {
  const set: Partial<typeof sellerStore.$inferInsert> = { updatedAt: new Date() };
  if (patch.invoices !== undefined) set.invoices = patch.invoices;
  if (patch.lowStockAt !== undefined) set.lowStockAt = patch.lowStockAt;
  const [row] = await db.update(sellerStore).set(set).where(eq(sellerStore.userId, seller.userId)).returning();
  return storeOut(row, seller.store.since);
}

// Dashboard tiles. Income / sales = paid order lines of this seller in the last 7 days (USD cents at order time). Payouts are not built:
// Available for payout stays 0 until the payout wireframe.
export async function sellerHome(seller: Seller): Promise<SellerHome> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [sum] = await db.select({ income: sql<number>`coalesce(sum(${orderItems.unitUsdCents} * ${orderItems.quantity}), 0)::int`, sales: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.sellerId, seller.userId), inArray(orders.status, PAID), gte(sql`coalesce(${orders.paidAt}, ${orders.createdAt})`, since)));
  const offers = await sellerOffers(seller.userId, false);
  return { store: seller.store, holdUntil: seller.holdUntil, tiles: { availableUsdCents: 0, incomeUsdCents7: sum?.income ?? 0, sales7: sum?.sales ?? 0, activeOffers: offers.filter((o) => o.status === "active").length } };
}

// ---------- Offers ----------
async function stockOf(offerIds: string[]) {
  const out = new Map<string, { stock: number; sold: number }>();
  if (!offerIds.length) return out;
  const rows = await db.select({ offerId: sellerKey.offerId, status: sellerKey.status, n: sql<number>`count(*)::int` }).from(sellerKey).where(inArray(sellerKey.offerId, offerIds)).groupBy(sellerKey.offerId, sellerKey.status);
  for (const r of rows) { const c = out.get(r.offerId) ?? { stock: 0, sold: 0 }; if (r.status === "in_stock") c.stock += r.n; if (r.status === "sold") c.sold += r.n; out.set(r.offerId, c); }
  return out;
}
// Lowest price of everyone else for these products, in USD cents: other sellers' active offers with keys in stock + CoreCart's own price (THB → USD at today's rate).
export async function lowestOther(productIds: string[], exceptSeller: string | null): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!productIds.length) return out;
  const rows = await db.select({ productId: sellerOffer.productId, min: sql<number>`min(${sellerOffer.priceUsdCents})::int` }).from(sellerOffer)
    .where(and(inArray(sellerOffer.productId, productIds), eq(sellerOffer.active, true), exceptSeller ? ne(sellerOffer.sellerId, exceptSeller) : undefined,
      sql`exists (select 1 from ${sellerKey} where ${sellerKey.offerId} = ${sellerOffer.id} and ${sellerKey.status} = 'in_stock')`))
    .groupBy(sellerOffer.productId);
  for (const r of rows) out.set(r.productId, r.min);
  const cur = await publicCurrencies();
  const usd = cur.currencies.find((c) => c.code === "USD") ?? USD_RATE;
  for (const id of productIds) {
    const p = productById(id); if (!p || p.soldOut) continue;
    const own = convertMinor(p.price, cur.base, usd);
    if (!out.has(id) || own < out.get(id)!) out.set(id, own);
  }
  return out;
}
// The seller's offers, newest first. withLowest = also the lowest other price (My offers, New offer).
export async function sellerOffers(userId: string, withLowest = true): Promise<SellerOffer[]> {
  await ensureCatalog();
  const rows = await db.select().from(sellerOffer).where(eq(sellerOffer.sellerId, userId)).orderBy(desc(sellerOffer.createdAt));
  const stock = await stockOf(rows.map((r) => r.id));
  const low = withLowest ? await lowestOther([...new Set(rows.map((r) => r.productId))], userId) : new Map<string, number>();
  return rows.map((r) => offerOut(r, stock.get(r.id), low.get(r.productId) ?? null));
}
const offerOut = (r: typeof sellerOffer.$inferSelect, c: { stock: number; sold: number } | undefined, lowest: number | null): SellerOffer => ({
  id: r.id, productId: r.productId, priceUsdCents: r.priceUsdCents, active: r.active, status: offerStatus(r.active, c?.stock ?? 0), stock: c?.stock ?? 0, sold: c?.sold ?? 0,
  lowestOtherUsdCents: lowest, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });
async function oneOffer(userId: string, id: string) {
  const [r] = await db.select().from(sellerOffer).where(and(eq(sellerOffer.id, id), eq(sellerOffer.sellerId, userId))).limit(1);
  return r ?? null;
}
async function offerById(userId: string, id: string) {
  const r = await oneOffer(userId, id); if (!r) return null;
  return offerOut(r, (await stockOf([r.id])).get(r.id), (await lowestOther([r.productId], userId)).get(r.productId) ?? null);
}
// Only published game keys from the catalog can be sold.
async function sellable(productId: string) {
  await ensureCatalog();
  const p = productById(productId);
  if (!p) return fail(MARKET_ERRORS.product, 404);
  if (p.kind !== "game_key") return fail(MARKET_ERRORS.notKeyProduct);
  return p;
}

// New offer: product + price; keys (optional) are added in the same call. One offer per seller and product.
export async function createOffer(userId: string, productId: string, priceUsdCents: number, text: string): Promise<{ ok: true; offer: SellerOffer; keys: KeyAddResult | null } | Fail> {
  const p = await sellable(productId); if ("ok" in p) return p;
  if (text.trim()) { const c = checkKeyText(text, p.platform); if (c.tooMany) return fail(MARKET_ERRORS.tooMany); }
  const [row] = await db.insert(sellerOffer).values({ id: crypto.randomUUID(), sellerId: userId, productId, priceUsdCents }).onConflictDoNothing().returning();
  if (!row) return fail(MARKET_ERRORS.offerExists, 409);
  const keys = text.trim() ? await addSellerKeys(userId, row.id, text) : null;
  if (keys && !keys.ok) return keys;
  return { ok: true, offer: (await offerById(userId, row.id))!, keys: keys && keys.ok ? keys.result : null };
}
// Edit price and / or pause / resume.
export async function updateOffer(userId: string, id: string, patch: { priceUsdCents?: number; active?: boolean }): Promise<{ ok: true; offer: SellerOffer } | Fail> {
  const set: Partial<typeof sellerOffer.$inferInsert> = { updatedAt: new Date() };
  if (patch.priceUsdCents !== undefined) set.priceUsdCents = patch.priceUsdCents;
  if (patch.active !== undefined) set.active = patch.active;
  const r = await db.update(sellerOffer).set(set).where(and(eq(sellerOffer.id, id), eq(sellerOffer.sellerId, userId))).returning({ id: sellerOffer.id });
  if (!r.length) return fail(MARKET_ERRORS.offerNotFound, 404);
  return { ok: true, offer: (await offerById(userId, id))! };
}

// ---------- Seller keys ----------
function cryptoKey() { const k = encryptionKey(); if (!k) throw new Error(MARKET_ERRORS.config); return k; }
async function knownHashes(hashes: string[]) {
  const out = new Set<string>();
  for (let i = 0; i < hashes.length; i += 500) {
    const part = hashes.slice(i, i + 500); if (!part.length) continue;
    for (const r of await db.select({ h: keyRegistry.codeHash }).from(keyRegistry).where(inArray(keyRegistry.codeHash, part))) out.add(r.h);
  }
  return out;
}
// Check only (the "Check before saving" box): format, duplicates in the list, already in CoreCart. Nothing is stored.
export async function checkSellerKeys(productId: string, text: string): Promise<{ ok: true; report: KeyReport } | Fail> {
  const p = await sellable(productId); if ("ok" in p) return p;
  const key = encryptionKey(); if (!key) return fail(MARKET_ERRORS.config, 500);
  const c = checkKeyText(text, p.platform);
  const known = await knownHashes(c.ok.map((k) => hmacOf(key, k.code)));
  return { ok: true, report: keyReport(markExisting(c, (code) => known.has(hmacOf(key, code)))) };
}
// Adds new keys to an offer. Each code is claimed in key_registry first (insert … on conflict do nothing) inside the same transaction as
// the seller_key row, so a code held anywhere in CoreCart — or uploaded by someone else at the same moment — is refused, never stored twice.
export async function addSellerKeys(userId: string, offerId: string, text: string): Promise<{ ok: true; result: KeyAddResult } | Fail> {
  const offer = await oneOffer(userId, offerId); if (!offer) return fail(MARKET_ERRORS.offerNotFound, 404);
  const p = productById(offer.productId);
  const c: KeyCheck = checkKeyText(text, p?.platform);
  if (c.tooMany) return fail(MARKET_ERRORS.tooMany);
  if (!c.ok.length && !c.invalid.length && !c.duplicates.length) return fail(MARKET_ERRORS.noKeys);
  const key = cryptoKey();
  const rows = c.ok.map((k) => ({ ...k, id: crypto.randomUUID(), hash: hmacOf(key, k.code) }));
  const taken = new Set<string>(); // codes CoreCart already holds
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    await db.transaction(async (tx) => {
      const claimed = new Set((await tx.insert(keyRegistry).values(part.map((r) => ({ codeHash: r.hash, source: "seller", keyId: r.id }))).onConflictDoNothing().returning({ h: keyRegistry.codeHash })).map((r) => r.h));
      const fresh = part.filter((r) => claimed.has(r.hash));
      part.filter((r) => !claimed.has(r.hash)).forEach((r) => taken.add(r.code));
      if (fresh.length) await tx.insert(sellerKey).values(fresh.map((r) => ({ id: r.id, offerId, sellerId: userId, codeEnc: encryptText(key, r.code), codeHash: r.hash, last4: r.code.slice(-4) })));
    });
  }
  const done = markExisting(c, (code) => taken.has(code));
  if (done.ok.length) await db.update(sellerOffer).set({ updatedAt: new Date() }).where(eq(sellerOffer.id, offerId));
  return { ok: true, result: { added: done.ok.length, report: keyReport(done) } };
}

// ---------- Product requests ----------
const requestOut = (r: typeof productRequest.$inferSelect): ProductRequest => ({ id: r.id, number: requestNumber(r.seq), name: r.name, platform: r.platform, region: r.region, edition: r.edition, link: r.link, note: r.note,
  status: r.status as RequestStatus, productId: r.productId, reason: r.reason, createdAt: r.createdAt.toISOString(), decidedAt: iso(r.decidedAt) });
export async function myRequests(userId: string): Promise<ProductRequest[]> {
  return (await db.select().from(productRequest).where(eq(productRequest.sellerId, userId)).orderBy(desc(productRequest.createdAt)).limit(100)).map(requestOut);
}
// Send a request. The catalog search runs again first: a match = 409 "already in the catalog — sell it" with its product id.
export async function createRequest(userId: string, input: RequestInput): Promise<{ ok: true; request: ProductRequest } | Fail> {
  await ensureCatalog();
  const match = catalogMatch(allProducts(), input);
  if (match) return fail(MARKET_ERRORS.inCatalog, 409, { productId: match.id });
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`corecart:product-request:${userId}`}))`); // open-request count + insert as one step per seller
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(productRequest).where(and(eq(productRequest.sellerId, userId), eq(productRequest.status, "waiting")));
    if (n >= OPEN_REQUESTS_MAX) return fail(MARKET_ERRORS.requestsOpen, 409);
    const [row] = await tx.insert(productRequest).values({ id: crypto.randomUUID(), sellerId: userId, ...input, nameKey: nameKey(input.name) }).returning();
    await tx.insert(productRequestEvent).values({ id: crypto.randomUUID(), requestId: row.id, adminId: null, action: "sent", detail: "" });
    return { ok: true as const, request: requestOut(row) };
  });
}

// ---------- Admin: Product requests (step 3, section "products") ----------
const reqSeller = alias(user, "req_seller");
const reqAdmin = alias(user, "req_admin");
async function adminRows(where: ReturnType<typeof eq> | undefined): Promise<AdminRequestRow[]> {
  const rows = await db.select({ r: productRequest, sName: reqSeller.name, sEmail: reqSeller.email, sVerified: reqSeller.emailVerified, store: sellerStore.name, decider: reqAdmin.email })
    .from(productRequest).innerJoin(reqSeller, eq(reqSeller.id, productRequest.sellerId)).leftJoin(sellerStore, eq(sellerStore.userId, productRequest.sellerId))
    .leftJoin(reqAdmin, eq(reqAdmin.id, productRequest.decidedBy)).where(where).orderBy(desc(productRequest.createdAt)).limit(200);
  if (!rows.length) return [];
  // Other waiting requests with the same name (grouping column) + every row's history.
  const keys = [...new Set(rows.map((x) => x.r.nameKey))];
  const waiting = await db.select({ id: productRequest.id, seq: productRequest.seq, nameKey: productRequest.nameKey, name: productRequest.name, platform: productRequest.platform, region: productRequest.region, sellerId: productRequest.sellerId, store: sellerStore.name, sName: reqSeller.name })
    .from(productRequest).innerJoin(reqSeller, eq(reqSeller.id, productRequest.sellerId)).leftJoin(sellerStore, eq(sellerStore.userId, productRequest.sellerId))
    .where(and(eq(productRequest.status, "waiting"), inArray(productRequest.nameKey, keys)));
  const events = await db.select({ e: productRequestEvent, by: reqAdmin.email }).from(productRequestEvent).leftJoin(reqAdmin, eq(reqAdmin.id, productRequestEvent.adminId))
    .where(inArray(productRequestEvent.requestId, rows.map((x) => x.r.id))).orderBy(productRequestEvent.createdAt);
  return rows.map(({ r, sName, sEmail, sVerified, store, decider }) => {
    const group = requestGroup(r); const others = waiting.filter((w) => w.id !== r.id && w.nameKey === r.nameKey);
    const same = others.filter((w) => requestGroup(w) === group);
    return { ...requestOut(r), seller: { id: r.sellerId, name: store ?? sName, email: sEmail, verified: sVerified }, decidedBy: r.decidedBy ? decider ?? "Deleted admin" : null,
      same: { sellers: [...new Set(same.map((w) => w.store ?? w.sName))], numbers: same.map((w) => requestNumber(w.seq)), otherVariants: others.length - same.length },
      events: events.filter((x) => x.e.requestId === r.id).map(({ e, by }) => ({ action: e.action, detail: e.detail, by: e.adminId ? by ?? "Deleted admin" : null, createdAt: e.createdAt.toISOString() })) };
  });
}
export async function adminRequests(tab: RequestStatus): Promise<AdminRequestList> {
  const n = await db.select({ status: productRequest.status, n: sql<number>`count(*)::int` }).from(productRequest).groupBy(productRequest.status);
  const counts = Object.fromEntries(REQUEST_TABS.map((t) => [t, n.find((x) => x.status === t)?.n ?? 0])) as Record<RequestStatus, number>;
  return { counts, rows: await adminRows(eq(productRequest.status, tab)) };
}
export const adminRequest = async (id: string) => (await adminRows(eq(productRequest.id, id)))[0] ?? null;

// add / link: the product must be a published game key; every waiting request for the same product (name + platform + region) becomes
// Added with it, one history row each, and every seller gets the "Sell it ›" email. reject: this request only, reason → seller.
export async function decideRequest(adminId: string, id: string, action: RequestAction, input: { productId?: string; reason?: string }): Promise<{ ok: true; closed: string[] } | Fail> {
  await ensureCatalog();
  const p = action === "reject" ? null : productById(input.productId ?? "");
  if (action !== "reject" && (!p || p.kind !== "game_key")) return fail(ADMIN_REQUEST_ERRORS.product);
  const reason = (input.reason ?? "").trim();
  const res = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(productRequest).where(eq(productRequest.id, id)).for("update");
    if (!r) return fail(MARKET_ERRORS.requestNotFound, 404);
    if (r.status !== "waiting") return fail(MARKET_ERRORS.requestClosed, 409);
    const now = new Date();
    let list = [r];
    if (p) {
      const group = requestGroup(r);
      const same = await tx.select().from(productRequest).where(and(eq(productRequest.status, "waiting"), eq(productRequest.nameKey, r.nameKey), ne(productRequest.id, r.id))).for("update");
      list = [r, ...same.filter((x) => requestGroup(x) === group)];
    }
    const ids = list.map((x) => x.id);
    await tx.update(productRequest).set(p ? { status: "added", productId: p.id, reason: null, decidedBy: adminId, decidedAt: now } : { status: "rejected", reason, decidedBy: adminId, decidedAt: now }).where(inArray(productRequest.id, ids));
    const detail = (x: typeof r) => (p ? `${productTitle(p)} (${p.id})${x.id === r.id ? "" : ` · with ${requestNumber(r.seq)}`}` : reason);
    await tx.insert(productRequestEvent).values(list.map((x) => ({ id: crypto.randomUUID(), requestId: x.id, adminId, action: p ? (action === "add" ? "added" : "linked") : "rejected", detail: detail(x) })));
    const people = await tx.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, [...new Set(list.map((x) => x.sellerId))]));
    return { ok: true as const, list, people };
  });
  if (!res.ok) return res;
  for (const x of res.list) {
    const who = res.people.find((u) => u.id === x.sellerId); const asked = requestLine(x);
    if (p) await sendTemplate(who?.email, "requestAdded", { name: who?.name ?? "", number: requestNumber(x.seq), asked, product: productTitle(p), productId: p.id });
    else await sendTemplate(who?.email, "requestRejected", { name: who?.name ?? "", number: requestNumber(x.seq), asked, reason });
  }
  return { ok: true, closed: res.list.map((x) => requestNumber(x.seq)) };
}
