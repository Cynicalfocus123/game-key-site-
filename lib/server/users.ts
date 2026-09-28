import { and, eq, ne, sql } from "drizzle-orm";
import { checkNewUser, cleanEmail, USER_ERRORS, type NewUser, type Role } from "@/lib/users";
import { auth } from "./auth";
import { db } from "./db";
import { user, userAudit } from "./db/schema";

type Fail = { ok: false; error: string; status: number };

// Admin "Add user" (future task S7): creates the user row (email not verified, no password) and sends a set-password email
// (Better Auth reset link; the reset creates the password login and marks the email verified, see auth.ts onPasswordReset).
export async function addUserByAdmin(adminId: string, input: Partial<NewUser>, origin: string): Promise<{ ok: true; id: string } | Fail> {
  const error = checkNewUser(input); if (error) return { ok: false, error, status: 400 };
  const email = cleanEmail(input.email); const id = crypto.randomUUID();
  const created = await db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (taken) return false;
    await tx.insert(user).values({ id, name: input.name!.trim(), email, emailVerified: false, role: input.role! });
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId, action: "created", detail: input.role! });
    return true;
  }).catch(() => false); // unique email race → taken
  if (!created) return { ok: false, error: USER_ERRORS.taken, status: 409 };
  await auth.api.requestPasswordReset({ body: { email, redirectTo: `${process.env.BETTER_AUTH_URL || origin}/reset-password` } });
  return { ok: true, id };
}

// Role change with audit. Not on yourself; the last verified admin cannot be demoted. The user row is locked while checking.
export async function setUserRole(adminId: string, id: string, role: Role): Promise<{ ok: true } | Fail> {
  if (id === adminId) return { ok: false, error: USER_ERRORS.self, status: 400 };
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ role: user.role }).from(user).where(eq(user.id, id)).for("update");
    if (!u) return { ok: false as const, error: USER_ERRORS.notFound, status: 404 };
    if (u.role === role) return { ok: true as const };
    if (u.role === "admin") {
      const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(user).where(and(eq(user.role, "admin"), eq(user.emailVerified, true), ne(user.id, id)));
      if (!Number(c?.n)) return { ok: false as const, error: USER_ERRORS.lastAdmin, status: 400 };
    }
    await tx.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, id));
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId, action: "role", detail: `${u.role} → ${role}` });
    return { ok: true as const };
  });
}
