import { and, desc, eq, gte, ilike, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { convertMinor, crossRate, formatMoney } from "@/lib/currency/money";
import {
  checkAmount, checkDailyCap, closeReasonOk, COUNTS_TOWARD_CAP, dailyCapThb, DAY_MS, PENDING_MS, TOPUP_ERRORS, TOPUP_PAGE_SIZE, topUpLimits, topUpNumber, USD_RATE,
  type AdminTopUp, type AdminTopUpDetail, type AdminTopUpPage, type AdminTopUpQuery, type NewTopUp, type PaymentStart, type TopUp, type TopUpStatus,
} from "@/lib/topup";
import { db } from "./db";
import { paymentEvent, topUp, user, userAudit, walletLedger } from "./db/schema";
import { paymentProvider } from "./payments";
import { devSign } from "./payments/dev";
import { mailTopUp } from "./wallet-mail";
import { publicCurrencies } from "./rates";

// Wallet top-ups (future task T1). Rules: lib/topup.ts. Money is credited ONLY by handleWebhook (a verified provider event):
// never by the browser return page. Crediting = lock the top-up row, then one wallet_ledger "top_up" row, in one transaction.
type Row = typeof topUp.$inferSelect;
type Fail = { ok: false; error: string; status: number };
const iso = (d: Date | null) => d?.toISOString() ?? null;
const toTopUp = (r: Row): TopUp => ({ id: r.id, number: r.number, amountMinor: r.amountMinor, currency: r.currency, creditMinor: r.creditMinor, status: r.status as TopUpStatus, provider: r.provider,
  failureReason: r.failureReason, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(), paidAt: iso(r.paidAt), creditedAt: iso(r.creditedAt), closedAt: iso(r.closedAt) });

// Pending rows past their 30-minute deadline become expired (run before every read; no background job needed).
export async function expireStale(userId?: string) {
  const now = new Date();
  await db.update(topUp).set({ status: "expired", closedAt: now, failureReason: "Not paid within 30 minutes." })
    .where(and(eq(topUp.status, "pending"), lte(topUp.expiresAt, now), userId ? eq(topUp.userId, userId) : undefined));
}

async function startPayment(r: Row, email: string, origin: string): Promise<PaymentStart> {
  const back = `${origin}/account/balance/top-up?id=${encodeURIComponent(r.id)}`;
  const created = await paymentProvider().createPayment({ topUpId: r.id, number: r.number, amountMinor: r.amountMinor, currency: r.currency, email, returnUrl: back, cancelUrl: back });
  if (created.providerRef && created.providerRef !== r.providerRef) await db.update(topUp).set({ providerRef: created.providerRef }).where(eq(topUp.id, r.id));
  return created.start;
}

export async function createTopUp(u: { id: string; email: string }, input: NewTopUp, origin: string): Promise<{ ok: true; topUp: TopUp; payment: PaymentStart | null } | Fail> {
  const provider = paymentProvider();
  if (!provider.available) return { ok: false, error: TOPUP_ERRORS.unavailable, status: 503 };
  const rates = await publicCurrencies();
  const cur = rates.currencies.find((c) => c.code === input.currency);
  if (!cur || !cur.chargeable || !provider.supports(cur.code)) return { ok: false, error: TOPUP_ERRORS.currency, status: 400 };
  const usd = rates.currencies.find((c) => c.code === "USD") ?? USD_RATE;
  const amountError = checkAmount(input.amountMinor, topUpLimits(cur, usd), cur.symbol);
  if (amountError) return { ok: false, error: amountError, status: 400 };
  const creditMinor = convertMinor(input.amountMinor, cur, rates.base);
  const capThb = dailyCapThb(rates.base, usd);

  const res = await db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, u.id)).for("update"); // one top-up change per user at a time
    const [same] = await tx.select().from(topUp).where(and(eq(topUp.userId, u.id), eq(topUp.idempotencyKey, input.idempotencyKey))).limit(1);
    if (same) return { ok: true as const, row: same, replay: true };
    const now = new Date();
    // Daily cap: paid + credited in the last 24 hours (older pending rows are cancelled below, so they do not count).
    const [used] = await tx.select({ n: sql<number>`coalesce(sum(${topUp.creditMinor}), 0)::int` }).from(topUp)
      .where(and(eq(topUp.userId, u.id), inArray(topUp.status, COUNTS_TOWARD_CAP.filter((s) => s !== "pending")), gte(topUp.createdAt, new Date(now.getTime() - DAY_MS))));
    const capError = checkDailyCap(creditMinor, Number(used?.n ?? 0), capThb, (thb) => formatMoney(Math.floor(convertMinor(thb, rates.base, { ...cur, roundStep: 1 })), cur));
    if (capError) return { ok: false as const, error: capError, status: 400 };
    // One open top-up per customer: a new one cancels the older pending one.
    await tx.update(topUp).set({ status: "cancelled", closedAt: now, failureReason: "Replaced by a newer top-up." }).where(and(eq(topUp.userId, u.id), eq(topUp.status, "pending")));
    const [row] = await tx.insert(topUp).values({ id: crypto.randomUUID(), number: topUpNumber(), userId: u.id, amountMinor: input.amountMinor, currency: cur.code, creditMinor,
      fxRate: crossRate(rates.base, cur), status: "pending", provider: provider.id, idempotencyKey: input.idempotencyKey, createdAt: now, expiresAt: new Date(now.getTime() + PENDING_MS) }).returning();
    return { ok: true as const, row, replay: false };
  });
  if (!res.ok) return res;
  if (res.row.status !== "pending") return { ok: true, topUp: toTopUp(res.row), payment: null };
  try {
    return { ok: true, topUp: toTopUp(res.row), payment: await startPayment(res.row, u.email, origin) };
  } catch (e) {
    console.error("[CoreCart payments] createPayment failed", e);
    if (!res.replay) await db.update(topUp).set({ status: "failed", closedAt: new Date(), failureReason: "The payment could not be started." }).where(and(eq(topUp.id, res.row.id), eq(topUp.status, "pending")));
    return { ok: false, error: "The payment could not be started. Try again.", status: 502 };
  }
}

