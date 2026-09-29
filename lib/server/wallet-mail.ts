import { eq } from "drizzle-orm";
import { emailMoney } from "@/lib/emails";
import type { Adjustment } from "@/lib/wallet";
import { db } from "./db";
import { topUp, user } from "./db/schema";
import { sendTemplate } from "./email";
import { getBalance } from "./gift-cards";

// Wallet emails (email task, 2026-09-29): top-up credited, gift card redeemed, admin adjustment. Balances are THB satang.
const thb = (minor: number) => emailMoney(minor, "THB");
const person = async (userId: string) => (await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId)).limit(1))[0];

export async function mailTopUp(topUpId: string) {
  const [t] = await db.select().from(topUp).where(eq(topUp.id, topUpId)).limit(1);
  if (!t || t.status !== "credited") return;
  const u = await person(t.userId); const b = await getBalance(t.userId);
  await sendTemplate(u?.email, "topUp", { name: u?.name ?? "", number: t.number, amount: thb(t.creditMinor), paid: emailMoney(t.amountMinor, t.currency), balance: thb(b.walletMinor) });
}
export async function mailGiftCard(userId: string, amountMinor: number, last4: string) {
  const u = await person(userId); const b = await getBalance(userId);
  await sendTemplate(u?.email, "giftCard", { name: u?.name ?? "", amount: thb(amountMinor), last4, balance: thb(b.giftMinor) });
}
export async function mailAdjustment(a: Adjustment) {
  const u = await person(a.userId); const b = await getBalance(a.userId);
  await sendTemplate(u?.email, "balanceAdjusted", { name: u?.name ?? "", amount: thb(a.amountMinor), credit: a.direction === "credit", reason: a.reason, balance: thb(a.bucket === "gift" ? b.giftMinor : b.walletMinor) });
}
