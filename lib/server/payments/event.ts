// R8: the normalized payment event contract + the checks that must pass before a top-up is credited.
// Pure (no database, no imports), so the rules are unit-tested in e2e/review-fixes.spec.ts and used by lib/server/topups.ts.
//
// Adapter rules (every provider, incl. the future Stripe / Omise / 2C2P adapters in stub.ts):
// - Only an AUTHENTICATED event may become a PaymentEvent (signature over the raw body, or the event fetched back from the provider).
// - "payment.succeeded" means the provider says the payment is COMPLETE (captured / paid), never pending / authorized-only.
// - A success event must carry the gross charged amount (in OUR minor units: lib/currency decimals 0 / 2 / 3, e.g. JPY 0, KWD 3;
//   convert if the provider counts differently), the charged currency and the provider's payment reference (the one saved on
//   top_up.provider_ref by createPayment). If the notification lacks any of these, the adapter must fetch the verified payment
//   from the provider API first. Never copy the missing value from our own top-up row.
// - eventId (the provider's event id, used to skip repeats) is NOT the payment reference: several events can describe one payment.

export type PaymentEventBase = { eventId: string; rawType: string; topUpId: string | null; providerRef: string | null };
export type PaymentEvent =
  | (PaymentEventBase & { type: "payment.succeeded"; providerRef: string; amountMinor: number; currency: string })
  | (PaymentEventBase & { type: "payment.failed"; reason: string | null })
  | (PaymentEventBase & { type: "refund.succeeded" | "other" });

const ID_RE = /^[\w.:-]{1,200}$/;
const id = (v: unknown) => (typeof v === "string" && ID_RE.test(v) ? v : null);

// Runtime check of what an adapter built from an external payload. Returns the event or why it was refused.
export function normalizeEvent(input: Record<string, unknown>): { ok: true; ev: PaymentEvent } | { ok: false; reason: string } {
  const eventId = id(input.eventId); const rawType = typeof input.rawType === "string" && input.rawType ? input.rawType.slice(0, 80) : null;
  if (!eventId) return { ok: false, reason: "missing event id" };
  if (!rawType) return { ok: false, reason: "missing event type" };
  const topUpId = input.topUpId == null ? null : id(input.topUpId);
  if (input.topUpId != null && !topUpId) return { ok: false, reason: "invalid top-up id" };
  const providerRef = input.providerRef == null ? null : id(input.providerRef);
  if (input.providerRef != null && !providerRef) return { ok: false, reason: "invalid payment reference" };
  const base = { eventId, rawType, topUpId, providerRef };
  if (input.type === "payment.succeeded") {
    const a = input.amountMinor;
    if (a == null) return { ok: false, reason: "missing amount" };
    if (typeof a !== "number" || !Number.isSafeInteger(a) || a <= 0) return { ok: false, reason: "invalid amount" };
    if (input.currency == null || input.currency === "") return { ok: false, reason: "missing currency" };
    const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, reason: "invalid currency" };
    if (!providerRef) return { ok: false, reason: "missing payment reference" };
    return { ok: true, ev: { ...base, type: "payment.succeeded", providerRef, amountMinor: a, currency } };
  }
  if (input.type === "payment.failed") return { ok: true, ev: { ...base, type: "payment.failed", reason: typeof input.reason === "string" ? input.reason.slice(0, 200) : null } };
  return { ok: true, ev: { ...base, type: input.type === "refund.succeeded" ? "refund.succeeded" : "other" } };
}

// The saved top-up facts the event is compared with (the gross amount + currency the customer was asked to pay).
export type TopUpFacts = { id: string; provider: string; providerRef: string | null; amountMinor: number; currency: string };
// permanent = retrying the same event can never succeed (refuse, acknowledge, flag for an admin);
// transient = may succeed later (our payment reference was not saved yet): the webhook answers 503 so the provider retries.
export type MatchResult = { ok: true } | { ok: false; kind: "permanent" | "transient"; reason: string };

// Every check before a success (or failure) event may change a top-up. `verifier` = id of the adapter that authenticated it.
export function matchEvent(ev: PaymentEvent, t: TopUpFacts, verifier: string): MatchResult {
  if (t.provider !== verifier) return { ok: false, kind: "permanent", reason: `wrong provider (${verifier} event, ${t.provider} top-up)` };
  if (ev.topUpId && ev.topUpId !== t.id) return { ok: false, kind: "permanent", reason: "top-up id and payment reference name different top-ups" };
  if (ev.type !== "payment.succeeded" && ev.type !== "payment.failed") return { ok: true };
  if (!ev.providerRef) return { ok: false, kind: "permanent", reason: "missing payment reference" };
  if (!t.providerRef) return { ok: false, kind: "transient", reason: "payment reference not saved yet" };
  if (ev.providerRef !== t.providerRef) return { ok: false, kind: "permanent", reason: "payment reference mismatch" };
  if (ev.type === "payment.succeeded") {
    if (ev.currency !== t.currency.toUpperCase()) return { ok: false, kind: "permanent", reason: `currency mismatch (${ev.currency} ≠ ${t.currency})` };
    if (ev.amountMinor !== t.amountMinor) return { ok: false, kind: "permanent", reason: `amount mismatch (${ev.amountMinor} ≠ ${t.amountMinor} ${t.currency})` };
  }
  return { ok: true };
}
