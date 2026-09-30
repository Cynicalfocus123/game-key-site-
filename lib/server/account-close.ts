import { and, desc, eq, ne } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { CLOSE_ERRORS, closedPlaceholder } from "@/lib/account-close";
import { db } from "./db";
import { account, session, user, userAudit } from "./db/schema";

// T3 close account (anyone): data is never deleted. status closed = sign-in blocked (auth.ts session hook), every session ended.
// closed_email keeps the address; a later sign-up with it only takes the email after it verifies (finishEmailClaim, R1).
type Fail = { ok: false; error: string; status: number };

export async function closeAccount(id: string, byId: string, reason: string): Promise<{ ok: true } | Fail> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ status: user.status, email: user.email, role: user.role }).from(user).where(eq(user.id, id)).for("update");
    if (!u) return { ok: false as const, error: CLOSE_ERRORS.notFound, status: 404 };
    if (u.status === "closed") return { ok: false as const, error: CLOSE_ERRORS.already, status: 409 };
    if (u.role === "admin" || u.role === "master_admin") return { ok: false as const, error: CLOSE_ERRORS.admin, status: 400 };
    const now = new Date();
    await tx.update(user).set({ status: "closed", closedAt: now, closedBy: byId, closedReason: reason, closedEmail: u.email, updatedAt: now }).where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId: byId, action: "closed", detail: reason });
    return { ok: true as const };
  });
}

// The person closes their own account: type CLOSE, and the password when the account has one.
export async function closeOwnAccount(id: string, password: string, reason: string): Promise<{ ok: true } | Fail> {
  const [cred] = await db.select({ password: account.password }).from(account).where(and(eq(account.userId, id), eq(account.providerId, "credential"))).limit(1);
  if (cred?.password && !(password && (await verifyPassword({ hash: cred.password, password })))) return { ok: false, error: CLOSE_ERRORS.password, status: 400 };
  return closeAccount(id, id, reason || "Closed by the account owner");
}

// Admin reopen (Users section): back to active; the old email comes back unless a newer account uses it now.
export async function reopenAccount(adminId: string, id: string, note: string): Promise<{ ok: true } | Fail> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(user).where(eq(user.id, id)).for("update");
    if (!u) return { ok: false as const, error: CLOSE_ERRORS.notFound, status: 404 };
    if (u.status !== "closed") return { ok: false as const, error: CLOSE_ERRORS.notClosed, status: 409 };
    let email = u.email;
    if (u.closedEmail && u.email !== u.closedEmail) {
      const [taken] = await tx.select({ id: user.id }).from(user).where(and(eq(user.email, u.closedEmail), ne(user.id, id))).limit(1);
      if (taken) return { ok: false as const, error: CLOSE_ERRORS.emailTaken, status: 409 };
      email = u.closedEmail;
    }
    await tx.update(user).set({ status: "active", email, closedAt: null, closedBy: null, closedReason: null, closedEmail: null, updatedAt: new Date() }).where(eq(user.id, id));
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId, action: "reopened", detail: note });
    return { ok: true as const };
  });
}

// R1: a sign-up with the email of a closed account never touches the closed row. The new account is made with a placeholder
// email (claim+<id>@claim.invalid) and claim_email = the real address; the verification email goes to the real address.
// Only when that verification succeeds does finishEmailClaim move the address, in one transaction.
export async function closedHolder(email: string) {
  const e = email.trim().toLowerCase(); if (!e) return null;
  const [u] = await db.select({ id: user.id }).from(user).where(and(eq(user.email, e), eq(user.status, "closed"))).limit(1);
  return u ?? null;
}
// Newest unverified claim for this address (resend verification).
export async function pendingClaim(email: string) {
  const e = email.trim().toLowerCase(); if (!e) return null;
  const [u] = await db.select({ email: user.email }).from(user).where(and(eq(user.claimEmail, e), eq(user.emailVerified, false))).orderBy(desc(user.createdAt)).limit(1);
  return u ?? null;
}
// Called from beforeEmailVerification: may this claim still finish? (the closed row must still hold the address)
export async function claimStillOpen(claimEmail: string) { return Boolean(await closedHolder(claimEmail)); }
// Called from afterEmailVerification: locks the closed row, moves its email to a placeholder and gives the address to the claimant.
// If the closed row no longer holds it (reopened, or another claim won), the claimant goes back to unverified and nothing moves.
export async function finishEmailClaim(claimantId: string, claimEmail: string): Promise<boolean> {
  const e = claimEmail.trim().toLowerCase();
  const done = await db.transaction(async (tx) => {
    const [old] = await tx.select({ id: user.id }).from(user).where(and(eq(user.email, e), eq(user.status, "closed"))).for("update");
    const [me] = await tx.select({ claimEmail: user.claimEmail }).from(user).where(eq(user.id, claimantId)).for("update");
    if (!old || me?.claimEmail !== e) return false;
    const now = new Date();
    await tx.update(user).set({ email: closedPlaceholder(old.id), updatedAt: now }).where(eq(user.id, old.id));
    await tx.update(user).set({ email: e, claimEmail: null, updatedAt: now }).where(eq(user.id, claimantId));
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: old.id, adminId: null, action: "email_claimed", detail: `Email taken by a new verified sign-up (${claimantId})` });
    return true;
  });
  if (!done) await db.update(user).set({ emailVerified: false, updatedAt: new Date() }).where(eq(user.id, claimantId));
  return done;
}
export const isClosed = async (id: string) => (await db.select({ status: user.status }).from(user).where(eq(user.id, id)).limit(1))[0]?.status === "closed";
