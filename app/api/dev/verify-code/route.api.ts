import { devMailMode, devVerifyCode } from "@/lib/server/account-mail";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Local test server only (no RESEND_API_KEY and not production): GET ?email= → { code } = the newest 6-digit verification code
// that was "emailed" (printed in the terminal) to that address, so the sign-up popup can show it (user 2026-10-17: easy local
// checkout testing). On a real site (email provider set or production) this answers 404 and never reveals a code.
export async function GET(req: Request) {
  if (!devMailMode()) return json({ error: "Not found" }, 404);
  const email = (new URL(req.url).searchParams.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const code = email ? devVerifyCode(email) : null;
  return code ? json({ code }) : json({ error: "No code" }, 404);
}
