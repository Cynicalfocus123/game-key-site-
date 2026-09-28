import type { PaymentStart } from "@/lib/topup";

// Payment provider plug-in (future task T1). One adapter per provider; lib/server/payments/index.ts picks it from env PAYMENT_PROVIDER.
// A real provider only has to implement this interface (see stub.ts for the Stripe / Omise / 2C2P steps). Nothing else changes:
// top-up rules, tables, webhook route, UI and admin pages stay as they are.

// What an adapter gets to start a payment. amountMinor is in `currency` minor units (the provider's own unit for most providers).
export type PaymentRequest = { topUpId: string; number: string; amountMinor: number; currency: string; email: string; returnUrl: string; cancelUrl: string };
// providerRef = the provider's payment id (saved on the top-up; webhooks may send only this).
export type PaymentCreated = { start: PaymentStart; providerRef: string | null };

// A verified webhook event, already mapped to CoreCart terms. eventId must be the provider's unique event id (idempotency key).
export type PaymentEvent = {
  eventId: string;
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded" | "other";
  rawType: string; // provider's own event name, kept in the log
  topUpId?: string | null; // from metadata we sent (preferred)
  providerRef?: string | null; // or the provider payment id
  amountMinor?: number | null; // amount the provider says it charged (checked against the top-up)
  currency?: string | null;
  reason?: string | null; // failure text for payment.failed
};

export interface PaymentProvider {
  id: string; // saved on top_up.provider and payment_event.provider
  label: string;
  available: boolean; // false = Pay is disabled ("Card payments coming soon") and no top-up rows are created
  simulate: boolean; // true only for the dev adapter: the UI shows "Simulate paid / failed"
  supports(currency: string): boolean; // currencies this provider can charge (the store's chargeable list still applies first)
  createPayment(req: PaymentRequest): Promise<PaymentCreated>;
  // raw = request body exactly as received (signatures are computed over the raw bytes). null = bad or missing signature → 400.
  verifyWebhook(raw: string, headers: Headers): Promise<PaymentEvent | null>;
  // Later: refund to card. Money goes back through the provider; its "refunded" webhook will write the wallet debit line.
  refund?(providerRef: string, amountMinor: number, currency: string): Promise<{ ok: true; refundRef: string } | { ok: false; error: string }>;
}
