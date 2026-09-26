import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";
import { account, loginEvent, orders, session, user } from "./db/schema";

// Admin access: role = admin AND verified email. Admins are created only on the server (npm run admin:create);
// no page, sign-up or Google sign-in can create or promote an admin.
export const isAdmin = (u: { emailVerified: boolean; role: string }) => u.emailVerified && u.role === "admin";

// Sign-in method from Better Auth endpoint path.
export function loginMethod(path: string | undefined) {
  if (!path) return null;
  if (path === "/sign-in/email") return "email";
  if (path === "/verify-email") return "email-verify";
  if (path.startsWith("/callback/")) return path.split("/").pop() || "oauth";
  return path.replace(/^\//, "");
}

const TZ = "Asia/Bangkok";
const day = (col: SQL | typeof user.createdAt) => sql<string>`to_char((${col} at time zone ${sql.raw(`'${TZ}'`)})::date, 'YYYY-MM-DD')`;

export async function adminStats(db: Db) {
  const now = Date.now();
  const since = (days: number) => new Date(now - days * 86400_000);
  const [totals] = await db.select({
    total: sql<number>`count(*)::int`,
    verified: sql<number>`count(*) filter (where ${user.emailVerified})::int`,
    admins: sql<number>`count(*) filter (where ${user.role} = 'admin')::int`,
    new1: sql<number>`count(*) filter (where ${user.createdAt} >= ${since(1)})::int`,
    new7: sql<number>`count(*) filter (where ${user.createdAt} >= ${since(7)})::int`,
    new30: sql<number>`count(*) filter (where ${user.createdAt} >= ${since(30)})::int`,
    marketing: sql<number>`count(*) filter (where ${user.marketingOptIn})::int`,
  }).from(user);
  const methods = await db.select({ method: account.providerId, users: sql<number>`count(distinct ${account.userId})::int` }).from(account).groupBy(account.providerId);
  const [logins] = await db.select({
    logins7: sql<number>`count(*)::int`,
    active7: sql<number>`count(distinct ${loginEvent.userId})::int`,
  }).from(loginEvent).where(sql`${loginEvent.createdAt} >= ${since(7)}`);
  const daily = await db.select({ day: day(user.createdAt), count: sql<number>`count(*)::int` }).from(user)
    .where(sql`${user.createdAt} >= ${since(30)}`).groupBy(sql`1`).orderBy(sql`1`);
  const recent = await adminUsers(db, { page: 1, pageSize: 8 });
  return { ...totals, ...logins, methods, daily, recent: recent.users, timezone: TZ };
}

// Drizzle leaves columns unqualified in single-table selects, so correlated subqueries name tables explicitly.
const U_ID = sql.raw('"user"."id"');
const A = { table: sql.raw('"account" a'), userId: sql.raw("a.user_id"), provider: sql.raw("a.provider_id"), createdAt: sql.raw("a.created_at") };
const L = { table: sql.raw('"login_event" l'), userId: sql.raw("l.user_id"), createdAt: sql.raw("l.created_at") };

export type UserQuery = { q?: string; method?: string; verified?: string; role?: string; sort?: string; page?: number; pageSize?: number };

export async function adminUsers(db: Db, query: UserQuery) {
  const pageSize = Math.min(Math.max(query.pageSize || 25, 1), 100);
  const page = Math.max(query.page || 1, 1);
  const where: SQL[] = [];
  const q = query.q?.trim();
  if (q) where.push(sql`(${user.email} ilike ${`%${q}%`} or ${user.name} ilike ${`%${q}%`})`);
  if (query.method) where.push(sql`exists (select 1 from ${A.table} where ${A.userId} = ${U_ID} and ${A.provider} = ${query.method})`);
  if (query.verified === "yes") where.push(eq(user.emailVerified, true));
  if (query.verified === "no") where.push(eq(user.emailVerified, false));
  if (query.role) where.push(eq(user.role, query.role));
  const filter = where.length ? and(...where) : undefined;
  const lastLogin = sql<string | null>`(select max(${L.createdAt}) from ${L.table} where ${L.userId} = ${U_ID})`;
  const rows = await db.select({
    id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, role: user.role, createdAt: user.createdAt, marketingOptIn: user.marketingOptIn,
    methods: sql<string | null>`(select string_agg(${A.provider}, ',' order by ${A.createdAt}) from ${A.table} where ${A.userId} = ${U_ID})`,
    lastLogin,
    loginCount: sql<number>`(select count(*)::int from ${L.table} where ${L.userId} = ${U_ID})`,
  }).from(user).where(filter)
    .orderBy(query.sort === "login" ? sql`${lastLogin} desc nulls last` : query.sort === "oldest" ? user.createdAt : desc(user.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(user).where(filter);
  return {
    total, page, pageSize,
    users: rows.map((r) => ({ ...r, createdAt: iso(r.createdAt)!, lastLogin: iso(r.lastLogin), methods: r.methods ? r.methods.split(",") : [] })),
  };
}

export async function adminUserDetail(db: Db, id: string) {
  const [u] = await db.select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt, termsAcceptedAt: user.termsAcceptedAt, marketingOptIn: user.marketingOptIn })
    .from(user).where(eq(user.id, id)).limit(1);
  if (!u) return null;
  const accounts = await db.select({ method: account.providerId, createdAt: account.createdAt }).from(account).where(eq(account.userId, id)).orderBy(account.createdAt);
  // Never select session tokens.
  const sessions = await db.select({ createdAt: session.createdAt, expiresAt: session.expiresAt, ipAddress: session.ipAddress, userAgent: session.userAgent })
    .from(session).where(and(eq(session.userId, id), sql`${session.expiresAt} > now()`)).orderBy(desc(session.createdAt));
  const logins = await db.select({ method: loginEvent.method, ipAddress: loginEvent.ipAddress, userAgent: loginEvent.userAgent, createdAt: loginEvent.createdAt })
    .from(loginEvent).where(eq(loginEvent.userId, id)).orderBy(desc(loginEvent.createdAt)).limit(50);
  const [orderStats] = await db.select({ count: sql<number>`count(*)::int`, totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` }).from(orders).where(eq(orders.userId, id));
  return {
    user: { ...u, createdAt: iso(u.createdAt)!, updatedAt: iso(u.updatedAt)!, termsAcceptedAt: iso(u.termsAcceptedAt) },
    accounts: accounts.map((a) => ({ ...a, createdAt: iso(a.createdAt)! })),
    sessions: sessions.map((s) => ({ ...s, createdAt: iso(s.createdAt)!, expiresAt: iso(s.expiresAt)! })),
    logins: logins.map((l) => ({ ...l, createdAt: iso(l.createdAt)! })),
    orders: orderStats,
  };
}

function iso(v: Date | string | null | undefined) {
  if (!v) return null;
  return (v instanceof Date ? v : new Date(v)).toISOString();
}
