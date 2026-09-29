import { and, eq, ne } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { CLOSE_ERRORS } from "@/lib/account-close";
import { db } from "./db";
import { account, session, user, userAudit } from "./db/schema";

// T3 close account (anyone): data is never deleted. status closed = sign-in blocked (auth.ts session hook), every session ended.
// closed_email keeps the address; a later sign-up with it frees the email column (freeClosedEmail) and is flagged to admins.
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

// Sign-up with the email of a closed account: the closed row gives up the email column (it keeps closed_email), so the
// new account can be made; admins see it as a returning person (closed_email match). Called from the auth before hook.
export async function freeClosedEmail(email: string) {
  const e = email.trim().toLowerCase(); if (!e) return;
  const [u] = await db.select({ id: user.id }).from(user).where(and(eq(user.email, e), eq(user.status, "closed"))).limit(1);
  if (u) await db.update(user).set({ email: `closed+${u.id}@closed.invalid` }).where(eq(user.id, u.id));
}
export const isClosed = async (id: string) => (await db.select({ status: user.status }).from(user).where(eq(user.id, id)).limit(1))[0]?.status === "closed";
