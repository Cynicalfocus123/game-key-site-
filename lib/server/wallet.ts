import { eq, sql } from "drizzle-orm";
import { withBalances, type Bucket } from "@/lib/gift-cards";
import { ADJUST_ERRORS, checkAdjustment, signedAmount, type AdminWallet, type Adjustment } from "@/lib/wallet";
import { db } from "./db";
import { user, walletLedger } from "./db/schema";

// Admin wallet (future task S8). Balance = sum of wallet_ledger rows; adjustments are new rows with the admin id.
export async function adminWallet(userId: string): Promise<AdminWallet> {
  const rows = await db.select({ r: walletLedger, by: user.email }).from(walletLedger).leftJoin(user, eq(user.id, walletLedger.createdBy)).where(eq(walletLedger.userId, userId));
  const byId = new Map(rows.map(({ r, by }) => [r.id, r.createdBy ? by ?? "Deleted admin" : null]));
  const transactions = withBalances(rows.map(({ r }) => ({ id: r.id, createdAt: r.createdAt.toISOString(), bucket: r.bucket as Bucket, type: r.type, ref: r.ref, amountMinor: r.amountMinor })))
    .map((t) => ({ ...t, by: byId.get(t.id) ?? null }));
  const sum = (b: Bucket) => rows.filter(({ r }) => r.bucket === b).reduce((t, { r }) => t + r.amountMinor, 0);
  return { walletMinor: sum("wallet"), giftMinor: sum("gift"), transactions };
}

// The customer's user row is locked (FOR UPDATE) so two debits at once cannot both pass the "not below 0" check.
export async function adjustBalance(adminId: string, a: Adjustment): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.id, a.userId)).for("update");
    if (!u) return { ok: false as const, error: ADJUST_ERRORS.notFound, status: 404 };
    const [c] = await tx.select({ n: sql<number>`coalesce(sum(${walletLedger.amountMinor}), 0)::int` }).from(walletLedger)
      .where(sql`${walletLedger.userId} = ${a.userId} and ${walletLedger.bucket} = ${a.bucket}`);
    const error = checkAdjustment(a, Number(c?.n ?? 0));
    if (error) return { ok: false as const, error, status: 400 };
    await tx.insert(walletLedger).values({ id: crypto.randomUUID(), userId: a.userId, bucket: a.bucket, type: "adjustment", amountMinor: signedAmount(a), ref: a.reason, createdBy: adminId });
    return { ok: true as const };
  });
}

// Admin overview: money owed to all customers (sum of every ledger row per bucket).
export async function totalOwed() {
  const rows = await db.select({ bucket: walletLedger.bucket, n: sql<number>`coalesce(sum(${walletLedger.amountMinor}), 0)::int` }).from(walletLedger).groupBy(walletLedger.bucket);
  const get = (b: Bucket) => Number(rows.find((r) => r.bucket === b)?.n ?? 0);
  return { walletMinor: get("wallet"), giftMinor: get("gift") };
}
