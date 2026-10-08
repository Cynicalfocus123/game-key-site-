import { convertMinor } from "@/lib/currency/money";
import { maxQty, type CartEntry } from "@/lib/catalog";
import { CORECART_SELLER } from "@/lib/orders";
import { checkLogo, dataUrlBytes, bytesDataUrl, LOGO_ERRORS, LOGO_LIMIT } from "@/lib/seller-logo";
import { holdActive } from "@/lib/sellers";
import { USD_RATE } from "@/lib/topup";
import { ADMIN_REQUEST_ERRORS, catalogMatch, checkKeyText, keyReport, lowStockOk, markExisting, MARKET_ERRORS, nameKey, OFFER_WRITE_LIMIT, offerStatus, OPEN_REQUESTS_MAX, parseRequest, priceOk, productTitle, reasonOk,
  REQUEST_ADMIN_LIMIT, REQUEST_LIMIT, REQUEST_TABS, requestGroup, requestLine, requestNumber, SELLER_KEY_LIMIT, slugify, CORECART_STORE, isTrusted, MAX_PER_OFFER, OWN_OFFER, TRUSTED_DAYS,
  type OfferQuote, type PublicOffer, type PublicSeller, type AdminRequestRow, type KeyCheck, type ProductRequest, type RequestStatus, type SellerOffer, type SellerStore } from "@/lib/marketplace";
import { demoCurrencies } from "./demo-currency";
import { demoCatalogAll } from "./demo-catalog";
import { demoAdminMarketCtx, demoMarketCtx, demoPublicMarketCtx } from "./demo-api";
import type { AdminMarketApi, MarketApi, PublicMarketApi } from "./types";

// GitHub Pages demo of the seller marketplace: same rules + messages as lib/server/marketplace.ts, data in this browser only
// (`corecart-demo-v1`.market). Keys are kept plain here (the server encrypts them); only line numbers and counts leave this module.
// logo = data URL of the checked WebP / AVIF (step 4; the server keeps a file instead).
type DStore = { userId: string; slug: string; name: string; invoices: boolean; lowStockAt: number; logo?: { dataUrl: string; at: string } | null };
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
const storeOut = (c: Ctx): SellerStore => ({ slug: c.store.slug, name: c.store.name, invoices: c.store.invoices, lowStockAt: c.store.lowStockAt, since: c.since, logo: c.store.logo?.dataUrl ?? null });
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
  async saveLogo(dataUrl) {
    const c = seller(); if ("ok" in c) return c;
    const bytes = dataUrlBytes(dataUrl); if (!bytes) return { ok: false, error: dataUrl.length > 1_500_000 ? LOGO_ERRORS.big : LOGO_ERRORS.type };
    if (!hit(`logo:${c.store.userId}`, LOGO_LIMIT)) return { ok: false, error: LOGO_ERRORS.limit };
    const ch = checkLogo(bytes); if (!ch.ok) return { ok: false, error: ch.error };
    c.store.logo = { dataUrl: bytesDataUrl(bytes, ch.info.type), at: now() };
    if (!c.save()) { c.store.logo = null; return { ok: false, error: "Could not save in this browser (storage full)." }; }
    return { ok: true, store: storeOut(c) };
  },
  async removeLogo() {
    const c = seller(); if ("ok" in c) return c;
    if (!hit(`logo:${c.store.userId}`, LOGO_LIMIT)) return { ok: false, error: LOGO_ERRORS.limit };
    c.store.logo = null; c.save(); return { ok: true, store: storeOut(c) };
  },
};

