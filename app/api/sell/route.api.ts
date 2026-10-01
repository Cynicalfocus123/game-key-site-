import { DRAFT_LIMIT, isStepId, parseSellerInput, SELL_ERRORS } from "@/lib/sellers";
import { hitLimit } from "@/lib/server/rate-limit";
import { discardDraft, getDraft, myApplication, myApplicationDetails, saveDraft, submitApplication } from "@/lib/server/sellers";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// T3 seller application (KYC redesign).
// GET → { application (latest or null), draft (unsent draft or null) }; GET ?details=1 → { details } (latest application read-only).
// PUT { input, step? } → { draft } (step = Continue on that step; none = Save for later) | 400 { error, errors }.
// DELETE → { ok } (dashboard Delete: draft answers cleared, files kept). POST input → { application } | 400 { error, errors }.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (new URL(req.url).searchParams.get("details")) return json({ details: await myApplicationDetails(u.id) });
  const [application, draft] = await Promise.all([myApplication(u.id), getDraft(u.id)]);
  return json({ application, draft });
}

async function body(req: Request): Promise<Record<string, unknown> | null> { try { const b = await req.json(); return b && typeof b === "object" ? b : null; } catch { return null; } }

export async function PUT(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!u.emailVerified) return json({ error: SELL_ERRORS.verify }, 403);
  const b = await body(req); if (!b) return json({ error: "Invalid request" }, 400);
  if (!(await hitLimit(`selldraft:${u.id}`, DRAFT_LIMIT.max, DRAFT_LIMIT.windowMs))) return json({ error: SELL_ERRORS.draftLimit }, 429);
  const r = await saveDraft(u.id, parseSellerInput((b.input ?? {}) as Record<string, unknown>), isStepId(b.step) ? b.step : null);
  return r.ok ? json({ draft: r.draft }) : json({ error: r.error, errors: r.errors }, r.status);
}

export async function DELETE(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const r = await discardDraft(u.id);
  return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
}

export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!u.emailVerified) return json({ error: SELL_ERRORS.verify }, 403);
  const b = await body(req); if (!b) return json({ error: "Invalid request" }, 400);
  const r = await submitApplication(u, parseSellerInput(b), new URL(req.url).origin);
  return r.ok ? json({ application: r.application }) : json({ error: r.error, errors: r.errors }, r.status);
}
