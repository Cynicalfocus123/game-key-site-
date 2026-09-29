import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { applicationNumber, checkFile, checkSeller, cleanIdNumber, firstBadStep, FILE_KINDS, merchantKey, SELL_ERRORS, sniffMime, tabOf, type FileKind, type MyApplication, type SellerAction, type SellerDetail, type SellerErrors, type SellerFile, type SellerInput, type SellerMatch, type SellerRow, type SellerStatus, type SellerTab } from "@/lib/sellers";
import { db } from "./db";
import { sellerApplication, sellerEvent, sellerFile, user, userAudit } from "./db/schema";
import { sendTemplate } from "./email";
import { decryptBytes, decryptText, encryptBytes, encryptText, encryptionKey, hmacOf } from "./secure";

type Fail = { ok: false; error: string; status: number; errors?: SellerErrors };
const fail = (error: string, status = 400, errors?: SellerErrors): Fail => ({ ok: false, error, status, errors });
const iso = (d: Date | null) => (d ? d.toISOString() : null);
// Private files: never under public/, never served without the admin route. UPLOAD_DIR can point to the VPS disk later.
const dir = () => path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), ".data", "uploads"), "seller");
function key() { const k = encryptionKey(); if (!k) throw new Error("KEY_ENCRYPTION_KEY is missing or not 32 bytes (base64)."); return k; }

// Applicant upload (one file). Type from the content; stored encrypted with a random name.
export async function uploadSellerFile(userId: string, kind: FileKind, name: string, bytes: Uint8Array): Promise<{ ok: true; file: SellerFile } | Fail> {
  const bad = checkFile(kind, bytes); if (bad) return fail(bad);
  const mime = sniffMime(bytes)!; const id = crypto.randomUUID(); const storedName = randomBytes(24).toString("hex");
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), storedName), encryptBytes(key(), bytes), { flag: "wx" });
  const originalName = (name || "file").replace(/[^\w. ()-]/g, "_").slice(0, 120);
  const [row] = await db.insert(sellerFile).values({ id, userId, kind, mime, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), storedName, originalName }).returning();
  return { ok: true, file: fileOut(row) };
}
const fileOut = (f: typeof sellerFile.$inferSelect): SellerFile => ({ id: f.id, kind: f.kind as FileKind, name: f.originalName, mime: f.mime, size: f.size, createdAt: f.createdAt.toISOString() });

const mine = (a: typeof sellerApplication.$inferSelect): MyApplication => ({ id: a.id, number: applicationNumber(a.seq), status: a.status === "blacklisted" ? "rejected" : a.status as SellerStatus, merchantName: a.merchantName, createdAt: a.createdAt.toISOString(), decidedAt: iso(a.decidedAt), reason: a.status === "rejected" ? a.reason : a.status === "blacklisted" ? "Your application was not accepted." : null });
// The applicant's latest application (a blacklisted one shows as rejected; the blacklist reason is admin only).
export async function myApplication(userId: string) {
  const [a] = await db.select().from(sellerApplication).where(eq(sellerApplication.userId, userId)).orderBy(desc(sellerApplication.createdAt)).limit(1);
  return a ? mine(a) : null;
}

