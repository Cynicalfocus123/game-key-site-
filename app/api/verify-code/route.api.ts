import { auth } from "@/lib/server/auth";
import { checkVerifyCode, CODE_ERRORS } from "@/lib/server/account-mail";
import { dbReady } from "@/lib/server/db";
import { clientIp, hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// POST { email, code } → verifies the email with the 6-digit code from the email and signs in (same as opening the link).
// Limits: 5 wrong codes kill the code (account-mail.ts); 20 tries / 10 min per IP and 10 per email.
export async function POST(req: Request) {
  await dbReady();
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase().slice(0, 254) : "";
  const code = typeof b?.code === "string" ? b.code.replace(/\s/g, "") : "";
  if (!email || !code) return json({ error: CODE_ERRORS.format }, 400);
  const okIp = await hitLimit(`vcode:ip:${clientIp(req)}`, 20, 600_000);
  const okMail = await hitLimit(`vcode:email:${email}`, 10, 600_000);
  if (!okIp || !okMail) return json({ error: CODE_ERRORS.limit }, 429);
  const c = await checkVerifyCode(email, code);
  if (!c.ok) return json({ error: c.error }, 400);
  // Better Auth verifies the token, runs afterEmailVerification (welcome email) and sets the session cookie.
  const res = await auth.api.verifyEmail({ query: { token: c.token }, headers: req.headers, asResponse: true });
  if (!res.ok) return json({ error: CODE_ERRORS.expired }, 400);
  const out = json({ ok: true });
  for (const cookie of res.headers.getSetCookie()) out.headers.append("Set-Cookie", cookie);
  return out;
}
