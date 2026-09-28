import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { user } from "@/lib/server/db/schema";
import { json, requireUser, unauthorized } from "@/lib/server/session";
import { stripe, stripeConfigured } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";
// Stripe down / bad key / network: answer 502 with a readable message instead of an unhandled 500 (step 5 known issue).
const stripeFailed = (e: unknown) => { console.error("[CoreCart stripe]", e); return json({ error: "The card service did not answer. Try again in a minute." }, 502); };
type Card = { id: string; customer: string | null; card: { brand: string; last4: string; exp_month: number; exp_year: number } };

export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!stripeConfigured()) return json({ configured: false, methods: [] });
  if (!u.stripeCustomerId) return json({ configured: true, methods: [] });
  try {
    const list = await stripe<{ data: Card[] }>("payment_methods", "GET", { customer: u.stripeCustomerId, type: "card", limit: "20" });
    return json({ configured: true, methods: list.data.map((m) => ({ id: m.id, brand: m.card.brand, last4: m.card.last4, expMonth: m.card.exp_month, expYear: m.card.exp_year })) });
  } catch (e) { return stripeFailed(e); }
}

// Starts Stripe-hosted Checkout in setup mode. Returns URL to redirect the browser.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!stripeConfigured()) return json({ error: "Stripe is not configured" }, 400);
  try {
  let customer = u.stripeCustomerId;
  if (!customer) {
    const c = await stripe<{ id: string }>("customers", "POST", { email: u.email, name: u.name, "metadata[userId]": u.id });
    customer = c.id;
    await db.update(user).set({ stripeCustomerId: customer }).where(eq(user.id, u.id));
  }
  const origin = process.env.BETTER_AUTH_URL || new URL(req.url).origin;
  const s = await stripe<{ url: string }>("checkout/sessions", "POST", {
    mode: "setup",
    customer,
    "payment_method_types[0]": "card",
    success_url: `${origin}/account/payment-methods?added=1`,
    cancel_url: `${origin}/account/payment-methods`,
  });
  return json({ url: s.url });
  } catch (e) { return stripeFailed(e); }
}

export async function DELETE(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !stripeConfigured() || !u.stripeCustomerId) return json({ error: "Not found" }, 404);
  try {
    const pm = await stripe<Card>(`payment_methods/${encodeURIComponent(id)}`);
    if (pm.customer !== u.stripeCustomerId) return json({ error: "Not found" }, 404);
    await stripe(`payment_methods/${encodeURIComponent(id)}/detach`, "POST");
    return json({ ok: true });
  } catch (e) { return stripeFailed(e); }
}
