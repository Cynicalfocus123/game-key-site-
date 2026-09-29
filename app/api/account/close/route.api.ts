import { CLOSE_ERRORS, CLOSE_WORD } from "@/lib/account-close";
import { closeOwnAccount } from "@/lib/server/account-close";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// T3: POST { word: "CLOSE", password, reason? } → the account is closed (data kept, sign-in blocked, every session ended). 5 tries / 10 min.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (b?.word !== CLOSE_WORD) return json({ error: CLOSE_ERRORS.word }, 400);
  if (!(await hitLimit(`close:${u.id}`, 5, 10 * 60_000))) return json({ error: "Too many tries. Wait a few minutes." }, 429);
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  const r = await closeOwnAccount(u.id, typeof b.password === "string" ? b.password : "", reason);
  return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
}
