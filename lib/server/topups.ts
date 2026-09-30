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
import { matchEvent, normalizeEvent } from "./payments/event";
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
// R8. HTTP answer for the provider, NOT a credit decision (the result text says what happened to the wallet):
// 200 = handled for good: "credited", "failed", "duplicate", "ignored: …" or "rejected: …" (a permanent mismatch; no credit, the
//       top-up gets an admin review note, and a repeat of that event is never processed again);
// 400 = not authenticated (bad signature);
// 503 = deferred: the event names a payment we cannot match YET (our payment reference not saved). Nothing is credited; the provider
//       retries and the event row ("deferred: …") is processed again;
// 500 = our error (provider retries; "error: …" rows are processed again).
// Before any credit: authenticated → complete payment type with amount + currency + payment reference (normalizeEvent) → top-up found
// (top-up id and reference must name the same one) → same provider → same reference → same gross amount + currency → not credited yet.
// Credit = the creditMinor saved at create (no new exchange rate). A late payment (after expire / cancel) is credited under the same checks.
type Outcome = { result: string; topUpId: string | null; deferred?: boolean };
const retryable = (result: string) => result.startsWith("error") || result.startsWith("deferred");
export async function handleWebhook(raw: string, headers: Headers): Promise<{ status: number; result: string }> {
  const provider = paymentProvider();
  const cand = await provider.verifyWebhook(raw, headers);
  if (!cand) return { status: 400, result: "bad signature" };
  const n = normalizeEvent(cand);
  const eventId = n.ok ? n.ev.eventId : typeof cand.eventId === "string" && /^[\w.:-]{1,200}$/.test(cand.eventId) ? cand.eventId : null;
  if (!eventId) return { status: 400, result: "rejected: missing event id" };
  const [inserted] = await db.insert(paymentEvent).values({ id: crypto.randomUUID(), provider: provider.id, eventId, type: String(cand.rawType ?? cand.type ?? "unknown").slice(0, 80), payload: raw.slice(0, 65536) })
    .onConflictDoNothing().returning({ id: paymentEvent.id });
  let eventRowId = inserted?.id;
  if (!eventRowId) {
    const [old] = await db.select().from(paymentEvent).where(and(eq(paymentEvent.provider, provider.id), eq(paymentEvent.eventId, eventId))).limit(1);
    if (!old || !retryable(old.result)) return { status: 200, result: "duplicate" };
    eventRowId = old.id; // an earlier try failed on our side or was deferred: process it again
  }
  try {
    const out: Outcome = await db.transaction(async (tx) => {
      const now = new Date();
      const flag = async (id: string, reason: string) => {
        const [cur] = await tx.select({ note: topUp.reviewNote }).from(topUp).where(eq(topUp.id, id));
        await tx.update(topUp).set({ reviewNote: `${cur?.note ? cur.note + "\n" : ""}${now.toISOString()} ${provider.id} event ${eventId}: ${reason}`.slice(-2000) }).where(eq(topUp.id, id));
      };
      // An authenticated event that fails the contract (missing amount / currency / reference, bad values): refused for good.
      if (!n.ok) {
        const tid = typeof cand.topUpId === "string" ? cand.topUpId : null;
        const [t] = tid ? await tx.select({ id: topUp.id }).from(topUp).where(and(eq(topUp.id, tid), eq(topUp.provider, provider.id))).for("update") : [];
        if (t && cand.type === "payment.succeeded") await flag(t.id, n.reason);
        return { result: `rejected: ${n.reason}`, topUpId: t?.id ?? null };
      }
      const ev = n.ev;
      // Find the top-up. Top-up id (from our metadata) and payment reference must agree when both are sent.
      const [byId] = ev.topUpId ? await tx.select().from(topUp).where(eq(topUp.id, ev.topUpId)).for("update") : [];
      const [byRef] = ev.providerRef ? await tx.select().from(topUp).where(and(eq(topUp.provider, provider.id), eq(topUp.providerRef, ev.providerRef))).for("update") : [];
      if (ev.topUpId && !byId) return { result: "rejected: unknown top-up", topUpId: null };
      if (byId && byRef && byId.id !== byRef.id) { await flag(byId.id, "top-up id and payment reference name different top-ups"); return { result: "rejected: top-up id and payment reference name different top-ups", topUpId: byId.id }; }
      const t = byId ?? byRef;
      if (!t) {
        if (ev.type === "payment.succeeded" || ev.type === "payment.failed") return { result: "deferred: unknown payment reference (not saved yet?)", topUpId: null, deferred: true };
        return { result: ev.topUpId || ev.providerRef ? "ignored: unknown top-up" : "ignored: no top-up id", topUpId: null };
      }
      if (ev.type !== "payment.succeeded" && ev.type !== "payment.failed")
        return { result: `ignored: ${ev.type === "refund.succeeded" ? "refunds come with the payment provider" : ev.rawType}`, topUpId: t.id };
      const m = matchEvent(ev, t, provider.id);
      if (!m.ok && m.kind === "transient") return { result: `deferred: ${m.reason}`, topUpId: t.id, deferred: true };
      if (!m.ok) { if (t.provider === provider.id || ev.type === "payment.succeeded") await flag(t.id, m.reason); return { result: `rejected: ${m.reason}`, topUpId: t.id }; }
      if (ev.type === "payment.succeeded") {
        if (t.status === "credited") return { result: "ignored: already credited", topUpId: t.id };
        // Paid after it expired or was cancelled: the money was taken, so it is still credited (the note says so).
        const late = t.status === "pending" ? null : `Paid after it was ${t.status}.`;
        await tx.update(topUp).set({ status: "credited", paidAt: t.paidAt ?? now, creditedAt: now, closedAt: null, failureReason: late }).where(eq(topUp.id, t.id));
        await tx.insert(walletLedger).values({ id: crypto.randomUUID(), userId: t.userId, bucket: "wallet", type: "top_up", amountMinor: t.creditMinor, ref: t.number, topUpId: t.id, createdAt: now });
        return { result: "credited", topUpId: t.id };
      }
      if (t.status !== "pending") return { result: `ignored: top-up is ${t.status}`, topUpId: t.id };
      await tx.update(topUp).set({ status: "failed", closedAt: now, failureReason: (ev.reason || "The payment failed.").slice(0, 200) }).where(eq(topUp.id, t.id));
      return { result: "failed", topUpId: t.id };
    });
    await db.update(paymentEvent).set({ result: out.result.slice(0, 200), topUpId: out.topUpId, processedAt: new Date() }).where(eq(paymentEvent.id, eventRowId));
    if (out.result === "credited" && out.topUpId) await mailTopUp(out.topUpId).catch((e) => console.error("[CoreCart email] top-up", e));
    if (out.result.startsWith("rejected")) console.error("[CoreCart payments] event refused", provider.id, eventId, out.result);
    return { status: out.deferred ? 503 : 200, result: out.result };
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
    // R8: a complete event, like a real provider: amount + currency as charged and the payment reference saved at create.
    const [ref] = await db.select({ providerRef: topUp.providerRef }).from(topUp).where(eq(topUp.id, t.id)).limit(1);
    raw = JSON.stringify({ id: `dev_evt_${crypto.randomUUID()}`, type: outcome === "paid" ? "payment.succeeded" : "payment.failed", topUpId: t.id, providerRef: ref?.providerRef ?? null, amountMinor: t.amountMinor, currency: t.currency,
      ...(outcome === "failed" ? { reason: "Card declined (simulated)." } : {}) });
  }
  const r = await handleWebhook(raw, new Headers({ "x-dev-signature": devSign(raw) }));
  const after = await getTopUp(userId, t.id);
  return { ok: true, topUp: after!, result: r.result };
}

// ─── Admin ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const adminCols = { t: topUp, email: user.email };
function toAdmin(r: Row, email: string | null, closedBy: string | null): AdminTopUp {
  return { ...toTopUp(r), userId: r.userId, email: email ?? "Deleted user", providerRef: r.providerRef, fxRate: r.fxRate, closedBy, reviewNote: r.reviewNote };
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
