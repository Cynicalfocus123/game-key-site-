import { eq } from "drizzle-orm";
import { checkAddress, sameAddress, type BillingAddress } from "@/lib/address-formats";
import { db } from "./db";
import { user } from "./db/schema";

// Billing address on the account (task 5). User 2026-09-30: a new address is always saved. Same checks as the browser (lib/address-formats.ts).
export const savedBilling = (row: { billingAddress: unknown }) => { const c = checkAddress(row.billingAddress); return c.ok ? c.address : null; };

export async function saveBilling(userId: string, current: BillingAddress | null, input: unknown) {
  const c = checkAddress(input);
  if (!c.ok) return c;
  if (!sameAddress(current, c.address)) await db.update(user).set({ billingAddress: c.address, updatedAt: new Date() }).where(eq(user.id, userId));
  return c;
}
