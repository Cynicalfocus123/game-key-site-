import { renderEmail, type EmailData, type EmailId } from "@/lib/emails";

type Mail = { to: string; subject: string; text: string; html: string };
export type SentMail = Mail & { template: string; sentAt: string };

// Development without RESEND_API_KEY: the last 30 emails stay in memory for the admin "Dev outbox" (/admin/emails). Never in production.
const outbox: SentMail[] = [];
export const devOutbox = () => (process.env.NODE_ENV === "production" ? [] : [...outbox].reverse());

// Store address for links and images in emails (no last slash).
export const siteUrl = () => (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");

// Sends through Resend when RESEND_API_KEY is set. Otherwise prints to terminal (development).
export async function sendEmail(mail: Mail, template = "custom") {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[CoreCart email — dev]\nTo: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    if (process.env.NODE_ENV !== "production") { outbox.push({ ...mail, template, sentAt: new Date().toISOString() }); if (outbox.length > 30) outbox.shift(); }
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "CoreCart <onboarding@resend.dev>", ...mail }),
  });
  if (!res.ok) console.error("[CoreCart email] Resend error", res.status, await res.text());
}

// Every email goes through the shared layout (lib/emails.ts). Errors are logged, never thrown (an email never breaks the action).
export async function sendTemplate<K extends EmailId>(to: string | null | undefined, id: K, data: EmailData[K]) {
  if (!to) return;
  try { await sendEmail({ to, ...renderEmail(id, data, siteUrl()) }, id); } catch (e) { console.error("[CoreCart email]", id, e); }
}

export { escapeHtml } from "@/lib/emails";
