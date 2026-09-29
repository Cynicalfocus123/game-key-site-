import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { generateCode, giftCardStatus, hashCode, maskedCode, normalizeCode, REDEEM_ERRORS, withBalances, type BalanceData, type Bucket, type GiftCard, type NewGiftCards } from "@/lib/gift-cards";
import { db } from "./db";
import { giftCard, user, walletLedger } from "./db/schema";

export async function getBalance(userId: string): Promise<BalanceData> {
  const rows = await db.select().from(walletLedger).where(eq(walletLedger.userId, userId));
  const transactions = withBalances(rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), bucket: r.bucket as Bucket, type: r.type, ref: r.ref, amountMinor: r.amountMinor })));
  const sum = (b: Bucket) => rows.filter((r) => r.bucket === b).reduce((t, r) => t + r.amountMinor, 0);
  return { walletMinor: sum("wallet"), giftMinor: sum("gift"), transactions };
}

// Claims the card and credits the gift bucket in one transaction. The UPDATE … WHERE redeemed_at IS NULL stops double redeem.
export async function redeemGiftCard(userId: string, input: string): Promise<{ ok: true; amountMinor: number; last4: string } | { ok: false; error: string }> {
  const code = normalizeCode(input);
  if (!code) return { ok: false, error: REDEEM_ERRORS.format };
  const codeHash = await hashCode(code); const now = new Date();
  return db.transaction(async (tx) => {
    const [card] = await tx.update(giftCard).set({ redeemedBy: userId, redeemedAt: now })
      .where(and(eq(giftCard.codeHash, codeHash), isNull(giftCard.redeemedAt), eq(giftCard.disabled, false), or(isNull(giftCard.expiresAt), gt(giftCard.expiresAt, now))))
      .returning({ id: giftCard.id, amountMinor: giftCard.amountMinor, last4: giftCard.last4 });
    if (!card) {
      const [found] = await tx.select().from(giftCard).where(eq(giftCard.codeHash, codeHash)).limit(1);
      if (!found) return { ok: false as const, error: REDEEM_ERRORS.notFound };
      const status = giftCardStatus({ redeemedAt: found.redeemedAt?.toISOString() ?? null, disabled: found.disabled, expiresAt: found.expiresAt?.toISOString() ?? null });
      return { ok: false as const, error: status === "active" ? REDEEM_ERRORS.notFound : REDEEM_ERRORS[status] };
    }
    await tx.insert(walletLedger).values({ id: crypto.randomUUID(), userId, bucket: "gift", type: "gift_card_redeem", amountMinor: card.amountMinor, ref: maskedCode(card.last4), giftCardId: card.id, createdAt: now });
    return { ok: true as const, amountMinor: card.amountMinor, last4: card.last4 };
  });
}

// Admin
export async function listGiftCards(): Promise<GiftCard[]> {
  const rows = await db.select({ card: giftCard, email: user.email }).from(giftCard).leftJoin(user, eq(user.id, giftCard.redeemedBy)).orderBy(desc(giftCard.createdAt)).limit(1000);
  return rows.map(({ card: c, email }) => ({ id: c.id, last4: c.last4, amountMinor: c.amountMinor, note: c.note, expiresAt: c.expiresAt?.toISOString() ?? null, disabled: c.disabled,
    createdAt: c.createdAt.toISOString(), createdBy: c.createdBy, redeemedAt: c.redeemedAt?.toISOString() ?? null, redeemedBy: c.redeemedAt ? email ?? "Deleted user" : null }));
}
// Returns the full codes once; only hashes are stored.
export async function createGiftCards(adminId: string, input: NewGiftCards) {
  const codes = Array.from({ length: input.count }, generateCode);
  const rows = await Promise.all(codes.map(async (code) => ({ id: crypto.randomUUID(), codeHash: await hashCode(code), last4: code.slice(-4), amountMinor: input.amountMinor,
    note: input.note?.trim() || null, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, createdBy: adminId })));
  await db.insert(giftCard).values(rows);
  return rows.map((r, i) => ({ id: r.id, code: codes[i] }));
}
// Redeemed cards cannot change.
export async function setGiftCardDisabled(id: string, disabled: boolean) {
  const r = await db.update(giftCard).set({ disabled }).where(and(eq(giftCard.id, id), isNull(giftCard.redeemedAt))).returning({ id: giftCard.id });
  return r.length > 0;
}