export async function listTopUps(userId: string): Promise<TopUp[]> {
  await expireStale(userId);
  return (await db.select().from(topUp).where(eq(topUp.userId, userId)).orderBy(desc(topUp.createdAt)).limit(50)).map(toTopUp);
}
// Daily cap left (THB satang): cap minus paid + credited top-ups in the last 24 hours. Shown on the top-up page.
export async function dailyLeftThb(userId: string) {
  const rates = await publicCurrencies();
  const [used] = await db.select({ n: sql<number>`coalesce(sum(${topUp.creditMinor}), 0)::int` }).from(topUp)
    .where(and(eq(topUp.userId, userId), inArray(topUp.status, ["paid", "credited"]), gte(topUp.createdAt, new Date(Date.now() - DAY_MS))));
  return Math.max(0, dailyCapThb(rates.base, rates.currencies.find((c) => c.code === "USD") ?? USD_RATE) - Number(used?.n ?? 0));
}
export async function getTopUp(userId: string, id: string): Promise<TopUp | null> {
  await expireStale(userId);
  const [r] = await db.select().from(topUp).where(and(eq(topUp.userId, userId), or(eq(topUp.id, id), eq(topUp.number, id.toUpperCase())))).limit(1);
  return r ? toTopUp(r) : null;
}

