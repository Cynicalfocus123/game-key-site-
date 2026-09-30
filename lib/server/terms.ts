import { createHmac, timingSafeEqual } from "node:crypto";
import { TERMS_COOKIE_MINUTES, TERMS_VERSION } from "@/lib/terms";

// R7: Google sign-up proof. /api/terms/accept sets cookie cc_terms = "version.time.hmac" (httpOnly, 10 min) right before the
// Google redirect; the user create hook (auth.ts) accepts a new Google account only with a valid, fresh cookie for TERMS_VERSION.
const secret = () => process.env.BETTER_AUTH_SECRET || "corecart-dev-terms-secret";
const mac = (body: string) => createHmac("sha256", secret()).update(`terms:${body}`).digest("base64url");
export function termsCookieValue(now = Date.now()) { const body = `${TERMS_VERSION}.${now}`; return `${body}.${mac(body)}`; }
// The accepted version when the cookie is valid and fresh, else null.
export function termsFromCookie(value: string | null | undefined, now = Date.now()): string | null {
  const m = /^([\w-]+)\.(\d{10,16})\.([\w-]+)$/.exec(value ?? ""); if (!m) return null;
  const body = `${m[1]}.${m[2]}`; const want = Buffer.from(mac(body)); const got = Buffer.from(m[3]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const age = now - Number(m[2]); if (age < 0 || age > TERMS_COOKIE_MINUTES * 60_000) return null;
  return m[1] === TERMS_VERSION ? m[1] : null;
}
