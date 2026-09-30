import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./types";

// Development adapter (PAYMENT_PROVIDER=dev, never in production: index.ts refuses it). No money moves.
// It behaves like a real provider: payments are confirmed only by a signed webhook to /api/payments/webhook.
// Signature: header x-dev-signature = hex HMAC-SHA256(PAYMENT_DEV_SECRET, raw body). The dev "Simulate" button and the smoke
// test sign events with the same secret. Body: { id, type: "payment.succeeded" | "payment.failed", topUpId, providerRef, amountMinor, currency, reason? }.
// R8: a success event must carry amount, currency and providerRef (the dev_… reference saved at create); the shared check refuses it otherwise.
export const DEV_SECRET = () => process.env.PAYMENT_DEV_SECRET || "corecart-dev-webhook-secret";
export const devSign = (raw: string) => createHmac("sha256", DEV_SECRET()).update(raw).digest("hex");

function sameHex(a: string, b: string) {
  const x = Buffer.from(a, "hex"); const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export const devProvider: PaymentProvider = {
  id: "dev",
  label: "Development (simulated payments)",
  available: true,
  simulate: true,
  supports: () => true,
  async createPayment(req) { return { start: { kind: "simulate" }, providerRef: `dev_${req.topUpId}` }; }, // unique per top-up
  async verifyWebhook(raw, headers) {
    const sig = headers.get("x-dev-signature") ?? "";
    if (!/^[0-9a-f]{64}$/.test(sig) || !sameHex(sig, devSign(raw))) return null;
    let b: Record<string, unknown>; try { b = JSON.parse(raw); } catch { return null; }
    if (!b || typeof b !== "object") return null;
    // Values pass through untouched (no defaults): normalizeEvent decides what is missing or invalid.
    return { eventId: b.id, type: b.type, rawType: b.type, topUpId: b.topUpId, providerRef: b.providerRef, amountMinor: b.amountMinor, currency: b.currency, reason: b.reason };
  },
};