// ─── Webhook ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// status: HTTP answer for the provider. 200 = received (also for repeats, so the provider stops retrying); 400 = bad signature;
// 500 = our error (the provider retries; the event row keeps result "error: …" so the retry is processed again, not skipped).
export async function handleWebhook(raw: string, headers: Headers): Promise<{ status: number; result: string }> {
  const provider = paymentProvider();
  const ev = await provider.verifyWebhook(raw, headers);
  if (!ev) return { status: 400, result: "bad signature" };
  const [inserted] = await db.insert(paymentEvent).values({ id: crypto.randomUUID(), provider: provider.id, eventId: ev.eventId, type: ev.rawType.slice(0, 80), payload: raw.slice(0, 65536) })
    .onConflictDoNothing().returning({ id: paymentEvent.id });
  let eventRowId = inserted?.id;
  if (!eventRowId) {
    const [old] = await db.select().from(paymentEvent).where(and(eq(paymentEvent.provider, provider.id), eq(paymentEvent.eventId, ev.eventId))).limit(1);
    if (!old || !old.result.startsWith("error")) return { status: 200, result: "duplicate" };
    eventRowId = old.id; // an earlier try failed on our side: process it again
  }
  try {
    const out = await db.transaction(async (tx) => {
      const where = ev.topUpId ? eq(topUp.id, ev.topUpId) : ev.providerRef ? and(eq(topUp.provider, provider.id), eq(topUp.providerRef, ev.providerRef)) : undefined;
      if (!where) return { result: "ignored: no top-up id", topUpId: null };
      const [t] = await tx.select().from(topUp).where(where).for("update"); // row lock: a parallel repeat waits here, then sees "credited"
      if (!t) return { result: "ignored: unknown top-up", topUpId: null };
      const now = new Date();
      if (ev.type === "payment.succeeded") {
        if (t.status === "credited") return { result: "ignored: already credited", topUpId: t.id };
        if ((ev.amountMinor != null && ev.amountMinor !== t.amountMinor) || (ev.currency && ev.currency.toUpperCase() !== t.currency))
          return { result: `error: amount mismatch (${ev.amountMinor} ${ev.currency} ≠ ${t.amountMinor} ${t.currency})`, topUpId: t.id };
        // Paid after it expired or was cancelled: the money was taken, so it is still credited (the note says so).
        const late = t.status === "pending" ? null : `Paid after it was ${t.status}.`;
        await tx.update(topUp).set({ status: "credited", paidAt: t.paidAt ?? now, creditedAt: now, closedAt: null, failureReason: late }).where(eq(topUp.id, t.id));
        await tx.insert(walletLedger).values({ id: crypto.randomUUID(), userId: t.userId, bucket: "wallet", type: "top_up", amountMinor: t.creditMinor, ref: t.number, topUpId: t.id, createdAt: now });
        return { result: "credited", topUpId: t.id };
      }
      if (ev.type === "payment.failed") {
        if (t.status !== "pending") return { result: `ignored: top-up is ${t.status}`, topUpId: t.id };
        await tx.update(topUp).set({ status: "failed", closedAt: now, failureReason: (ev.reason || "The payment failed.").slice(0, 200) }).where(eq(topUp.id, t.id));
        return { result: "failed", topUpId: t.id };
      }
      return { result: `ignored: ${ev.type === "refund.succeeded" ? "refunds come with the payment provider" : ev.rawType}`, topUpId: t.id };
    });
    await db.update(paymentEvent).set({ result: out.result.slice(0, 200), topUpId: out.topUpId, processedAt: new Date() }).where(eq(paymentEvent.id, eventRowId));
    if (out.result === "credited" && out.topUpId) await mailTopUp(out.topUpId).catch((e) => console.error("[CoreCart email] top-up", e));
    return { status: 200, result: out.result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CoreCart payments] webhook failed", msg);
    await db.update(paymentEvent).set({ result: `error: ${msg}`.slice(0, 200), processedAt: new Date() }).where(eq(paymentEvent.id, eventRowId));
    return { status: 500, result: "error" };
  }
}

// Dev adapter only: the "Simulate" buttons build a signed provider event and send it through handleWebhook (same path as a
// real provider). "resend" repeats the last event with the same event id (shows that a double webhook credits once).
export async function simulateTopUp(userId: string, id: string, outcome: "paid" | "failed" | "resend"): Promise<{ ok: true; topUp: TopUp; result: string } | Fail> {
  if (!paymentProvider().simulate) return { ok: false, error: TOPUP_ERRORS.simulate, status: 403 };
  const t = await getTopUp(userId, id);
  if (!t) return { ok: false, error: TOPUP_ERRORS.notFound, status: 404 };
  let raw: string;
  if (outcome === "resend") {
    const [last] = await db.select().from(paymentEvent).where(and(eq(paymentEvent.topUpId, t.id), eq(paymentEvent.provider, "dev"))).orderBy(desc(paymentEvent.receivedAt)).limit(1);
    if (!last) return { ok: false, error: "No payment event to send again yet.", status: 400 };
    raw = last.payload;
  } else {
    raw = JSON.stringify({ id: `dev_evt_${crypto.randomUUID()}`, type: outcome === "paid" ? "payment.succeeded" : "payment.failed", topUpId: t.id, amountMinor: t.amountMinor, currency: t.currency,
      ...(outcome === "failed" ? { reason: "Card declined (simulated)." } : {}) });
  }
  const r = await handleWebhook(raw, new Headers({ "x-dev-signature": devSign(raw) }));
  const after = await getTopUp(userId, t.id);
  return { ok: true, topUp: after!, result: r.result };
}

// ─── Admin ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const adminCols = { t: topUp, email: user.email };
function toAdmin(r: Row, email: string | null, closedBy: string | null): AdminTopUp {
  return { ...toTopUp(r), userId: r.userId, email: email ?? "Deleted user", providerRef: r.providerRef, fxRate: r.fxRate, closedBy };
}
async function closerEmails(rows: Row[]) {
  const ids = [...new Set(rows.map((r) => r.closedBy).filter((x): x is string => Boolean(x)))];
  if (!ids.length) return new Map<string, string>();
  return new Map((await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, ids))).map((x) => [x.id, x.email]));
}

