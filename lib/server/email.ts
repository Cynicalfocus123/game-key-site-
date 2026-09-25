type Mail = { to: string; subject: string; text: string; html: string };

// Sends through Resend when RESEND_API_KEY is set. Otherwise prints to terminal (development).
export async function sendEmail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[CoreCart email — dev]\nTo: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "CoreCart <onboarding@resend.dev>", ...mail }),
  });
  if (!res.ok) console.error("[CoreCart email] Resend error", res.status, await res.text());
}

export function actionEmail(title: string, body: string, label: string, url: string) {
  const text = `${title}\n\n${body}\n\n${label}: ${url}\n\nIf you did not request this, ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;color:#111827"><p style="font-size:22px;font-weight:700">core<span style="color:#2563eb">cart</span></p><h2>${title}</h2><p>${body}</p><p><a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 16px;text-decoration:none;font-weight:600">${label}</a></p><p style="color:#5f6875;font-size:13px">If you did not request this, ignore this email.</p></div>`;
  return { text, html };
}
