import { EMAIL_LIST, renderEmail, sampleEmail, type EmailId } from "@/lib/emails";
import { coverFor } from "@/lib/catalog";
import { ensureCatalog } from "@/lib/server/catalog";
import { devOutbox, sendEmail, siteUrl } from "@/lib/server/email";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Admin email previews (every admin; sample data only). GET → { outbox } = emails sent by this dev server without RESEND_API_KEY (empty in production).
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  return json({ outbox: devOutbox(), resend: Boolean(process.env.RESEND_API_KEY) });
}

// POST { id } → sends that email with sample data to the signed-in admin only. 10 / 10 min per admin.
export async function POST(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const id = b?.id as EmailId;
  if (!EMAIL_LIST.some((x) => x.id === id)) return json({ error: "Unknown email" }, 400);
  if (!(await hitLimit(`emailtest:${r.user.id}`, 10, 600_000))) return json({ error: "Too many test emails. Try again in a few minutes." }, 429);
  await ensureCatalog();
  const site = siteUrl();
  const mail = renderEmail(id, sampleEmail(id, site, (n) => { const c = coverFor(n); return c ? (c.startsWith("/") ? `${site}${c}` : c) : null; }) as never, site);
  await sendEmail({ to: r.user.email, ...mail, subject: `[Test] ${mail.subject}` }, id);
  return json({ ok: true, to: r.user.email });
}
