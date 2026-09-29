import { parseSellerInput, SELL_ERRORS } from "@/lib/sellers";
import { myApplication, submitApplication } from "@/lib/server/sellers";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// T3 seller application. GET → { application } (latest, or null). POST all 4 steps → { application } | 400 { error, errors }.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  return json({ application: await myApplication(u.id) });
}

export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!u.emailVerified) return json({ error: SELL_ERRORS.verify }, 403);
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (!b) return json({ error: "Invalid request" }, 400);
  const r = await submitApplication(u, parseSellerInput(b), new URL(req.url).origin);
  return r.ok ? json({ application: r.application }) : json({ error: r.error, errors: r.errors }, r.status);
}
