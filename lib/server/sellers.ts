import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { hasPerm, isAdminRole } from "@/lib/admin-perms";
import { emailTime } from "@/lib/emails";
import { applicationNumber, checkFile, checkSeller, cleanIdNumber, completedSteps, draftProgress, fileKindLabel, firstBadStep, freezeDays, greetingName, isBusiness, isSellerType, merchantKey, parseSellerInput, SELL_ERRORS, sniffMime, stepsFor, STEP_LABEL, storedAnswers, tabOf, usedFiles,
  FREEZE_MS, type Answers, type FileKind, type FreezeNotice, type SalesHold, type MyApplication, type MyApplicationDetails, type SellerAction, type SellerDetail, type SellerDraft, type SellerErrors, type SellerFile, type SellerInput, type SellerMatch, type SellerRow, type SellerStatus, type SellerTab, type SellerType, type StepId } from "@/lib/sellers";
import { TERMS_VERSION } from "@/lib/terms";
import { db } from "./db";
import { sellerApplication, sellerDraft, sellerEvent, sellerFile, user, userAudit } from "./db/schema";
import { sendTemplate } from "./email";
import { decryptBytes, decryptText, encryptBytes, encryptText, encryptionKey, hmacOf } from "./secure";

type Fail = { ok: false; error: string; status: number; errors?: SellerErrors };
// R3: unique index seller_app_merchant_open_idx (migration 0023) = one pending / approved application per merchant name, also
// between two different people sending at the same moment. Postgres (node-postgres / PGlite) reports it as 23505 with the index name.
function merchantClash(e: unknown): boolean {
  for (let x = e as { code?: string; constraint?: string; message?: string; cause?: unknown } | undefined, i = 0; x && i < 4; x = x.cause as typeof x, i++)
    if (x.code === "23505" && (x.constraint === "seller_app_merchant_open_idx" || String(x.message).includes("seller_app_merchant_open_idx"))) return true;
  return false;
}
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

const holdOf = (a: typeof sellerApplication.$inferSelect): SalesHold | null => (a.freezeUntil ? { until: a.freezeUntil.toISOString(), releasedAt: iso(a.freezeReleasedAt), releasedBy: a.freezeReleasedBy } : null);
const mine = (a: typeof sellerApplication.$inferSelect): MyApplication => ({ hold: a.status === "approved" ? holdOf(a) : null, id: a.id, number: applicationNumber(a.seq), status: a.status === "blacklisted" ? "rejected" : a.status as SellerStatus, sellerType: a.sellerType as SellerType, merchantName: a.merchantName,
  createdAt: a.createdAt.toISOString(), decidedAt: iso(a.decidedAt), reason: a.status === "rejected" ? a.reason : a.status === "blacklisted" ? "Your application was not accepted." : null });
async function latest(userId: string) {
  await releaseDueFreezes();
  const [a] = await db.select().from(sellerApplication).where(eq(sellerApplication.userId, userId)).orderBy(desc(sellerApplication.createdAt)).limit(1);
  return a ?? null;
}
// The applicant's latest application (a blacklisted one shows as rejected; the blacklist reason is admin only).
export async function myApplication(userId: string) { const a = await latest(userId); return a ? mine(a) : null; }
// "Go to details": the latest application read-only (answers, file names, last 4 of the document number; never file content).
export async function myApplicationDetails(userId: string): Promise<MyApplicationDetails | null> {
  const a = await latest(userId); if (!a) return null;
  const files = await db.select().from(sellerFile).where(eq(sellerFile.applicationId, a.id)).orderBy(sellerFile.createdAt);
  return { ...mine(a), answers: a.data as Answers, idLast4: a.idLast4, files: files.map(fileOut), termsVersion: a.termsVersion, termsAcceptedAt: iso(a.termsAcceptedAt) };
}