// ---------- Admin: Product requests (same rules as lib/server/marketplace.ts adminRequests / decideRequest) ----------
type ACtx = Extract<ReturnType<typeof demoAdminMarketCtx>, { ok: true }>;
function adminRow(c: ACtx, m: DemoMarket, r: DRequest): AdminRequestRow {
  const who = (id: string | null) => (id ? c.users.find((u) => u.id === id)?.email ?? "Deleted admin" : null);
  const storeName = (sellerId: string) => m.stores.find((x) => x.userId === sellerId)?.name ?? c.users.find((u) => u.id === sellerId)?.name ?? "";
  const seller = c.users.find((u) => u.id === r.sellerId);
  const others = m.requests.filter((w) => w.status === "waiting" && w.id !== r.id && nameKey(w.name) === nameKey(r.name)); const same = others.filter((w) => requestGroup(w) === requestGroup(r));
  return { ...requestOut(r), seller: { id: r.sellerId, name: storeName(r.sellerId), email: seller?.email ?? "", verified: Boolean(seller?.emailVerified) }, decidedBy: who(r.decidedBy),
    same: { sellers: [...new Set(same.map((w) => storeName(w.sellerId)))], numbers: same.map((w) => requestNumber(w.seq)), otherVariants: others.length - same.length },
    events: m.requestEvents.filter((e) => e.requestId === r.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((e) => ({ action: e.action, detail: e.detail, by: who(e.adminId), createdAt: e.createdAt })) };
}
const adminTries: number[] = []; // same per-admin limit as the server (per page load here)
export const demoAdminMarketApi: AdminMarketApi = {
  async requests(tab) {
    const c = demoAdminMarketCtx("products"); if (!c.ok) return c; const m = marketOf(c.s);
    const counts = Object.fromEntries(REQUEST_TABS.map((t) => [t, m.requests.filter((r) => r.status === t).length])) as Record<RequestStatus, number>;
    const rows = m.requests.filter((r) => r.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200).map((r) => adminRow(c, m, r));
    return { ok: true, data: { counts, rows } };
  },
  async request(id) {
    const c = demoAdminMarketCtx("products"); if (!c.ok) return c; const m = marketOf(c.s);
    const r = m.requests.find((x) => x.id === id); return r ? { ok: true, request: adminRow(c, m, r) } : { ok: false, error: MARKET_ERRORS.requestNotFound };
  },
  async decideRequest(id, { action, productId, reason = "" }) {
    const c = demoAdminMarketCtx("products"); if (!c.ok) return c; const m = marketOf(c.s);
    if (action === "reject" && !reasonOk(reason)) return { ok: false, error: MARKET_ERRORS.reason };
    const t = Date.now(); while (adminTries.length && t - adminTries[0] > REQUEST_ADMIN_LIMIT.windowMs) adminTries.shift();
    if (adminTries.length >= REQUEST_ADMIN_LIMIT.max) return { ok: false, error: "Too many changes. Wait a minute." }; adminTries.push(t);
    const p = action === "reject" ? null : productOf(productId ?? "");
    if (action !== "reject" && (!p || p.kind !== "game_key")) return { ok: false, error: ADMIN_REQUEST_ERRORS.product };
    const r = m.requests.find((x) => x.id === id); if (!r) return { ok: false, error: MARKET_ERRORS.requestNotFound };
    if (r.status !== "waiting") return { ok: false, error: MARKET_ERRORS.requestClosed };
    const list = p ? [r, ...m.requests.filter((x) => x.status === "waiting" && x.id !== r.id && requestGroup(x) === requestGroup(r))] : [r]; const at = now();
    for (const x of list) {
      Object.assign(x, p ? { status: "added", productId: p.id, reason: null } : { status: "rejected", reason: reason.trim() }, { decidedBy: c.me.id, decidedAt: at });
      m.requestEvents.push({ requestId: x.id, adminId: c.me.id, action: p ? (action === "add" ? "added" : "linked") : "rejected", detail: p ? `${productTitle(p)} (${p.id})${x.id === r.id ? "" : ` · with ${requestNumber(r.seq)}`}` : reason.trim(), createdAt: at });
      const who = c.users.find((u) => u.id === x.sellerId);
      if (p) c.mail(who?.email, "requestAdded", { name: who?.name ?? "", number: requestNumber(x.seq), asked: requestLine(x), product: productTitle(p), productId: p.id });
      else c.mail(who?.email, "requestRejected", { name: who?.name ?? "", number: requestNumber(x.seq), asked: requestLine(x), reason: reason.trim() });
    }
    c.save(); return { ok: true, closed: list.map((x) => requestNumber(x.seq)) };
  },
};

// ---------- Buyer side (step 4): same rules as lib/server/marketplace.ts publicOffers / offerQuotes / publicStore ----------
type PCtx = ReturnType<typeof demoPublicMarketCtx>;
async function usdToBase() {
  const cur = await demoCurrencies(); const usd = cur.currencies.find((c) => c.code === "USD") ?? USD_RATE;
  return (cents: number) => convertMinor(cents, usd, cur.base);
}
function ratingOf(c: PCtx, name: string) {
  const list = c.ratings.filter((r) => r.seller === name); if (!list.length) return undefined;
  const since = Date.now() - TRUSTED_DAYS * 86_400_000;
  return { average: Math.round((list.reduce((t, r) => t + r.stars, 0) / list.length) * 10) / 10, count: list.length, recentFive: list.filter((r) => r.stars === 5 && Date.parse(r.updatedAt) >= since).length };
}
const publicSeller = (name: string, slug: string, logo: string | null, since: string | null, own: boolean, r?: { average: number; count: number; recentFive: number }): PublicSeller =>
  ({ slug, name, logo, verified: true, trusted: isTrusted(r?.recentFive ?? 0), rating: r && r.count ? { average: r.average, count: r.count } : null, since, own });
// Visible offers with keys in stock (seller approved, no hold, account open).
function liveOffers(c: PCtx, m: DemoMarket, keep: (o: DOffer) => boolean) {
  const out: { o: DOffer; stock: number; store: DStore; since: string | null }[] = [];
  for (const o of m.offers) {
    if (!o.active || !keep(o)) continue;
    const stock = m.keys.filter((k) => k.offerId === o.id && k.status === "in_stock").length; if (!stock) continue;
    const vis = c.seller(o.sellerId); const store = m.stores.find((x) => x.userId === o.sellerId); if (!vis || !store) continue;
    out.push({ o, stock, store, since: vis.since });
  }
  return out;
}
export const demoPublicMarketApi: PublicMarketApi = {
  async offers(productId) {
    const c = demoPublicMarketCtx(); const m = marketOf(c.s); const p = productOf(productId);
    if (!p || p.kind !== "game_key") return { ok: true, offers: [] };
    const live = liveOffers(c, m, (o) => o.productId === productId); if (!live.length) return { ok: true, offers: [] };
    const toBase = await usdToBase();
    const offers: PublicOffer[] = live.map(({ o, stock, store, since }) => ({ id: o.id, productId, priceUsdCents: o.priceUsdCents, unit: toBase(o.priceUsdCents), max: Math.min(stock, MAX_PER_OFFER),
      seller: publicSeller(store.name, store.slug, store.logo?.dataUrl ?? null, since, false, ratingOf(c, store.name)) }));
    if (maxQty(p) > 0) offers.push({ id: OWN_OFFER, productId, priceUsdCents: null, unit: p.price, max: maxQty(p), seller: publicSeller(CORECART_STORE.name, CORECART_STORE.slug, null, null, true, ratingOf(c, CORECART_SELLER)) });
    return { ok: true, offers };
  },
  async quotes(ids) {
    const c = demoPublicMarketCtx(); const m = marketOf(c.s); const want = new Set(ids.slice(0, 50)); const toBase = await usdToBase();
    return { ok: true, quotes: liveOffers(c, m, (o) => want.has(o.id)).map(({ o, stock, store }): OfferQuote => ({ offerId: o.id, productId: o.productId, unit: toBase(o.priceUsdCents), max: Math.min(stock, MAX_PER_OFFER), seller: { slug: store.slug, name: store.name } })) };
  },
  async store(slug) {
    const c = demoPublicMarketCtx(); const m = marketOf(c.s); const store = m.stores.find((x) => x.slug === slug); const vis = store && c.seller(store.userId);
    if (!store || !vis) return { ok: false, error: MARKET_ERRORS.storeNotFound };
    const toBase = await usdToBase();
    return { ok: true, store: { seller: publicSeller(store.name, store.slug, store.logo?.dataUrl ?? null, vis.since, false, ratingOf(c, store.name)),
      offers: liveOffers(c, m, (o) => o.sellerId === store.userId && productOf(o.productId)?.kind === "game_key").map(({ o }) => ({ productId: o.productId, priceUsdCents: o.priceUsdCents, unit: toBase(o.priceUsdCents) })) } };
  },
};
// Demo account cart: seller lines get today's price + keys left (same as lib/server/cart.ts).
export async function demoQuoteLines(entries: CartEntry[]): Promise<CartEntry[]> {
  const ids = entries.flatMap((e) => (e.offerId ? [e.offerId] : [])); if (!ids.length) return entries;
  const r = await demoPublicMarketApi.quotes(ids); const q = new Map(r.ok ? r.quotes.map((x) => [x.offerId, x]) : []);
  return entries.flatMap((e) => { if (!e.offerId) return [e]; const x = q.get(e.offerId); return x && x.productId === e.productId ? [{ ...e, unit: x.unit, max: x.max, seller: x.seller }] : []; });
}
