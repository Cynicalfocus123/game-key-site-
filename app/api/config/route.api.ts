import { json, sampleOrdersAllowed } from "@/lib/server/session";
import { stripeConfigured } from "@/lib/server/stripe";
import { paymentsConfig } from "@/lib/server/payments";

export const dynamic = "force-dynamic";
export function GET() {
  return json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    stripe: stripeConfigured(),
    email: Boolean(process.env.RESEND_API_KEY),
    sampleOrders: sampleOrdersAllowed(),
    payments: paymentsConfig(), // T1 top-ups: { provider, available, simulate }
  });
}