// ---------- Draft (one per user, resumed on any device; never shown to admins) ----------
// Every file id the input mentions (all kinds + supplier proofs), to keep only the user's own unsent files.
const allIds = (i: SellerInput) => [...Object.values(i.files).flat(), ...i.suppliers.flatMap((s) => s.files)];
async function ownFiles(userId: string, fileIds: string[]) {
  return fileIds.length ? db.select().from(sellerFile).where(and(inArray(sellerFile.id, fileIds), eq(sellerFile.userId, userId), isNull(sellerFile.applicationId))) : [];
}
// Drop file ids that are not this user's unsent uploads of the right kind (a stale or foreign id never reaches the draft).
function keepFiles(i: SellerInput, rows: (typeof sellerFile.$inferSelect)[]): SellerInput {
  const ok = (kind: string) => (fid: string) => rows.some((r) => r.id === fid && r.kind === kind);
  const files = Object.fromEntries(Object.entries(i.files).map(([k, v]) => [k, v.filter(ok(k))])) as SellerInput["files"];
  return { ...i, files, suppliers: i.suppliers.map((s) => ({ ...s, files: s.files.filter(ok("supplier_proof")) })) };
}
async function openApplication(userId: string) {
  const [open] = await db.select({ status: sellerApplication.status }).from(sellerApplication).where(and(eq(sellerApplication.userId, userId), inArray(sellerApplication.status, ["pending", "approved"]))).limit(1);
  return open ? fail(open.status === "pending" ? SELL_ERRORS.pending : SELL_ERRORS.approved, 409) : null;
}
async function draftOut(row: typeof sellerDraft.$inferSelect): Promise<SellerDraft> {
  const data = parseSellerInput({ ...(row.data as Record<string, unknown>), sellerType: row.sellerType });
  let idNumber = ""; if (row.idNumberEnc) try { idNumber = decryptText(key(), row.idNumberEnc); } catch { idNumber = ""; }
  const rows = await ownFiles(row.userId, allIds(data));
  const input = keepFiles({ ...data, idNumber, confirm: false, terms: false }, rows);
  const completed = completedSteps(input, row.completed);
  return { input, completed, progress: draftProgress(input, completed), files: rows.map(fileOut), updatedAt: row.updatedAt.toISOString() };
}
export async function getDraft(userId: string): Promise<SellerDraft | null> {
  const [row] = await db.select().from(sellerDraft).where(eq(sellerDraft.userId, userId)).limit(1);
  return row && !row.discardedAt && !row.submittedApplicationId ? draftOut(row) : null;
}
// Save the draft. `step` = Continue on that step: it must pass its check and every step before it must be Completed; without a step
// (Save for later) the answers are saved as they are.
export async function saveDraft(userId: string, raw: SellerInput, step: StepId | null): Promise<{ ok: true; draft: SellerDraft } | Fail> {
  if (!isSellerType(raw.sellerType)) return fail(SELL_ERRORS.type, 400, { sellerType: SELL_ERRORS.type });
  const open = await openApplication(userId); if (open) return open;
  const input = keepFiles(raw, await ownFiles(userId, allIds(raw)));
  const [prev] = await db.select().from(sellerDraft).where(eq(sellerDraft.userId, userId)).limit(1);
  const marked = prev && !prev.discardedAt && !prev.submittedApplicationId ? prev.completed.filter((s) => stepsFor(input.sellerType as SellerType).includes(s as StepId)) : [];
  if (step) {
    const steps = stepsFor(input.sellerType as SellerType); if (!steps.includes(step)) return fail(SELL_ERRORS.stepOrder);
    const before = completedSteps(input, marked); if (steps.indexOf(step) > before.length) return fail(SELL_ERRORS.stepOrder, 409);
    const errors = checkSeller(input, step, false); if (Object.keys(errors).length) return fail(`Check ${STEP_LABEL[step]}.`, 400, errors);
    if (!marked.includes(step)) marked.push(step);
  }
  const { idNumber, confirm: _c, terms: _t, ...data } = input; const clean = cleanIdNumber(idNumber);
  const set = { sellerType: input.sellerType, data, idNumberEnc: clean ? encryptText(key(), clean) : null, completed: marked, submittedApplicationId: null, discardedAt: null, updatedAt: new Date() };
  const [row] = await db.insert(sellerDraft).values({ userId, ...set }).onConflictDoUpdate({ target: sellerDraft.userId, set }).returning();
  return { ok: true, draft: await draftOut(row) };
}
// Dashboard Delete: answers cleared and hidden, row kept; uploaded files stay on the server (KYC), just not part of any application.
export async function discardDraft(userId: string): Promise<{ ok: true } | Fail> {
  const [row] = await db.select().from(sellerDraft).where(eq(sellerDraft.userId, userId)).limit(1);
  if (!row || row.discardedAt || row.submittedApplicationId) return fail(SELL_ERRORS.noDraft, 404);
  await db.update(sellerDraft).set({ data: {}, idNumberEnc: null, completed: [], discardedAt: new Date(), updatedAt: new Date() }).where(eq(sellerDraft.userId, userId));
  return { ok: true };
}

