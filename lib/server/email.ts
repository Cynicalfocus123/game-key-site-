import { renderEmail, type EmailData, type EmailId } from "@/lib/emails";
import { desc } from "drizzle-orm";
import { isPlaceholderEmail } from "@/lib/account-close";
import { db } from "./db";
import { emailFailure } from "./db/schema";

type Mail = { to: string; subject: string; text: string; html: string };
export type SentMail = Mail & { template: string; sentAt: string; redacted?: boolean };

// Development without RESEND_API_KEY: the last 30 emails stay in memory for the admin "Dev outbox" (/admin/emails, master admin only). Never in production.
// N2: emails that carry a sign-in secret (verify code + link, reset link, set-password link) are kept with the secret hidden,
// unless DEV_OUTBOX_SECRETS=1 (a private machine only, e.g. for scripts/smoke-server.mjs; never on a shared dev / staging server).
// The terminal print stays complete: whoever runs the server already has it.
// Kept on globalThis: in dev each route bundle loads its own copy of this module, and the outbox must be one list for all of them.
const outbox: SentMail[] = ((globalThis as { __corecartOutbox?: SentMail[] }).__corecartOutbox ??= []);
export const devOutbox = () => (process.env.NODE_ENV === "production" ? [] : [...outbox].reverse());

const SECRET_TEMPLATES = new Set(["verify", "reset", "adminCreated"]);
const HIDDEN = "[hidden]";
function keptCopy(mail: Mail, template: string): Mail & { redacted?: boolean } {
  if (!SECRET_TEMPLATES.has(template) || process.env.DEV_OUTBOX_SECRETS === "1") return mail;
  const hide = (s: string) => s.replace(/\b\d{6}\b/g, "••••••").replace(/https?:\/\/[^\s"'<>]*(token|reset-password|verify-email)[^\s"'<>]*/gi, HIDDEN);
  return { ...mail, subject: hide(mail.subject), text: hide(mail.text), html: hide(mail.html), redacted: true };
}

// Store address for links and images in emails (no last slash).
export const siteUrl = () => (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");

// Sends through Resend when RESEND_API_KEY is set. Otherwise prints to terminal (development).
// N4: the result says whether the provider accepted it. Network errors, 429 and 5xx are tried 3 times (0.5 s, 1 s apart);
// other refusals (bad address, domain not verified …) fail at once.
export type SendResult = { ok: true } | { ok: false; error: string; attempts: number };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function sendEmail(mail: Mail, template = "custom"): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[CoreCart email — dev]\nTo: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    if (process.env.NODE_ENV !== "production") { outbox.push({ ...keptCopy(mail, template), template, sentAt: new Date().toISOString() }); if (outbox.length > 30) outbox.shift(); }
    return { ok: true };
  }
  let error = ""; let attempts = 0;
  for (; attempts < 3; ) {
    attempts++;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM || "CoreCart <onboarding@resend.dev>", ...mail }),
      });
      if (res.ok) return { ok: true };
      error = `Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      if (res.status < 500 && res.status !== 429) break; // a refusal: trying again will not help
    } catch (e) { error = `Network: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200); }
    if (attempts < 3) await pause(500 * attempts);
  }
  console.error("[CoreCart email] not sent", template, error);
  return { ok: false, error, attempts };
}

// N4: failed sends are kept (master admin sees them in /admin/emails). The person's screen stays generic ("If it doesn't arrive,
// send a new code / request a new link"), so nobody learns whether an account exists; the resend buttons are the retry path.
export async function recentEmailFailures(limit = 50) {
  const rows = await db.select().from(emailFailure).orderBy(desc(emailFailure.createdAt)).limit(limit);
  return rows.map((r) => ({ template: r.template, to: r.to, error: r.error, attempts: r.attempts, at: r.createdAt.toISOString() }));
}

// Every email goes through the shared layout (lib/emails.ts). Never throws (an email never breaks the action); a failure is
// returned AND saved in email_failure (N4).
export async function sendTemplate<K extends EmailId>(to: string | null | undefined, id: K, data: EmailData[K]): Promise<SendResult> {
  if (!to || isPlaceholderEmail(to)) return { ok: true }; // R1: closed+… / claim+… @….invalid addresses never get mail
  let r: SendResult;
  try { r = await sendEmail({ to, ...renderEmail(id, data, siteUrl()) }, id); } catch (e) { r = { ok: false, error: `Render: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200), attempts: 0 }; }
  if (!r.ok) await db.insert(emailFailure).values({ id: crypto.randomUUID(), template: id, to, error: r.error, attempts: r.attempts }).catch((e) => console.error("[CoreCart email] failure log", e));
  return r;
}

export { escapeHtml } from "@/lib/emails";
