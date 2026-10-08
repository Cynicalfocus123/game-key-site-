import { convertMinor } from "@/lib/currency/money";
import { holdActive } from "@/lib/sellers";
import { USD_RATE } from "@/lib/topup";
import { catalogMatch, checkKeyText, keyReport, lowStockOk, markExisting, MARKET_ERRORS, nameKey, OFFER_WRITE_LIMIT, offerStatus, OPEN_REQUESTS_MAX, parseRequest, priceOk, REQUEST_LIMIT,
  requestNumber, SELLER_KEY_LIMIT, slugify, type KeyCheck, type ProductRequest, type SellerOffer, type SellerStore } from "@/lib/marketplace";
import { demoCurrencies } from "./demo-currency";
import { demoCatalogAll } from "./demo-catalog";
import { demoMarketCtx } from "./demo-api";
import type { MarketApi } from "./types";

// GitHub Pages demo of the seller marketplace: same rules + messages as lib/server/marketplace.ts, data in this browser only
// (`corecart-demo-v1`.market). Keys are kept plain here (the server encrypts them); only line numbers and counts leave this module.
type DStore = { userId: string; slug: string; name: string; invoices: boolean; lowStockAt: number };
type DOffer = { id: string; sellerId: string; productId: string; priceUsdCents: number; active: boolean; clicks: number; createdAt: string; updatedAt: string };
type DKey = { id: string; offerId: string; sellerId: string; code: string; status: "in_stock" | "reserved" | "sold" | "removed"; createdAt: string };
type DRequest = Omit<ProductRequest, "number"> & { seq: number; sellerId: string; nameKey: string; decidedBy: string | null };
type DEvent = { requestId: string; adminId: string | null; action: string; detail: string; createdAt: string };
export type DemoMarket = { stores: DStore[]; offers: DOffer[]; keys: DKey[]; requests: DRequest[]; requestEvents: DEvent[] };

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const tries: Record<string, number[]> = {}; // same limits as the server (per page load here)
function hit(key: string, lim: { max: number; windowMs: number }) {
  const t = Date.now(); const list = (tries[key] ??= []); while (list.length && t - list[0] > lim.windowMs) list.shift();
  if (list.length >= lim.max) return false; list.push(t); return true;
}
const published = () => demoCatalogAll().filter((p) => p.status !== "draft");
const productOf = (id: string) => published().find((p) => p.id === id);
export function marketOf(s: { market?: unknown }): DemoMarket {
  const m = (s.market ??= {}) as Partial<DemoMarket>;
  m.stores ??= []; m.offers ??= []; m.keys ??= []; m.requests ??= []; m.requestEvents ??= [];
  return m as DemoMarket;
}
type Ctx = ReturnType<typeof demoMarketCtx> & { m: DemoMarket; store: DStore; since: string | null; holdUntil: string | null };
// Approved seller only (same 401 / 403 texts as the API).
function seller(): Ctx | { ok: false; error: string } {
  const c = demoMarketCtx();
  if (!c.user) return { ok: false, error: "Not signed in" };
  if (!c.user.emailVerified || !c.app || c.app.status !== "approved") return { ok: false, error: MARKET_ERRORS.notSeller };
  const m = marketOf(c.s); let store = m.stores.find((x) => x.userId === c.user!.id);
  if (!store) {
    const base = slugify(c.app.merchantName); let slug = base;
    for (let n = 2; m.stores.some((x) => x.slug === slug); n++) slug = `${base.slice(0, 36)}-${n}`;
    store = { userId: c.user.id, slug, name: c.app.merchantName, invoices: false, lowStockAt: 10 }; m.stores.push(store); c.save();
  }
  return { ...c, m, store, since: c.app.decidedAt, holdUntil: holdActive(c.app.hold) ? c.app.hold!.until : null };
}
const storeOut = (c: Ctx): SellerStore => ({ slug: c.store.slug, name: c.store.name, invoices: c.store.invoices, lowStockAt: c.store.lowStockAt, since: c.since });
async function lowestOther(m: DemoMarket, productIds: string[], except: string) {
  const out = new Map<string, number>();
  for (const o of m.offers) {
    if (!productIds.includes(o.productId) || o.sellerId === except || !o.active || !m.keys.some((k) => k.offerId === o.id && k.status === "in_stock")) continue;
    if (!out.has(o.productId) || o.priceUsdCents < out.get(o.productId)!) out.set(o.productId, o.priceUsdCents);
  }
  const cur = await demoCurrencies(); const usd = cur.currencies.find((c) => c.code === "USD") ?? USD_RATE;
  for (const id of productIds) { const p = productOf(id); if (!p || p.soldOut) continue; const own = convertMinor(p.price, cur.base, usd); if (!out.has(id) || own < out.get(id)!) out.set(id, own); }
  return out;
}
function offerOut(m: DemoMarket, o: DOffer, lowest: number | null): SellerOffer {
  const mine = m.keys.filter((k) => k.offerId === o.id); const stock = mine.filter((k) => k.status === "in_stock").length;
  return { id: o.id, productId: o.productId, priceUsdCents: o.priceUsdCents, active: o.active, status: offerStatus(o.active, stock), stock, sold: mine.filter((k) => k.status === "sold").length,
    lowestOtherUsdCents: lowest, createdAt: o.createdAt, updatedAt: o.updatedAt };
}
async function offersOf(c: Ctx) {
  const mine = c.m.offers.filter((o) => o.sellerId === c.store.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const low = await lowestOther(c.m, [...new Set(mine.map((o) => o.productId))], c.store.userId);
  return mine.map((o) => offerOut(c.m, o, low.get(o.productId) ?? null));
}
// Every code CoreCart holds: admin keys + seller keys of every seller in this browser.
const known = (c: Ctx) => { const all = new Set(c.adminCodes); c.m.keys.forEach((k) => all.add(k.code)); return all; };
function addKeys(c: Ctx, o: DOffer, text: string) {
  const ch: KeyCheck = checkKeyText(text, productOf(o.productId)?.platform);
  if (ch.tooMany) return { ok: false as const, error: MARKET_ERRORS.tooMany };
  if (!ch.ok.length && !ch.invalid.length && !ch.duplicates.length) return { ok: false as const, error: MARKET_ERRORS.noKeys };
  const have = known(c); const done = markExisting(ch, (code) => have.has(code)); const at = now();
  c.m.keys.push(...done.ok.map((k) => ({ id: uid(), offerId: o.id, sellerId: c.store.userId, code: k.code, status: "in_stock" as const, createdAt: at })));
  if (done.ok.length) o.updatedAt = at;
  return { ok: true as const, result: { added: done.ok.length, report: keyReport(done) } };
}
const requestOut = ({ seq, sellerId: _s, nameKey: _n, decidedBy: _d, ...r }: DRequest): ProductRequest => ({ ...r, number: requestNumber(seq) });

export const demoMarketApi: MarketApi = {
  async home() {
    const c = seller(); if ("ok" in c) return c;
    const offers = await offersOf(c);
    return { ok: true, home: { store: storeOut(c), holdUntil: c.holdUntil, tiles: { availableUsdCents: 0, incomeUsdCents7: 0, sales7: 0, activeOffers: offers.filter((o) => o.status === "active").length } } }; // no demo orders from sellers yet
  },
  async saveStore(patch) {
    const c = seller(); if ("ok" in c) return c;
    if (patch.lowStockAt !== undefined && !lowStockOk(patch.lowStockAt)) return { ok: false, error: MARKET_ERRORS.lowStock };
    if (!hit(`w:${c.store.userId}`, OFFER_WRITE_LIMIT)) return { ok: false, error: MARKET_ERRORS.writeLimit };
    if (patch.invoices !== undefined) c.store.invoices = patch.invoices;
    if (patch.lowStockAt !== undefined) c.store.lowStockAt = patch.lowStockAt;
    c.save(); return { ok: true, store: storeOut(c) };
  },
  async offers() { const c = seller(); if ("ok" in c) return c; return { ok: true, offers: await offersOf(c) }; },
  async createOffer({ productId, priceUsdCents, keys }) {
    const c = seller(); if ("ok" in c) return c;
    if (!productId) return { ok: false, error: MARKET_ERRORS.product };
    if (!priceOk(priceUsdCents)) return { ok: false, error: MARKET_ERRORS.price };
    if (!hit(`w:${c.store.userId}`, OFFER_WRITE_LIMIT)) return { ok: false, error: MARKET_ERRORS.writeLimit };
    if (keys.trim() && !hit(`k:${c.store.userId}`, SELLER_KEY_LIMIT)) return { ok: false, error: MARKET_ERRORS.limit };
    const p = productOf(productId); if (!p) return { ok: false, error: MARKET_ERRORS.product }; if (p.kind !== "game_key") return { ok: false, error: MARKET_ERRORS.notKeyProduct };
    if (keys.trim() && checkKeyText(keys, p.platform).tooMany) return { ok: false, error: MARKET_ERRORS.tooMany };
    if (c.m.offers.some((o) => o.sellerId === c.store.userId && o.productId === productId)) return { ok: false, error: MARKET_ERRORS.offerExists };
    const o: DOffer = { id: uid(), sellerId: c.store.userId, productId, priceUsdCents, active: true, clicks: 0, createdAt: now(), updatedAt: now() }; c.m.offers.push(o);
    const added = keys.trim() ? addKeys(c, o, keys) : null; if (added && !added.ok) { c.save(); return added; }
    c.save(); const low = await lowestOther(c.m, [productId], c.store.userId);
    return { ok: true, offer: offerOut(c.m, o, low.get(productId) ?? null), keys: added ? added.result : null };
  },
  async updateOffer(id, patch) {
    const c = seller(); if ("ok" in c) return c;
    if (patch.priceUsdCents !== undefined && !priceOk(patch.priceUsdCents)) return { ok: false, error: MARKET_ERRORS.price };
    if (patch.priceUsdCents === undefined && patch.active === undefined) return { ok: false, error: "Nothing to change" };
    if (!hit(`w:${c.store.userId}`, OFFER_WRITE_LIMIT)) return { ok: false, error: MARKET_ERRORS.writeLimit };
    const o = c.m.offers.find((x) => x.id === id && x.sellerId === c.store.userId); if (!o) return { ok: false, error: MARKET_ERRORS.offerNotFound };
    if (patch.priceUsdCents !== undefined) o.priceUsdCents = patch.priceUsdCents;
    if (patch.active !== undefined) o.active = patch.active;
    o.updatedAt = now(); c.save(); const low = await lowestOther(c.m, [o.productId], c.store.userId);
    return { ok: true, offer: offerOut(c.m, o, low.get(o.productId) ?? null) };
  },
  async checkKeys(productId, text) {
    const c = seller(); if ("ok" in c) return c;
    if (!hit(`k:${c.store.userId}`, SELLER_KEY_LIMIT)) return { ok: false, error: MARKET_ERRORS.limit };
    const p = productOf(productId); if (!p) return { ok: false, error: MARKET_ERRORS.product }; if (p.kind !== "game_key") return { ok: false, error: MARKET_ERRORS.notKeyProduct };
    const have = known(c); return { ok: true, report: keyReport(markExisting(checkKeyText(text, p.platform), (code) => have.has(code))) };
  },
  async addKeys(offerId, text) {
    const c = seller(); if ("ok" in c) return c;
    if (!hit(`k:${c.store.userId}`, SELLER_KEY_LIMIT)) return { ok: false, error: MARKET_ERRORS.limit };
    const o = c.m.offers.find((x) => x.id === offerId && x.sellerId === c.store.userId); if (!o) return { ok: false, error: MARKET_ERRORS.offerNotFound };
    const r = addKeys(c, o, text); c.save(); return r;
  },
  async requests() {
    const c = seller(); if ("ok" in c) return c;
    return { ok: true, requests: c.m.requests.filter((r) => r.sellerId === c.store.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map(requestOut) };
  },
  async sendRequest(input) {
    const c = seller(); if ("ok" in c) return c;
    const p = parseRequest(input as unknown as Record<string, unknown>); if (!p.ok) return { ok: false, error: "Check the form.", errors: p.errors };
    if (!hit(`r:${c.store.userId}`, REQUEST_LIMIT)) return { ok: false, error: MARKET_ERRORS.requestLimit };
    const match = catalogMatch(published(), p.input); if (match) return { ok: false, error: MARKET_ERRORS.inCatalog, productId: match.id };
    if (c.m.requests.filter((r) => r.sellerId === c.store.userId && r.status === "waiting").length >= OPEN_REQUESTS_MAX) return { ok: false, error: MARKET_ERRORS.requestsOpen };
    const seq = 1001 + c.m.requests.length;
    const r: DRequest = { ...p.input, id: uid(), seq, sellerId: c.store.userId, nameKey: nameKey(p.input.name), status: "waiting", productId: null, reason: null, createdAt: now(), decidedAt: null, decidedBy: null };
    c.m.requests.push(r); c.m.requestEvents.push({ requestId: r.id, adminId: null, action: "sent", detail: "", createdAt: r.createdAt }); c.save();
    return { ok: true, request: requestOut(r) };
  },
};
