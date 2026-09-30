import { desc, eq, sql } from "drizzle-orm";
import { cleanFeeSettings, FEE_DEFAULTS, feeChange, type FeeEvent, type FeeSettings } from "@/lib/fees";
import { db, dbReady } from "./db";
import { siteSetting, siteSettingEvent, user } from "./db/schema";

// Service fee + sales tax settings (task 7). One site_setting row; every change = one site_setting_event row (admin audit).
const KEY = "fees_tax";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function read(tx: Tx | typeof db): Promise<FeeSettings> {
  const [r] = await tx.select({ value: siteSetting.value }).from(siteSetting).where(eq(siteSetting.key, KEY)).limit(1);
  return r ? cleanFeeSettings(r.value) : { ...FEE_DEFAULTS, taxRates: [] };
}
export async function feeSettings(): Promise<FeeSettings> { await dbReady(); return read(db); }

export async function feeHistory(): Promise<FeeEvent[]> {
  await dbReady();
  const rows = await db.select({ at: siteSettingEvent.createdAt, by: user.email, detail: siteSettingEvent.detail }).from(siteSettingEvent)
    .leftJoin(user, eq(user.id, siteSettingEvent.adminId)).where(eq(siteSettingEvent.key, KEY)).orderBy(desc(siteSettingEvent.createdAt)).limit(20);
  return rows.map((r) => ({ at: r.at.toISOString(), by: r.by ?? null, detail: r.detail }));
}

// Save + audit in one transaction (advisory lock: two admins saving at once never lose a row). Unchanged → nothing written.
export async function saveFeeSettings(adminId: string, next: FeeSettings) {
  await dbReady();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('corecart:fees_tax'))`);
    const detail = feeChange(await read(tx), next);
    if (!detail) return;
    const now = new Date();
    await tx.insert(siteSetting).values({ key: KEY, value: next, updatedBy: adminId, updatedAt: now })
      .onConflictDoUpdate({ target: siteSetting.key, set: { value: next, updatedBy: adminId, updatedAt: now } });
    await tx.insert(siteSettingEvent).values({ id: crypto.randomUUID(), key: KEY, adminId, detail, createdAt: now });
  });
}