// Submit: checks every step again (+ confirm + terms), one open application per person, merchant name free, files belong to this user
// and are unused. Terms version + time saved; the draft is marked sent.
export async function submitApplication(u: { id: string; email: string; name: string }, input: SellerInput, _origin: string): Promise<{ ok: true; application: MyApplication } | Fail> {
  const errors = checkSeller(input); if (Object.keys(errors).length) { const s = firstBadStep(input); return fail(s ? `Check ${STEP_LABEL[s]}.` : SELL_ERRORS.type, 400, errors); }
  const k = key(); const idNumber = cleanIdNumber(input.idNumber); const mKey = merchantKey(input.merchantName);
  const res = await db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, u.id)).for("update"); // one submit at a time per user (other users: the R3 unique index)
    const [open] = await tx.select({ status: sellerApplication.status }).from(sellerApplication).where(and(eq(sellerApplication.userId, u.id), inArray(sellerApplication.status, ["pending", "approved"]))).limit(1);
    if (open) return fail(open.status === "pending" ? SELL_ERRORS.pending : SELL_ERRORS.approved, 409);
    const [taken] = await tx.select({ id: sellerApplication.id }).from(sellerApplication).where(and(eq(sellerApplication.merchantKey, mKey), inArray(sellerApplication.status, ["pending", "approved"]), ne(sellerApplication.userId, u.id))).limit(1);
    if (taken) return fail(SELL_ERRORS.merchantTaken, 409, { merchantName: SELL_ERRORS.merchantTaken });
    const wanted = usedFiles(input);
    if (new Set(wanted.map((w) => w.fid)).size !== wanted.length) return fail(SELL_ERRORS.fileBad); // one file in two places
    const rows = wanted.length ? await tx.select().from(sellerFile).where(and(inArray(sellerFile.id, wanted.map((w) => w.fid)), eq(sellerFile.userId, u.id), isNull(sellerFile.applicationId))).for("update") : [];
    if (rows.length !== wanted.length || wanted.some((w) => rows.find((r) => r.id === w.fid)?.kind !== w.kind)) return fail(SELL_ERRORS.fileBad);
    const now = new Date();
    const [a] = await tx.insert(sellerApplication).values({ id: crypto.randomUUID(), userId: u.id, email: u.email, status: "pending", sellerType: input.sellerType, data: storedAnswers(input), merchantName: input.merchantName, merchantKey: mKey,
      idType: input.idType, idNumberEnc: encryptText(k, idNumber), idNumberHash: hmacOf(k, `id:${idNumber}`), idLast4: idNumber.slice(-4), termsVersion: TERMS_VERSION, termsAcceptedAt: now }).returning();
    if (wanted.length) await tx.update(sellerFile).set({ applicationId: a.id }).where(inArray(sellerFile.id, wanted.map((w) => w.fid)));
    await tx.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: a.id, adminId: null, action: "submitted", detail: "" });
    await tx.update(sellerDraft).set({ submittedApplicationId: a.id, idNumberEnc: null, updatedAt: now }).where(eq(sellerDraft.userId, u.id));
    return { ok: true as const, application: mine(a) };
  }).catch((e) => { if (merchantClash(e)) return fail(SELL_ERRORS.merchantTaken, 409, { merchantName: SELL_ERRORS.merchantTaken }); throw e; });
  if (res.ok) {
    const vars = { name: greetingName(storedAnswers(input), u.name), number: res.application.number };
    await sendTemplate(u.email, "sellerReceived", vars);
    if (input.sellerType === "business" && input.rep.email && input.rep.email !== u.email.toLowerCase()) await sendTemplate(input.rep.email, "sellerReceived", vars); // also the representative (screen 8d)
  }
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
  on_hold: sql`${sellerApplication.status} = 'approved' and ${applicant.status} <> 'closed' and ${sellerApplication.freezeUntil} is not null and ${sellerApplication.freezeReleasedAt} is null`,
  rejected: sql`${sellerApplication.status} = 'rejected' and ${applicant.status} <> 'closed'`,
};
// Match count per row in SQL (same rules as matchesFor).
const O = { t: sql.raw('"seller_application" o'), u: sql.raw('"user" ou') };
const matchCount = sql<number>`(
  (select count(*) from ${O.t} join ${O.u} on ou.id = o.user_id where o.id <> ${sellerApplication.id}
    and (o.email = ${sellerApplication.email} or o.merchant_key = ${sellerApplication.merchantKey} or o.id_number_hash = ${sellerApplication.idNumberHash})
    and (o.status in ('rejected', 'blacklisted') or ou.status = 'closed'))
  + (select count(*) from ${O.u} where ou.status = 'closed' and ou.closed_email = ${sellerApplication.email} and ou.id <> ${sellerApplication.userId}))::int`;