export async function adminTopUps(q: AdminTopUpQuery): Promise<AdminTopUpPage> {
  await expireStale();
  const conds: (SQL | undefined)[] = [];
  const term = q.q?.trim();
  if (term) conds.push(or(ilike(user.email, `%${term}%`), ilike(topUp.number, `%${term}%`)));
  if (q.status) conds.push(eq(topUp.status, q.status));
  if (q.provider) conds.push(eq(topUp.provider, q.provider));
  if (q.from && !Number.isNaN(Date.parse(q.from))) conds.push(gte(topUp.createdAt, new Date(`${q.from.slice(0, 10)}T00:00:00+07:00`)));
  if (q.to && !Number.isNaN(Date.parse(q.to))) conds.push(lt(topUp.createdAt, new Date(new Date(`${q.to.slice(0, 10)}T00:00:00+07:00`).getTime() + DAY_MS)));
  const where = and(...conds);
  const page = Math.max(1, Math.floor(q.page ?? 1));
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(topUp).leftJoin(user, eq(user.id, topUp.userId)).where(where);
  const rows = await db.select(adminCols).from(topUp).leftJoin(user, eq(user.id, topUp.userId)).where(where).orderBy(desc(topUp.createdAt)).limit(TOPUP_PAGE_SIZE).offset((page - 1) * TOPUP_PAGE_SIZE);
  const closers = await closerEmails(rows.map((r) => r.t));
  return { total: Number(c?.n ?? 0), page, pageSize: TOPUP_PAGE_SIZE, topUps: rows.map((r) => toAdmin(r.t, r.email, r.t.closedBy ? closers.get(r.t.closedBy) ?? "Deleted admin" : null)) };
}

export async function adminTopUp(id: string): Promise<AdminTopUpDetail | null> {
  await expireStale();
  const [r] = await db.select(adminCols).from(topUp).leftJoin(user, eq(user.id, topUp.userId)).where(or(eq(topUp.id, id), eq(topUp.number, id.toUpperCase()))).limit(1);
  if (!r) return null;
  const closers = await closerEmails([r.t]);
  const events = await db.select().from(paymentEvent).where(eq(paymentEvent.topUpId, r.t.id)).orderBy(desc(paymentEvent.receivedAt));
  return { ...toAdmin(r.t, r.email, r.t.closedBy ? closers.get(r.t.closedBy) ?? "Deleted admin" : null),
    events: events.map((e) => ({ id: e.id, eventId: e.eventId, type: e.type, result: e.result, receivedAt: e.receivedAt.toISOString() })) };
}

// Admin "Mark failed" / "Cancel" on a pending top-up, with a reason + audit. Admins never credit here (that is S8 Adjust balance).
export async function adminCloseTopUp(adminId: string, id: string, action: "fail" | "cancel", reason: unknown): Promise<{ ok: true; topUp: AdminTopUpDetail } | Fail> {
  if (!closeReasonOk(reason)) return { ok: false, error: TOPUP_ERRORS.reason, status: 400 };
  await expireStale();
  const res = await db.transaction(async (tx) => {
    const [t] = await tx.select().from(topUp).where(eq(topUp.id, id)).for("update");
    if (!t) return { ok: false as const, error: TOPUP_ERRORS.notFound, status: 404 };
    if (t.status !== "pending") return { ok: false as const, error: TOPUP_ERRORS.notPending, status: 409 };
    const status = action === "fail" ? "failed" : "cancelled"; const text = reason.trim();
    await tx.update(topUp).set({ status, closedAt: new Date(), closedBy: adminId, failureReason: text }).where(eq(topUp.id, t.id));
    await tx.insert(userAudit).values({ id: crypto.randomUUID(), userId: t.userId, adminId, action: action === "fail" ? "topup_failed" : "topup_cancelled", detail: `${t.number} · ${text}` });
    return { ok: true as const, id: t.id };
  });
  if (!res.ok) return res;
  return { ok: true, topUp: (await adminTopUp(res.id))! };
}

// Admin user detail: that customer's latest top-ups.
export async function userTopUps(userId: string): Promise<TopUp[]> {
  await expireStale(userId);
  return (await db.select().from(topUp).where(eq(topUp.userId, userId)).orderBy(desc(topUp.createdAt)).limit(20)).map(toTopUp);
}
