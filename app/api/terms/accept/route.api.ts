import { TERMS_COOKIE, TERMS_COOKIE_MINUTES, TERMS_ERROR, TERMS_VERSION } from "@/lib/terms";
import { clientIp, hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";
import { termsCookieValue } from "@/lib/server/terms";

export const dynamic = "force-dynamic";

// R7: POST { version } right before "Continue with Google" → signed cookie cc_terms (10 min). A new Google account is only
// created with it (auth.ts user create hook), so the server has proof of which Terms version the person accepted and when.
export async function POST(req: Request) {
  if (!(await hitLimit(`terms:ip:${clientIp(req)}`, 30, 600_000))) return json({ error: "Too many requests" }, 429);
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (b?.version !== TERMS_VERSION) return json({ error: TERMS_ERROR }, 400);
  const res = json({ ok: true, version: TERMS_VERSION });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${TERMS_COOKIE}=${termsCookieValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TERMS_COOKIE_MINUTES * 60}${secure}`);
  return res;
}
