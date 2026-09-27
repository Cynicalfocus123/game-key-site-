import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { WELCOME10, type PromoCode, type PromoInput } from "@/lib/promo";
import { db } from "./db";
import { promoCode } from "./db/schema";

type Row = typeof promoCode.$inferSelect;
const toPromo = (r: Row): PromoCode => ({ id: r.id, code: r.code, type: r.type as PromoCode["type"], value: r.value, maxDiscount: r.maxDiscount, appliesTo: r.appliesTo as PromoCode["appliesTo"],
  categories: r.categories, minSubtotal: r.minSubtotal, startsAt: r.startsAt.toISOString(), expiresAt: r.expiresAt?.toISOString() ?? null, maxUses: r.maxUses,
  oncePerCustomer: r.oncePerCustomer, uses: r.uses, enabled: r.enabled, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });
const columns = (i: PromoInput) => ({ code: i.code, type: i.type, value: i.value, maxDiscount: i.type === "percent" ? i.maxDiscount : null, appliesTo: i.appliesTo, categories: i.categories,
  minSubtotal: i.minSubtotal, startsAt: new Date(i.startsAt), expiresAt: i.expiresAt ? new Date(i.expiresAt) : null, maxUses: i.maxUses, oncePerCustomer: i.oncePerCustomer, enabled: i.enabled });
const live = isNull(promoCode.deletedAt);

// Dev only: WELCOME10 exists out of the box (same as the demo). Production starts empty; admins create codes.
let seeded = false;
async function seedDev() {
  if (seeded || process.env.NODE_ENV === "production") return;
  seeded = true;
  await db.insert(promoCode).values({ id: crypto.randomUUID(), ...columns(WELCOME10) }).onConflictDoNothing();
}

export async function listPromos() { await seedDev(); return (await db.select().from(promoCode).where(live).orderBy(desc(promoCode.createdAt)).limit(1000)).map(toPromo); }
export async function getPromo(id: string) { const [r] = await db.select().from(promoCode).where(and(eq(promoCode.id, id), live)).limit(1); return r ? toPromo(r) : null; }
export async function findPromo(code: string) { await seedDev(); const [r] = await db.select().from(promoCode).where(and(eq(promoCode.code, code), live)).limit(1); return r ? toPromo(r) : null; }
// Code taken? Soft-deleted codes keep their name (old orders point at them).
async function codeTaken(code: string, exceptId?: string) {
  const [r] = await db.select({ id: promoCode.id }).from(promoCode).where(exceptId ? and(eq(promoCode.code, code), ne(promoCode.id, exceptId)) : eq(promoCode.code, code)).limit(1);
  return Boolean(r);
}
export async function createPromo(adminId: string, i: PromoInput) {
  if (await codeTaken(i.code)) return { ok: false as const, field: "code", error: "This code is already taken." };
  const [r] = await db.insert(promoCode).values({ id: crypto.randomUUID(), ...columns(i), createdBy: adminId }).returning();
  return { ok: true as const, promo: toPromo(r) };
}
export async function updatePromo(id: string, i: PromoInput) {
  if (await codeTaken(i.code, id)) return { ok: false as const, field: "code", error: "This code is already taken." };
  const [r] = await db.update(promoCode).set({ ...columns(i), updatedAt: new Date() }).where(and(eq(promoCode.id, id), live)).returning();
  return r ? { ok: true as const, promo: toPromo(r) } : { ok: false as const, error: "Promo code not found" };
}
export async function setPromoEnabled(id: string, enabled: boolean) {
  const r = await db.update(promoCode).set({ enabled, updatedAt: new Date() }).where(and(eq(promoCode.id, id), live)).returning({ id: promoCode.id });
  return r.length > 0;
}
// Hard delete while never used; soft delete once real orders used it.
export async function deletePromo(id: string) {
  const [r] = await db.select({ uses: promoCode.uses }).from(promoCode).where(and(eq(promoCode.id, id), live)).limit(1);
  if (!r) return false;
  if (r.uses === 0) await db.delete(promoCode).where(eq(promoCode.id, id));
  else await db.update(promoCode).set({ deletedAt: new Date(), enabled: false, updatedAt: new Date() }).where(eq(promoCode.id, id));
  return true;
}
