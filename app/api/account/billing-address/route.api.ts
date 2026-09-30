import { ADDRESS_ERRORS, BILLING_WRITE_LIMIT } from "@/lib/address-formats";
import { saveBilling, savedBilling } from "@/lib/server/billing";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// GET → { address | null } (the account's billing address). PUT { country, line1, … } → saved (same checks as the form) or { errors } 400.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  return json({ address: savedBilling(u) });
}

export async function PUT(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!(await hitLimit(`billing:${u.id}`, BILLING_WRITE_LIMIT.max, BILLING_WRITE_LIMIT.windowMs))) return json({ error: "Too many changes. Wait a few minutes and try again." }, 429);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || JSON.stringify(body).length > 4000) return json({ error: ADDRESS_ERRORS.bad }, 400);
  const r = await saveBilling(u.id, savedBilling(u), body);
  return r.ok ? json({ address: r.address }) : json({ error: Object.values(r.errors)[0] ?? ADDRESS_ERRORS.bad, errors: r.errors }, 400);
}
