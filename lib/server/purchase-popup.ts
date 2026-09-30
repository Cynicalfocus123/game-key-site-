import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { isBuyerRole, pickRecent, POPUP_DEFAULTS, POPUP_ORDER_STATUSES, popupChange, RECENT_HOURS, type PopupEvent, type PopupFeed, type PopupSettings } from "@/lib/purchase-popup";
import { db, dbReady } from "./db";
import { orderItems, orders, product, siteSetting, siteSettingEvent, user } from "./db/schema";
import { sampleOrdersAllowed } from "./session";

// Purchase popup (2026-09-30). Settings = one site_setting row; every change = one site_setting_event row (admin audit).
const KEY = "purchase_popup";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const clean = (v: unknown): PopupSettings => {
  const o = (v ?? {}) as Partial<PopupSettings>;
  return { enabled: typeof o.enabled === "boolean" ? o.enabled : POPUP_DEFAULTS.enabled, hidden: Array.isArray(o.hidden) ? o.hidden.filter((x): x is string => typeof x === "string") : [] };
};
async function read(tx: Tx | typeof db) { const [r] = await tx.select({ value: siteSetting.value }).from(siteSetting).where(eq(siteSetting.key, KEY)).limit(1); return r ? clean(r.value) : { ...POPUP_DEFAULTS, hidden: [] }; }

export async function popupSettings(): Promise<PopupSettings> { await dbReady(); return read(db); }

export async function popupHistory(): Promise<PopupEvent[]> {
  await dbReady();
  const rows = await db.select({ at: siteSettingEvent.createdAt, by: user.email, detail: siteSettingEvent.detail }).from(siteSettingEvent)
    .leftJoin(user, eq(user.id, siteSettingEvent.adminId)).where(eq(siteSettingEvent.key, KEY)).orderBy(desc(siteSettingEvent.createdAt)).limit(20);
  return rows.map((r) => ({ at: r.at.toISOString(), by: r.by ?? null, detail: r.detail }));
}

// Save + audit in one transaction (advisory lock: two admins saving at once never lose a row). Unchanged → nothing written.
export async function savePopupSettings(adminId: string, next: PopupSettings) {
  await dbReady();
  const names = new Map((await db.select({ id: product.id, name: product.name }).from(product)).map((p) => [p.id, p.name]));
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('corecart:purchase_popup'))`);
    const before = await read(tx);
    const detail = popupChange(before, next, (id) => names.get(id) ?? id);
    if (!detail) return;
    const now = new Date();
    await tx.insert(siteSetting).values({ key: KEY, value: next, updatedBy: adminId, updatedAt: now })
      .onConflictDoUpdate({ target: siteSetting.key, set: { value: next, updatedBy: adminId, updatedAt: now } });
    await tx.insert(siteSettingEvent).values({ id: crypto.randomUUID(), key: KEY, adminId, detail, createdAt: now });
  });
  g.__ccPopupFeed = null;
}

export async function productExists(id: string) { await dbReady(); const [p] = await db.select({ id: product.id }).from(product).where(eq(product.id, id)).limit(1); return !!p; }
export async function allProductIds() { await dbReady(); return new Set((await db.select({ id: product.id }).from(product)).map((p) => p.id)); }

// Public feed: paid product orders of the last 24 h from active buyer accounts, published products only, hidden ones left out.
// Only product id, time and the buyer's account country leave the server. Dev sample orders count only where sample orders are allowed
// (never in production). Cached 10 s so many visitors polling every 30 s cost one query.
// On globalThis: every route bundle (public feed, admin save) must share one cache, so a save shows at once.
const g = globalThis as { __ccPopupFeed?: { at: number; feed: PopupFeed } | null };
export async function recentPurchases(): Promise<PopupFeed> {
  const c = g.__ccPopupFeed; if (c && Date.now() - c.at < 10_000) return c.feed;
  const settings = await popupSettings();
  let feed: PopupFeed = { enabled: settings.enabled, purchases: [] };
  if (settings.enabled) {
    const since = new Date(Date.now() - RECENT_HOURS * 3600_000);
    const rows = await db.select({ lineId: orderItems.id, productId: orderItems.productId, at: orders.paidAt, country: user.country, role: user.role })
      .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).innerJoin(user, eq(user.id, orders.userId))
      .innerJoin(product, and(eq(product.id, orderItems.productId), eq(product.status, "published")))
      .where(and(inArray(orders.status, POPUP_ORDER_STATUSES), gte(orders.paidAt, since), eq(user.status, "active"), sampleOrdersAllowed() ? undefined : eq(orders.isSample, false)))
      .orderBy(desc(orders.paidAt)).limit(200);
    feed = { enabled: true, purchases: pickRecent(rows.filter((r) => r.at && isBuyerRole(r.role)).map((r) => ({ lineId: r.lineId, productId: r.productId, at: r.at!.toISOString(), country: r.country })), settings) };
  }
  g.__ccPopupFeed = { at: Date.now(), feed };
  return feed;
}