// Submit: checks every step again, one open application per person, merchant name free, files belong to this user and are unused.
export async function submitApplication(u: { id: string; email: string; name: string }, input: SellerInput, _origin: string): Promise<{ ok: true; application: MyApplication } | Fail> {
  const errors = checkSeller(input); if (Object.keys(errors).length) return fail(`Check step ${(firstBadStep(errors) ?? 0) + 1}.`, 400, errors);
  const k = key(); const idNumber = cleanIdNumber(input.idNumber); const mKey = merchantKey(input.merchantName);
  const res = await db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, u.id)).for("update"); // one submit at a time per user
    const [open] = await tx.select({ status: sellerApplication.status }).from(sellerApplication).where(and(eq(sellerApplication.userId, u.id), inArray(sellerApplication.status, ["pending", "approved"]))).limit(1);
    if (open) return fail(open.status === "pending" ? SELL_ERRORS.pending : SELL_ERRORS.approved, 409);
    const [taken] = await tx.select({ id: sellerApplication.id }).from(sellerApplication).where(and(eq(sellerApplication.merchantKey, mKey), inArray(sellerApplication.status, ["pending", "approved"]), ne(sellerApplication.userId, u.id))).limit(1);
    if (taken) return fail(SELL_ERRORS.merchantTaken, 409, { merchantName: SELL_ERRORS.merchantTaken });
    const wanted = FILE_KINDS.flatMap((fk) => input.files[fk.id].map((fid) => ({ fid, kind: fk.id })));
    const rows = wanted.length ? await tx.select().from(sellerFile).where(and(inArray(sellerFile.id, wanted.map((w) => w.fid)), eq(sellerFile.userId, u.id), isNull(sellerFile.applicationId))).for("update") : [];
    if (rows.length !== wanted.length || wanted.some((w) => rows.find((r) => r.id === w.fid)?.kind !== w.kind)) return fail(SELL_ERRORS.fileBad);
    const { files: _f, idNumber: _i, confirm: _c, ...data } = input;
    const [a] = await tx.insert(sellerApplication).values({ id: crypto.randomUUID(), userId: u.id, email: u.email, status: "pending", data, merchantName: input.merchantName, merchantKey: mKey,
      idType: input.idType, idNumberEnc: encryptText(k, idNumber), idNumberHash: hmacOf(k, `id:${idNumber}`), idLast4: idNumber.slice(-4) }).returning();
    await tx.update(sellerFile).set({ applicationId: a.id }).where(inArray(sellerFile.id, wanted.map((w) => w.fid)));
    await tx.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: a.id, adminId: null, action: "submitted", detail: "" });
    return { ok: true as const, application: mine(a) };
  });
  if (res.ok) await sendTemplate(u.email, "sellerReceived", { name: input.firstName || u.name, number: res.application.number });
  return res;
}

// ---------- Admin (section "sellers") ----------
const applicant = alias(user, "applicant");
const q = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);
// Returning-person matches of one application: other applications (rejected / blacklisted / closed account) with the same email,
// KYC ID number or merchant name, and closed accounts that used this email.
async function matchesFor(a: { id: string; userId: string; email: string; merchantKey: string; idNumberHash: string }): Promise<SellerMatch[]> {
  const others = await db.select({ a: sellerApplication, status: applicant.status, closedAt: applicant.closedAt, closedReason: applicant.closedReason }).from(sellerApplication).innerJoin(applicant, eq(applicant.id, sellerApplication.userId))
    .where(and(ne(sellerApplication.id, a.id), or(eq(sellerApplication.email, a.email), eq(sellerApplication.merchantKey, a.merchantKey), eq(sellerApplication.idNumberHash, a.idNumberHash)),
      or(inArray(sellerApplication.status, ["rejected", "blacklisted"]), eq(applicant.status, "closed")))).orderBy(desc(sellerApplication.createdAt)).limit(20);
  const out: SellerMatch[] = others.map(({ a: o, status, closedAt, closedReason }) => {
    const what = o.status === "blacklisted" ? "blacklisted" : o.status === "rejected" ? "rejected" : "closed_account";
    const kind = o.idNumberHash === a.idNumberHash ? "id_number" : o.email === a.email ? "email" : "merchant";
    return { kind, what, userId: o.userId, applicationId: o.id, number: applicationNumber(o.seq), label: o.merchantName, at: iso(what === "closed_account" ? closedAt : o.decidedAt), reason: what === "blacklisted" ? o.blacklistReason : what === "rejected" ? o.reason : status === "closed" ? closedReason : null };
  });
  out.push(...(await closedAccountsFor(a.email, a.userId)));
  return out;
}
// Closed accounts that used this email (someone who closed an account and signed up again).
export async function closedAccountsFor(email: string, exceptUserId: string): Promise<SellerMatch[]> {
  const rows = await db.select({ id: user.id, closedAt: user.closedAt, closedReason: user.closedReason, closedEmail: user.closedEmail }).from(user)
    .where(and(eq(user.status, "closed"), eq(user.closedEmail, email), ne(user.id, exceptUserId))).limit(10);
  return rows.map((r) => ({ kind: "email" as const, what: "closed_account" as const, userId: r.id, applicationId: null, number: null, label: r.closedEmail ?? email, at: iso(r.closedAt), reason: r.closedReason }));
}
// Rejected / blacklisted applications made with this email by another account (for the admin user page).
export async function applicationMatchesForEmail(email: string, exceptUserId: string): Promise<SellerMatch[]> {
  const rows = await db.select().from(sellerApplication).where(and(eq(sellerApplication.email, email), ne(sellerApplication.userId, exceptUserId), inArray(sellerApplication.status, ["rejected", "blacklisted"]))).limit(10);
  return rows.map((o) => ({ kind: "email" as const, what: o.status as "rejected" | "blacklisted", userId: o.userId, applicationId: o.id, number: applicationNumber(o.seq), label: o.merchantName, at: iso(o.decidedAt), reason: o.status === "blacklisted" ? o.blacklistReason : o.reason }));
}

