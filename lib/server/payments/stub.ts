import type { PaymentProvider } from "./types";

// ─── PROVIDER STUBS: Stripe / Omise / 2C2P ──────────────────────────────────────────────────────────────────────────────
// Not connected yet (no provider account, no live keys). Choosing one with PAYMENT_PROVIDER keeps Pay disabled until it is built.
// To connect a provider (no other file needs a redesign):
//  1. Put its keys in .env.local / the host env (e.g. STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET, OMISE_SECRET_KEY, 2C2P merchant id + secret).
//  2. createPayment: create a payment / checkout session for req.amountMinor in req.currency with metadata { topUpId, number },
//     success/cancel URLs = req.returnUrl / req.cancelUrl → return { start: { kind: "redirect", url } } (hosted page) or
//     { kind: "client", data } (card form script) and providerRef = the provider's payment id.
//  3. verifyWebhook: check the signature over the raw body with the provider's secret (Stripe-Signature header, Omise: fetch the
//     event back by id, 2C2P: JWT payload), then map its event to an EventCandidate (eventId = provider event id, topUpId from
//     metadata, providerRef = the SAME reference createPayment returned, amountMinor + currency as charged, gross, in our minor
//     units). "payment.succeeded" only for a completed payment. Missing details → fetch the payment from the provider API first.
//     Rules: lib/server/payments/event.ts. Return null when the signature is wrong. Stripe: pick ONE reference (Checkout Session id
//     saved at create, or the PaymentIntent id) and map every event to it.
//  4. supports(currency): the currencies the account can charge. available: true once keys are set.
//  5. Register the provider's webhook URL: {site}/api/payments/webhook. Then set PAYMENT_PROVIDER=<id> and restart.
//  6. Later, refund(): call the provider's refund API; its refund webhook maps to "refund.succeeded".
// Crediting stays in lib/server/topups.ts (webhook only, one transaction, one ledger row per top-up).
function stub(id: string, label: string): PaymentProvider {
  return {
    id, label, available: false, simulate: false,
    supports: () => false,
    async createPayment() { throw new Error(`${label} is not connected yet`); },
    async verifyWebhook() { return null; },
  };
}
export const stripeProvider = stub("stripe", "Stripe");
export const omiseProvider = stub("omise", "Omise");
export const twoC2pProvider = stub("2c2p", "2C2P");
