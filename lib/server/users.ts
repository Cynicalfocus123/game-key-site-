import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { checkNewUser, cleanEmail, USER_ERRORS, type NewUser, type Role } from "@/lib/users";
import { ALL_PERMS, isAdminRole, isMasterRole, parsePerms, PERM_ERRORS, permsAfterRole, permsOf, permsText, roleChangeError, type AdminPerm } from "@/lib/admin-perms";
import { auth } from "./auth";
import { db } from "./db";
import { user, userAudit } from "./db/schema";

type Fail = { ok: false; error: string; status: number };
type Actor = { id: string; role: string };

// Admin "Add user" (future task S7): creates the user row (email not verified, no password) and sends a set-password email
// (Better Auth reset link; the reset creates the password login and marks the email verified, see auth.ts onPasswordReset).
// T2: only a master admin can add an admin or master admin; a new admin gets the ticked sections (none when not sent).
export async function addUserByAdmin(actor: Actor, input: Partial<NewUser>, origin: string): Promise<{ ok: true; id: string } | Fail> {
  const error = checkNewUser(input); if (error) return { ok: false, error, status: 400 };
  const denied = roleChangeError(actor.role, "customer", input.role!); if (denied) return { ok: false, error: denied, status: 403 };
  const perms = input.role === "admin" ? parsePerms(input.perms ?? []) : null;
  if (input.role === "admin" && !perms) return { ok: false, error: PERM_ERRORS.bad, status: 400 };
  const email = cleanEmail(input.email); const id = crypto.randomUUID();
  const created = await db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (taken) return false;
    await tx.insert(user).values({ id, name: input.name!.trim(), email, emailVerified: false, role: input.role!, adminPerms: perms });
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId: actor.id, action: "created", detail: input.role! });
    if (perms) await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId: actor.id, action: "perms", detail: `none → ${permsText(perms)}` });
    return true;
  }).catch(() => false); // unique email race → taken
  if (!created) return { ok: false, error: USER_ERRORS.taken, status: 409 };
  await auth.api.requestPasswordReset({ body: { email, redirectTo: `${process.env.BETTER_AUTH_URL || origin}/reset-password` } });
  return { ok: true, id };
}

// Role change with audit. Not on yourself; the last verified admin / master admin cannot be demoted. The user row is locked while checking.
// T2: changes to or from admin / master admin need a master admin. A new admin starts with no sections; leaving admin clears them.
export async function setUserRole(actor: Actor, id: string, role: Role): Promise<{ ok: true } | Fail> {
  if (id === actor.id) return { ok: false, error: USER_ERRORS.self, status: 400 };
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ role: user.role }).from(user).where(eq(user.id, id)).for("update");
    if (!u) return { ok: false as const, error: USER_ERRORS.notFound, status: 404 };
    if (u.role === role) return { ok: true as const };
    const denied = roleChangeError(actor.role, u.role, role); if (denied) return { ok: false as const, error: denied, status: 403 };
    const others = async (roles: string[]) => Number((await tx.select({ n: sql<number>`count(*)::int` }).from(user).where(and(inArray(user.role, roles), eq(user.emailVerified, true), ne(user.id, id))))[0]?.n);
    if (isMasterRole(u.role) && !isMasterRole(role) && !(await others(["master_admin"]))) return { ok: false as const, error: USER_ERRORS.lastMaster, status: 400 };
    if (isAdminRole(u.role) && !isAdminRole(role) && !(await others(["admin", "master_admin"]))) return { ok: false as const, error: USER_ERRORS.lastAdmin, status: 400 };
    await tx.update(user).set({ role, adminPerms: permsAfterRole(role), updatedAt: new Date() }).where(eq(user.id, id));
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId: actor.id, action: "role", detail: `${u.role} → ${role}${role === "admin" ? " (sections: none)" : ""}` });
    return { ok: true as const };
  });
}

// T2 (master only, checked by the route): set one admin's sections. Audited "before → after"; no row when nothing changed.
export async function setAdminPerms(actorId: string, id: string, perms: AdminPerm[]): Promise<{ ok: true; perms: AdminPerm[] } | Fail> {
  if (id === actorId) return { ok: false, error: PERM_ERRORS.master, status: 400 };
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ role: user.role, adminPerms: user.adminPerms }).from(user).where(eq(user.id, id)).for("update");
    if (!u) return { ok: false as const, error: USER_ERRORS.notFound, status: 404 };
    if (isMasterRole(u.role)) return { ok: false as const, error: PERM_ERRORS.master, status: 400 };
    if (u.role !== "admin") return { ok: false as const, error: PERM_ERRORS.notAdmin, status: 400 };
    const before = u.adminPerms == null ? [...ALL_PERMS] : parsePerms(u.adminPerms) ?? [];
    await tx.update(user).set({ adminPerms: perms, updatedAt: new Date() }).where(eq(user.id, id));
    if (permsText(before) !== permsText(perms)) await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: id, adminId: actorId, action: "perms", detail: `${permsText(before)} → ${permsText(perms)}` });
    return { ok: true as const, perms };
  });
}

// T2 Admins page: every admin + master (sections as they apply) and the latest 50 admin role / section changes.
const by = alias(user, "audit_by"); const target = alias(user, "audit_target");
export async function adminList() {
  const rows = await db.select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, role: user.role, adminPerms: user.adminPerms, createdAt: user.createdAt })
    .from(user).where(inArray(user.role, ["admin", "master_admin"])).orderBy(desc(sql`${user.role} = 'master_admin'`), user.createdAt);
  const history = await db.select({ a: userAudit, email: target.email, by: by.email }).from(userAudit).innerJoin(target, eq(target.id, userAudit.userId)).leftJoin(by, eq(by.id, userAudit.adminId))
    .where(sql`${userAudit.action} = 'perms' or (${userAudit.action} = 'role' and ${userAudit.detail} like '%admin%') or (${userAudit.action} = 'created' and ${userAudit.detail} in ('admin', 'master_admin'))`)
    .orderBy(desc(userAudit.createdAt)).limit(50);
  return {
    admins: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, role: u.role, perms: permsOf({ ...u, emailVerified: true }), createdAt: u.createdAt.toISOString() })),
    history: history.map(({ a, email, by: b }) => ({ email, action: a.action, detail: a.detail, by: a.adminId ? b ?? "Deleted admin" : null, createdAt: a.createdAt.toISOString() })),
  };
}