const TAB_SQL: Record<SellerTab, ReturnType<typeof sql>> = {
  blacklisted: sql`${sellerApplication.status} = 'blacklisted'`,
  closed: sql`${sellerApplication.status} <> 'blacklisted' and ${applicant.status} = 'closed'`,
  pending: sql`${sellerApplication.status} = 'pending' and ${applicant.status} <> 'closed'`,
  approved: sql`${sellerApplication.status} = 'approved' and ${applicant.status} <> 'closed'`,
  rejected: sql`${sellerApplication.status} = 'rejected' and ${applicant.status} <> 'closed'`,
};
// Match count per row in SQL (same rules as matchesFor).
const O = { t: sql.raw('"seller_application" o'), u: sql.raw('"user" ou') };
const matchCount = sql<number>`(
  (select count(*) from ${O.t} join ${O.u} on ou.id = o.user_id where o.id <> ${sellerApplication.id}
    and (o.email = ${sellerApplication.email} or o.merchant_key = ${sellerApplication.merchantKey} or o.id_number_hash = ${sellerApplication.idNumberHash})
    and (o.status in ('rejected', 'blacklisted') or ou.status = 'closed'))
  + (select count(*) from ${O.u} where ou.status = 'closed' and ou.closed_email = ${sellerApplication.email} and ou.id <> ${sellerApplication.userId}))::int`;
