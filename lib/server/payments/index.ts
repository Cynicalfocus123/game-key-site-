import type { PaymentsConfig } from "@/lib/topup";
import { devProvider } from "./dev";
import { noneProvider } from "./none";
import { omiseProvider, stripeProvider, twoC2pProvider } from "./stub";
import type { PaymentProvider } from "./types";

// Active payment provider from env PAYMENT_PROVIDER: none (default) | dev (development only) | stripe | omise | 2c2p.
// Unknown values, or dev in production, fall back to none (Pay disabled) and log once.
const all: Record<string, PaymentProvider> = { none: noneProvider, dev: devProvider, stripe: stripeProvider, omise: omiseProvider, "2c2p": twoC2pProvider };
let warned = false;
export function paymentProvider(): PaymentProvider {
  const want = (process.env.PAYMENT_PROVIDER || "none").trim().toLowerCase();
  const p = all[want];
  const blocked = want === "dev" && process.env.NODE_ENV === "production";
  if (!p || blocked) {
    if (!warned) { console.error(`[CoreCart payments] PAYMENT_PROVIDER=${want} ${blocked ? "is not allowed in production" : "is unknown"}; card payments stay off.`); warned = true; }
    return noneProvider;
  }
  return p;
}
export const paymentsConfig = (): PaymentsConfig => { const p = paymentProvider(); return { provider: p.id, available: p.available, simulate: p.simulate }; };
export type { PaymentEvent, PaymentProvider, PaymentRequest } from "./types";