const fileCount = sql<number>`(select count(*) from "seller_file" sf where sf.application_id = ${sellerApplication.id})::int`;
export async function adminSellerList(tab: SellerTab, search: string) {
  await releaseDueFreezes();
  const term = search.trim().toLowerCase();
  const where = and(TAB_SQL[tab], term ? sql`(lower(${sellerApplication.merchantName}) like ${`%${q(term)}%`} or lower(${sellerApplication.email}) like ${`%${q(term)}%`} or lower(${applicant.name}) like ${`%${q(term)}%`} or lower(${sellerApplication.data}->>'companyName') like ${`%${q(term)}%`} or ('sa-' || (100000 + ${sellerApplication.seq})::text) = ${term})` : undefined);
  const rows = await db.select({ a: sellerApplication, name: applicant.name, accountStatus: applicant.status, matches: matchCount, files: fileCount }).from(sellerApplication).innerJoin(applicant, eq(applicant.id, sellerApplication.userId))
    .where(where).orderBy(desc(sellerApplication.createdAt)).limit(200);
  const counts = Object.fromEntries(await Promise.all((Object.keys(TAB_SQL) as SellerTab[]).map(async (t) => [t, Number((await db.select({ n: sql<number>`count(*)::int` }).from(sellerApplication).innerJoin(applicant, eq(applicant.id, sellerApplication.userId)).where(TAB_SQL[t]))[0]?.n ?? 0)])));
  return { counts: counts as Record<SellerTab, number>, rows: rows.map(({ a, name, accountStatus, matches, files }) => rowOut(a, name, accountStatus === "closed", Number(matches), Number(files))) };
}
function rowOut(a: typeof sellerApplication.$inferSelect, name: string, closed: boolean, matches: number, files: number): SellerRow {
  const d = a.data as Answers;
  const who = isBusiness(d) && "companyName" in d && d.companyName ? d.companyName : `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || name;
  return { id: a.id, number: applicationNumber(a.seq), status: a.status as SellerStatus, tab: tabOf(a.status as SellerStatus, closed), sellerType: a.sellerType as SellerType, merchantName: a.merchantName, name: who, email: a.email, userId: a.userId,
    businessCountry: String(d.businessCountry ?? ""), fileCount: files, freeze: freezeDays(d), hold: a.status === "approved" ? holdOf(a) : null, createdAt: a.createdAt.toISOString(), matches };
}

const eventAdmin = alias(user, "event_admin");
export async function adminSellerDetail(id: string): Promise<SellerDetail | null> {
  await releaseDueFreezes();
  const [r] = await db.select({ a: sellerApplication, name: applicant.name, accountStatus: applicant.status, decider: eventAdmin.email }).from(sellerApplication).innerJoin(applicant, eq(applicant.id, sellerApplication.userId))
    .leftJoin(eventAdmin, eq(eventAdmin.id, sellerApplication.decidedBy)).where(eq(sellerApplication.id, id)).limit(1);
  if (!r) return null;
  const { a } = r; const matchList = await matchesFor(a);
  const files = await db.select().from(sellerFile).where(eq(sellerFile.applicationId, id)).orderBy(sellerFile.createdAt);
  const events = await db.select({ e: sellerEvent, by: eventAdmin.email }).from(sellerEvent).leftJoin(eventAdmin, eq(eventAdmin.id, sellerEvent.adminId)).where(eq(sellerEvent.applicationId, id)).orderBy(desc(sellerEvent.createdAt)).limit(500);
  let idNumber = ""; try { idNumber = decryptText(key(), a.idNumberEnc); } catch { idNumber = `••••${a.idLast4} (cannot decrypt: check KEY_ENCRYPTION_KEY)`; }
  return { ...rowOut(a, r.name, r.accountStatus === "closed", matchList.length, files.length), answers: a.data as Answers, idType: a.idType, idNumber, idLast4: a.idLast4, files: files.map(fileOut),
    events: events.map(({ e, by }) => ({ action: e.action, detail: e.detail, by: e.adminId ? by ?? "Deleted admin" : null, createdAt: e.createdAt.toISOString() })),
    matchList, termsVersion: a.termsVersion, termsAcceptedAt: iso(a.termsAcceptedAt), decidedAt: iso(a.decidedAt), decidedBy: r.decider ?? null, reason: a.reason, blacklistReason: a.blacklistReason, accountClosed: r.accountStatus === "closed" };
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
      if (action === "approve" && freezeDays(a.data as Answers)) { // invoice-only supplier proof: the 10-day timer starts now
        const until = new Date(now.getTime() + freezeMs());
        Object.assign(set, { freezeUntil: until, freezeReleasedAt: null, freezeReleasedBy: null, freezeNoticeDismissedAt: null });
        await tx.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: id, adminId, action: "freeze_started", detail: until.toISOString() });
      }
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
    } else if (action === "release") { // "Release now": the admin ends the hold early (seller looks complete + trustworthy)
      if (a.status !== "approved" || !a.freezeUntil || a.freezeReleasedAt) return fail(SELL_ERRORS.noHold, 409);
      Object.assign(set, { freezeReleasedAt: now, freezeReleasedBy: adminId, freezeNoticeDismissedAt: now });
    } else {
      if (a.status !== "blacklisted") return fail(SELL_ERRORS.notBlacklisted, 409);
      const back = a.statusBefore === "approved" ? "rejected" : a.statusBefore ?? "rejected"; // never silently back to seller
      if (back === "pending") { // R3: the name may be open elsewhere by now
        const [taken] = await tx.select({ id: sellerApplication.id }).from(sellerApplication).where(and(eq(sellerApplication.merchantKey, a.merchantKey), inArray(sellerApplication.status, ["pending", "approved"]), ne(sellerApplication.id, a.id))).limit(1);
        if (taken) return fail(SELL_ERRORS.merchantOpen, 409);
      }
      Object.assign(set, { status: back, statusBefore: null });
    }
    await tx.update(sellerApplication).set(set).where(eq(sellerApplication.id, id));
    await tx.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: id, adminId, action, detail: action === "approve" ? "" : reason });
    const d = a.data as Answers;
    return { ok: true as const, email: a.email, number: applicationNumber(a.seq), merchant: a.merchantName, name: greetingName(d, ""), business: isBusiness(d), holdUntil: (set.freezeUntil as Date | undefined) ?? null };
  }).catch((e) => { if (merchantClash(e)) return fail(SELL_ERRORS.merchantOpen, 409); throw e; });
  if (!res.ok) return res;
  if (action === "approve") await sendTemplate(res.email, "sellerApproved", { name: res.name, merchant: res.merchant, holdUntil: res.holdUntil ? emailTime(res.holdUntil) : null });
  if (action === "release") await sendTemplate(res.email, "sellerSalesOpen", { name: res.name, merchant: res.merchant, early: true });
  if (action === "reject") await sendTemplate(res.email, "sellerRejected", { name: res.name, merchant: res.merchant, reason, business: res.business });
  return { ok: true };
}

// ---------- Sales freeze timer ----------
// Hold length: FREEZE_MS (10 days). SELLER_FREEZE_SECONDS shortens it for local testing only (ignored in production).
const freezeMs = () => { const s = Number(process.env.SELLER_FREEZE_SECONDS); return process.env.NODE_ENV !== "production" && s > 0 ? s * 1000 : FREEZE_MS; };
let lastCheck = 0; let timer: ReturnType<typeof setInterval> | null = null;
// Start the 5-minute check (instrumentation.api.ts calls it when the server starts; the first read starts it too, as a fallback).
export function startFreezeTimer() {
  if (timer) return;
  timer = setInterval(() => { releaseDueFreezes(true).catch((e) => console.error("[sellers] freeze timer:", e)); }, 5 * 60_000);
  timer.unref?.();
}
// Release every hold whose time has passed. One UPDATE … RETURNING claims each row once (a second server or a second call gets nothing),
// then: history row "System", seller email "sales open", email to every admin with Seller applications; the Overview notice stays until
// an admin dismisses it. Reads call it too (at most every 30 s), so a release is never missed after a restart.
export async function releaseDueFreezes(force = false) {
  startFreezeTimer();
  if (!force && Date.now() - lastCheck < 30_000) return 0;
  lastCheck = Date.now();
  const now = new Date();
  const rows = await db.update(sellerApplication).set({ freezeReleasedAt: now, updatedAt: now })
    .where(and(eq(sellerApplication.status, "approved"), isNull(sellerApplication.freezeReleasedAt), sql`${sellerApplication.freezeUntil} <= ${now}`)).returning();
  if (!rows.length) return 0;
  const admins = (await db.select({ email: user.email, role: user.role, emailVerified: user.emailVerified, adminPerms: user.adminPerms, status: user.status }).from(user).where(inArray(user.role, ["admin", "master_admin"])))
    .filter((u) => u.status !== "closed" && isAdminRole(u.role) && hasPerm(u, "sellers"));
  for (const a of rows) {
    await db.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: a.id, adminId: null, action: "freeze_released", detail: "" });
    const d = a.data as Answers;
    await sendTemplate(a.email, "sellerSalesOpen", { name: greetingName(d, ""), merchant: a.merchantName, early: false });
    for (const ad of admins) await sendTemplate(ad.email, "adminFreezeEnded", { number: applicationNumber(a.seq), merchant: a.merchantName, approvedAt: a.decidedAt ? emailTime(a.decidedAt) : "—", releasedAt: emailTime(now), applicationId: a.id });
  }
  return rows.length;
}
// Admin Overview: holds that ended by themselves and no admin dismissed yet.
export async function freezeNotices(): Promise<FreezeNotice[]> {
  await releaseDueFreezes();
  const rows = await db.select().from(sellerApplication).where(and(isNull(sellerApplication.freezeReleasedBy), isNull(sellerApplication.freezeNoticeDismissedAt), sql`${sellerApplication.freezeReleasedAt} is not null`))
    .orderBy(desc(sellerApplication.freezeReleasedAt)).limit(20);
  return rows.map((a) => ({ id: a.id, number: applicationNumber(a.seq), merchantName: a.merchantName, releasedAt: a.freezeReleasedAt!.toISOString() }));
}
export async function dismissFreezeNotice(adminId: string, id: string): Promise<{ ok: true } | Fail> {
  const [a] = await db.update(sellerApplication).set({ freezeNoticeDismissedAt: new Date() }).where(and(eq(sellerApplication.id, id), isNull(sellerApplication.freezeNoticeDismissedAt), sql`${sellerApplication.freezeReleasedAt} is not null`)).returning({ id: sellerApplication.id });
  if (!a) return fail(SELL_ERRORS.notFound, 404);
  await db.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: id, adminId, action: "notice_dismissed", detail: "" });
  return { ok: true };
}

// One file for an admin (section "sellers"); every call writes a history row (view or download).
export async function readSellerFile(adminId: string, fileId: string, download: boolean) {
  const [f] = await db.select().from(sellerFile).where(eq(sellerFile.id, fileId)).limit(1);
  if (!f || !f.applicationId) return null;
  const bytes = decryptBytes(key(), await fs.readFile(path.join(dir(), f.storedName)));
  await db.insert(sellerEvent).values({ id: crypto.randomUUID(), applicationId: f.applicationId, adminId, action: download ? "downloaded" : "viewed", detail: `${fileKindLabel(f.kind)} (${f.originalName})` });
  return { bytes, mime: f.mime, name: f.originalName };
}