export async function adminSellerList(tab: SellerTab, search: string) {
  const term = search.trim().toLowerCase();
  const where = and(TAB_SQL[tab], term ? sql`(lower(${sellerApplication.merchantName}) like ${`%${q(term)}%`} or lower(${sellerApplication.email}) like ${`%${q(term)}%`} or lower(${applicant.name}) like ${`%${q(term)}%`} or ('sa-' || (100000 + ${sellerApplication.seq})::text) = ${term})` : undefined);
  const rows = await db.select({ a: sellerApplication, name: applicant.name, accountStatus: applicant.status, matches: matchCount }).from(sellerApplication).innerJoin(applicant, eq(applicant.id, sellerApplication.userId))
    .where(where).orderBy(desc(sellerApplication.createdAt)).limit(200);
  const counts = Object.fromEntries(await Promise.all((Object.keys(TAB_SQL) as SellerTab[]).map(async (t) => [t, Number((await db.select({ n: sql<number>`count(*)::int` }).from(sellerApplication).innerJoin(applicant, eq(applicant.id, sellerApplication.userId)).where(TAB_SQL[t]))[0]?.n ?? 0)])));
  return { counts: counts as Record<SellerTab, number>, rows: rows.map(({ a, name, accountStatus, matches }) => rowOut(a, name, accountStatus === "closed", Number(matches))) };
}
function rowOut(a: typeof sellerApplication.$inferSelect, name: string, closed: boolean, matches: number): SellerRow {
  const d = a.data as Record<string, unknown>;
  return { id: a.id, number: applicationNumber(a.seq), status: a.status as SellerStatus, tab: tabOf(a.status as SellerStatus, closed), merchantName: a.merchantName, name: `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || name, email: a.email, userId: a.userId, businessCountry: String(d.businessCountry ?? ""), isCompany: d.isCompany === true, createdAt: a.createdAt.toISOString(), matches };
}

const eventAdmin = alias(user, "event_admin");
export async function adminSellerDetail(id: string): Promise<SellerDetail | null> {
  const [r] = await db.select({ a: sellerApplication, name: applicant.name, accountStatus: applicant.status, decider: eventAdmin.email }).from(sellerApplication).innerJoin(applicant, eq(applicant.id, sellerApplication.userId))
    .leftJoin(eventAdmin, eq(eventAdmin.id, sellerApplication.decidedBy)).where(eq(sellerApplication.id, id)).limit(1);
  if (!r) return null;
  const { a } = r; const matchList = await matchesFor(a);
  const files = await db.select().from(sellerFile).where(eq(sellerFile.applicationId, id)).orderBy(sellerFile.createdAt);
  const events = await db.select({ e: sellerEvent, by: eventAdmin.email }).from(sellerEvent).leftJoin(eventAdmin, eq(eventAdmin.id, sellerEvent.adminId)).where(eq(sellerEvent.applicationId, id)).orderBy(desc(sellerEvent.createdAt)).limit(500);
  let idNumber = ""; try { idNumber = decryptText(key(), a.idNumberEnc); } catch { idNumber = `••••${a.idLast4} (cannot decrypt: check KEY_ENCRYPTION_KEY)`; }
  const d = a.data as Omit<SellerInput, "files" | "confirm" | "idNumber">;
  return { ...rowOut(a, r.name, r.accountStatus === "closed", matchList.length), ...d, idType: a.idType as SellerDetail["idType"], idNumber, idLast4: a.idLast4, files: files.map(fileOut),
    events: events.map(({ e, by }) => ({ action: e.action, detail: e.detail, by: e.adminId ? by ?? "Deleted admin" : null, createdAt: e.createdAt.toISOString() })),
    matchList, decidedAt: iso(a.decidedAt), decidedBy: r.decider ?? null, reason: a.reason, blacklistReason: a.blacklistReason, accountClosed: r.accountStatus === "closed" };
}

// Approve (→ role seller + email), reject (reason → applicant), blacklist (reason, admin only), unblacklist (reason, back to the status before).
export async function sellerDecision(adminId: string, id: string, action: SellerAction, reason: string, _origin: string): Promise<{ ok: true } | Fail> {
  const res = await db.transaction(async (tx) => {
    const [a] = await tx.select().from(sellerApplication).where(eq(sellerApplication.id, id)).for("update");
    if (!a) return fail(SELL_ERRORS.notFound, 404);
    const now = new Date(); const set: Partial<typeof sellerApplication.$inferInsert> = { updatedAt: now };
    if (action === "approve" || action === "reject") {
      if (a.status !== "pending") return fail(SELL_ERRORS.notPending, 409);
      Object.assign(set, { status: action === "approve" ? "approved" : "rejected", decidedAt: now, decidedBy: adminId, reason: action === "reject" ? reason : null });
      if (action === "approve") {
        const [u] = await tx.select({ role: user.role }).from(user).where(eq(user.id, a.userId)).for("update");
        if (u && u.role === "customer") {
          await tx.update(user).set({ role: "seller", updatedAt: now }).where(eq(user.id, a.userId));
          await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: a.userId, adminId, action: "role", detail: `customer → seller (${applicationNumber(a.seq)} approved)` });
        }
      }
    } else if (action === "blacklist") {
      if (a.status === "blacklisted") return fail(SELL_ERRORS.already, 409);
      Object.assign(set, { status: "blacklisted", statusBefore: a.status, blacklistReason: reason });
      if (a.status === "approved") { // a blacklisted seller is no longer a seller
        const [u] = await tx.select({ role: user.role }).from(user).where(eq(user.id, a.userId)).for("update");
        if (u?.role === "seller") { await tx.update(user).set({ role: "customer", updatedAt: now }).where(eq(user.id, a.userId)); await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: a.userId, adminId, action: "role", detail: `seller → customer (${applicationNumber(a.seq)} blacklisted)` }); }
      }
    } else {
      if (a.status !== "blacklisted") return fail(SELL_ERRORS.notBlacklisted, 409);
      Object.assign(set, { status: a.statusBefore === "approved" ? "rejected" : a.statusBefore ?? "rejected", statusBefore: null }); // never silently back to seller
    }
    await tx.update(sellerApplication).set(set).where(eq(sellerApplication.id, id));
    await tx.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: id, adminId, action, detail: action === "approve" ? "" : reason });
    return { ok: true as const, email: a.email, number: applicationNumber(a.seq), merchant: a.merchantName, name: (a.data as { firstName?: string }).firstName ?? "", business: (a.data as { isCompany?: boolean }).isCompany === true };
  });
  if (!res.ok) return res;
  if (action === "approve") await sendTemplate(res.email, "sellerApproved", { name: res.name, merchant: res.merchant });
  if (action === "reject") await sendTemplate(res.email, "sellerRejected", { name: res.name, merchant: res.merchant, reason, business: res.business });
  return { ok: true };
}

// One file for an admin (section "sellers"); every call writes a history row (view or download).
export async function readSellerFile(adminId: string, fileId: string, download: boolean) {
  const [f] = await db.select().from(sellerFile).where(eq(sellerFile.id, fileId)).limit(1);
  if (!f || !f.applicationId) return null;
  const bytes = decryptBytes(key(), await fs.readFile(path.join(dir(), f.storedName)));
  await db.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: f.applicationId, adminId, action: download ? "downloaded" : "viewed", detail: `${FILE_KINDS.find((k) => k.id === f.kind)?.label ?? f.kind} (${f.originalName})` });
  return { bytes, mime: f.mime, name: f.originalName };
}
