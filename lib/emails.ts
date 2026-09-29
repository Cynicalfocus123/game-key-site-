// Every CoreCart email (email task, 2026-09-29). One shared layout: blue → purple header, white card, grey footer.
// Shared by the server (lib/server/email.ts sends), the demo (outbox in this browser) and the admin preview (/admin/emails). No server imports.
// All values are plain text and escaped here. Keys are never put in an email: buttons open the signed-in order page.
import { currencyInfo } from "@/lib/currency/currencies";
import { formatMoney } from "@/lib/currency/money";
import { COMPANY } from "./orders";

export type EmailOut = { subject: string; html: string; text: string };
export type EmailItem = { name: string; sub: string; image: string | null; seller: string };
export type SignInFacts = { name: string; when: string; device: string; ip: string; location: string | null };

export type EmailData = {
  verify: { name: string; code: string; url: string };
  welcome: { name: string };
  reset: { name: string; url: string };
  adminCreated: { name: string; url: string };
  passwordChanged: SignInFacts;
  newSignIn: SignInFacts;
  emailChanged: { name: string; newEmail: string; when: string };
  orderConfirmed: { name: string; orderId: string; number: string; date: string; total: string; payment: string; items: EmailItem[] };
  paymentFailed: { name: string; orderId: string; number: string; items: EmailItem[] };
  refund: { name: string; returnNumber: string; orderNumber: string; item: string; amount: string; to: string };
  returnUpdate: { name: string; state: "received" | "approved" | "rejected"; returnNumber: string; orderNumber: string; item: string; quantity: number; note: string | null };
  topUp: { name: string; number: string; amount: string; paid: string; balance: string };
  giftCard: { name: string; amount: string; last4: string; balance: string };
  balanceAdjusted: { name: string; amount: string; credit: boolean; reason: string; balance: string };
  ticketCreated: { name: string; number: number; subject: string; excerpt: string; ticketId: string };
  ticketReply: { name: string; number: number; subject: string; excerpt: string; ticketId: string };
  sellerReceived: { name: string; number: string };
  sellerApproved: { name: string; merchant: string };
  sellerRejected: { name: string; merchant: string; reason: string; business: boolean }; // business = applied as a company (isCompany)
};
export type EmailId = keyof EmailData;

// Admin preview list (order + groups of the task list).
export const EMAIL_LIST: { id: EmailId; label: string; group: string; when: string }[] = [
  { id: "verify", label: "Verify email (code + link)", group: "Account", when: "After sign-up, and when a new code is asked for" },
  { id: "welcome", label: "Welcome", group: "Account", when: "After the email is verified" },
  { id: "reset", label: "Reset password", group: "Account", when: "Forgot password" },
  { id: "passwordChanged", label: "Password changed", group: "Account", when: "Password changed in Settings or with a reset link" },
  { id: "newSignIn", label: "New sign-in alert", group: "Account", when: "Sign-in from a device that never signed in before" },
  { id: "emailChanged", label: "Email address changed", group: "Account", when: "Email change (sent to the old address; wired when email change is built)" },
  { id: "adminCreated", label: "Admin created your account", group: "Account", when: "An admin adds a user" },
  { id: "orderConfirmed", label: "Order confirmed (keys ready)", group: "Orders", when: "Order paid (sample orders today, real checkout later)" },
  { id: "paymentFailed", label: "Payment failed / cancelled", group: "Orders", when: "Payment not completed (real checkout)" },
  { id: "refund", label: "Refund issued", group: "Orders", when: "Return marked Refunded" },
  { id: "returnUpdate", label: "Return received / approved / rejected", group: "Orders", when: "Return requested, then approved or rejected" },
  { id: "topUp", label: "Wallet top-up complete", group: "Wallet", when: "Top-up credited" },
  { id: "giftCard", label: "Gift card redeemed", group: "Wallet", when: "Gift card redeemed" },
  { id: "balanceAdjusted", label: "Balance adjusted", group: "Wallet", when: "Admin adjusts the balance" },
  { id: "ticketCreated", label: "Ticket created", group: "Support", when: "Customer opens a ticket" },
  { id: "ticketReply", label: "Ticket reply", group: "Support", when: "Support replies" },
  { id: "sellerReceived", label: "Seller application received", group: "Seller", when: "Seller application sent" },
  { id: "sellerApproved", label: "Seller approved", group: "Seller", when: "Admin approves the application" },
  { id: "sellerRejected", label: "Seller rejected (verification)", group: "Seller", when: "Admin rejects the application (Business title when applied as a company)" },
];

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const e = escapeHtml;

// "29 Sep 2026, 22:42 (UTC+7)" — store time zone (Bangkok).
export const emailTime = (d: Date | string) => `${new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} (UTC+7)`;
export const emailMoney = (minor: number, code: string) => formatMoney(minor, currencyInfo(code) ?? { code, decimals: 2 });
// "j***@gmail.com"
export const maskEmail = (email: string) => { const [u, d] = email.split("@"); return d ? `${u.slice(0, 1)}***@${d}` : email; };
export const VERIFY_CODE_MINUTES = 10;

// ---- building blocks (inline styles: email apps drop <style>) ----
const INK = "#111827", BODY = "#374151", GREY = "#5f6875", LINE = "#E5E7EB", BG = "#F3F4F6", BLUE = "#2563EB", GREEN = "#16803C", RED = "#D92D20";
const FONT = "font-family:Arial,Helvetica,sans-serif";
const p = (t: string, style = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BODY};${style}">${t}</p>`;
const hr = `<div style="border-top:1px solid ${LINE};margin:18px 0"></div>`;
const btn = (label: string, url: string, kind: "solid" | "outline" | "wide" = "solid") => {
  const solid = kind !== "outline";
  const a = `<a href="${e(url)}" style="display:${kind === "wide" ? "block" : "inline-block"};${FONT};font-size:15px;font-weight:700;text-decoration:none;padding:12px 20px;text-align:center;${solid ? `background:${BLUE};color:#ffffff;border:1px solid ${BLUE}` : `background:#ffffff;color:${BLUE};border:1px solid ${BLUE}`}">${e(label)}</a>`;
  return a;
};
const buttons = (...b: string[]) => `<p style="margin:4px 0 18px">${b.join("&nbsp;&nbsp;")}</p>`;
const kv = (rows: [string, string, boolean?][]) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BG};${FONT};font-size:14px;color:${BODY};margin:0 0 16px"><tbody>${rows.map(([k, v, bold]) =>
  `<tr><td style="padding:6px 14px;white-space:nowrap;vertical-align:top;color:${GREY}">${e(k)}</td><td style="padding:6px 14px;${bold ? `font-weight:700;color:${INK}` : ""}">${e(v)}</td></tr>`).join("")}</tbody></table>`;
// Rejection reason: grey box with a red left edge.
const reasonBox = (reason: string) => `<div style="background:${BG};border-left:3px solid ${RED};padding:12px 14px;margin:0 0 16px;font-size:14px;line-height:1.6;color:${BODY};white-space:pre-wrap"><b style="color:${INK}">Reason:</b> ${e(reason)}</div>`;
const box = (text: string) => `<div style="background:${BG};padding:12px 14px;margin:0 0 16px;font-size:14px;line-height:1.6;color:${BODY};white-space:pre-wrap">${e(text)}</div>`;
const wordmark = `<div style="${FONT};font-size:20px;font-weight:700;letter-spacing:-.3px;color:${INK}">core<span style="color:${BLUE}">cart</span></div>`;
const signature = (team = "") => `${team ? p(`Kind regards,<br>${e(team)}`) : p("Thank you.")}${wordmark}`;
const productRows = (items: EmailItem[], links: { key?: string; rate?: string; receipt?: string } = {}) => {
  let seller = ""; let out = "";
  for (const i of items) {
    if (i.seller !== seller) { seller = i.seller;
      out += `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;${FONT};font-size:14px;margin:0 0 12px"><tr><td><span style="color:${INK};font-weight:700">&#9679; ${e(seller)}</span>${links.rate ? `&nbsp;&nbsp;<a href="${e(links.rate)}" style="color:${BLUE};text-decoration:none">Rate the seller</a>` : ""}</td>${links.receipt ? `<td style="text-align:right"><a href="${e(links.receipt)}" style="color:${BLUE};text-decoration:none">Get receipt</a></td>` : ""}</tr></table>`; }
    const img = i.image ? `<img src="${e(i.image)}" width="96" height="120" alt="" style="display:block;width:96px;height:120px;object-fit:cover;border:0">` : `<div style="width:96px;height:120px;background:${BG}"></div>`;
    out += `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;${FONT};margin:0 0 16px"><tr><td style="width:96px;vertical-align:top;padding-right:16px">${img}</td><td style="vertical-align:top"><div style="font-size:16px;font-weight:700;color:${INK};line-height:1.35;margin-bottom:4px">${e(i.name)}</div><div style="font-size:14px;color:${GREY};margin-bottom:12px">${e(i.sub)}</div>${links.key ? btn("Get key", links.key, "wide") : ""}</td></tr></table>`;
  }
  return out;
};

// ---- layout ----
// hero (rejection email, user 2026-09-29): centred PNG illustration + large bold UPPERCASE centred title instead of the normal title.
function layout(site: string, title: string, preheader: string, body: string, hero?: Hero) {
  const year = new Date().getFullYear();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)}</title></head>
<body style="margin:0;padding:0;background:${BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:${BLUE};background-image:linear-gradient(90deg,#2563EB 0%,#4F46E5 50%,#7C3AED 100%);padding:20px 32px;${FONT};font-size:26px;font-weight:700;letter-spacing:-.4px;color:#ffffff">core<span style="color:#DDD6FE">cart</span></td></tr>
<tr><td style="background:#ffffff;padding:32px;${FONT}">
${hero ? `<div style="text-align:center;margin:0 0 8px"><img src="${e(`${site}${hero.image}`)}" width="240" height="160" alt="${e(hero.alt)}" style="display:inline-block;width:240px;max-width:100%;height:auto;border:0"></div>
<h1 style="margin:8px 0 22px;text-align:center;font-size:26px;line-height:1.25;letter-spacing:.3px;text-transform:uppercase;color:${INK};${FONT}">${e(title)}</h1>`
  : `<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${INK};${FONT}">${e(title)}</h1>`}
${body}
</td></tr>
<tr><td style="padding:20px 16px 8px;text-align:center;${FONT};font-size:13px;line-height:1.7;color:${GREY}">
For support requests, please <a href="${e(site)}/account/tickets?new=1" style="color:${BLUE};text-decoration:none">create a ticket</a><br>
Copyright &copy; ${year} ${e(COMPANY.name)}. All rights reserved.<br>
<span style="font-size:12px">${e(COMPANY.address.join(", "))}</span>
</td></tr></table></td></tr></table></body></html>`;
}

type Hero = { image: string; alt: string }; // image = path under the site, e.g. "/email/verification-rejected.png"
type Built = { subject: string; title: string; preheader: string; body: string; text: string[]; hero?: Hero };
const hi = (name: string) => (name.trim() ? `Hi ${name.trim()},` : "Hi,");
const hello = (name: string) => (name.trim() ? `Hello ${name.trim()},` : "Hello,");
const facts = (f: SignInFacts): [string, string][] => [["Device:", f.device], ...(f.location ? [["Location:", f.location] as [string, string]] : []), ["IP address:", f.ip], ["Time:", f.when]];

const T: { [K in EmailId]: (d: EmailData[K], site: string) => Built } = {
  verify: (d) => ({ subject: `${d.code} is your CoreCart confirmation code`, title: "Your email confirmation code", preheader: `Your code is ${d.code}. It is valid for ${VERIFY_CODE_MINUTES} minutes.`,
    body: p("Please copy this code and enter it on the confirmation page to verify your email.")
      + `<div style="display:inline-block;background:${BG};padding:14px 22px;margin:0 0 16px;font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#000000">${e(d.code)}</div>`
      + p(`The confirmation code is only valid for <b>${VERIFY_CODE_MINUTES} minutes</b>. If you haven't requested this email, please ignore it.`)
      + p("If the code did not work, please use the link below:") + p(`<a href="${e(d.url)}" style="color:${BLUE};word-break:break-all">${e(d.url)}</a>`, "font-size:13px") + signature(),
    text: ["Your email confirmation code", "", "Please copy this code and enter it on the confirmation page to verify your email.", "", d.code, "", `The code is only valid for ${VERIFY_CODE_MINUTES} minutes. If you haven't requested this email, please ignore it.`, "", "If the code did not work, use this link:", d.url] }),
  welcome: (d, site) => ({ subject: "Welcome to CoreCart", title: `Welcome to CoreCart${d.name.trim() ? `, ${d.name.trim()}` : ""}`, preheader: "Your account is ready.",
    body: p("Your email is verified and your account is ready. Game keys arrive in your account right after payment, and every order has a receipt in My orders.") + buttons(btn("Start shopping", `${site}/`), btn("My account", `${site}/account`, "outline")) + signature(),
    text: ["Welcome to CoreCart", "", "Your email is verified and your account is ready.", "", `Start shopping: ${site}/`, `My account: ${site}/account`] }),
  reset: (d) => ({ subject: "Reset your CoreCart password", title: "Reset your CoreCart password", preheader: "Use the button to choose a new password.",
    body: p(e(hi(d.name))) + p("A password reset was requested for this email address. Use the button below to choose a new password. The link works for 1 hour.")
      + `<p style="margin:6px 0 20px;text-align:center">${btn("RESET PASSWORD", d.url)}</p>` + p("If the button doesn't work, paste this link into your browser:", "font-size:13px;color:" + GREY)
      + p(`<a href="${e(d.url)}" style="color:${BLUE};word-break:break-all">${e(d.url)}</a>`, "font-size:13px") + p("Didn't ask for this? Ignore this email — your password stays the same.", "font-size:13px;color:" + GREY) + signature(),
    text: ["Reset your CoreCart password", "", hi(d.name), "A password reset was requested for this email address. The link works for 1 hour:", d.url, "", "Didn't ask for this? Ignore this email — your password stays the same."] }),
  adminCreated: (d) => ({ subject: "Your CoreCart account is ready", title: "Your CoreCart account is ready", preheader: "Set your password to sign in.",
    body: p(e(hi(d.name))) + p("A CoreCart administrator created an account for you. Set your password to sign in. The link works for 1 hour.") + buttons(btn("Set password", d.url))
      + p(`<a href="${e(d.url)}" style="color:${BLUE};word-break:break-all">${e(d.url)}</a>`, "font-size:13px") + signature(),
    text: ["Your CoreCart account is ready", "", hi(d.name), "A CoreCart administrator created an account for you. Set your password (link works for 1 hour):", d.url] }),
  passwordChanged: (d, site) => ({ subject: "Your CoreCart password was changed", title: `Hello ${d.name.trim() || "there"}`, preheader: "Your password has been changed.",
    body: p("Your password has been changed.") + kv(facts(d)) + p("Don't recognise this activity? Reset your password now and contact us.")
      + buttons(btn("Reset password", `${site}/forgot-password`), btn("Contact support", `${site}/account/tickets?new=1`, "outline")) + p("Best wishes,<br>CoreCart Team"),
    text: [`Hello ${d.name}`, "", "Your password has been changed.", ...facts(d).map(([k, v]) => `${k} ${v}`), "", `Not you? Reset your password: ${site}/forgot-password`] }),
  newSignIn: (d, site) => ({ subject: "New sign-in to your CoreCart account", title: "New sign-in to your account", preheader: "Your account was signed in from a new device.",
    body: p(`${e(hi(d.name))} your CoreCart account was just signed in from a new device.`) + kv(facts(d)) + p("Was this you? You don't need to do anything.") + p("Not you? Change your password now.")
      + buttons(btn("Change password", `${site}/forgot-password`), btn("Contact support", `${site}/account/tickets?new=1`, "outline")) + p("Best wishes,<br>CoreCart Team"),
    text: ["New sign-in to your account", "", `${hi(d.name)} your CoreCart account was just signed in from a new device.`, ...facts(d).map(([k, v]) => `${k} ${v}`), "", `Not you? Change your password: ${site}/forgot-password`] }),
  emailChanged: (d, site) => ({ subject: "Your CoreCart email address was changed", title: "Your email address was changed", preheader: "The email on your account was changed.",
    body: p(e(hi(d.name))) + p(`The email address on your CoreCart account was changed to <b>${e(d.newEmail)}</b> on ${e(d.when)}.`) + p("Not you? Contact us right away so we can secure your account.")
      + buttons(btn("Contact support", `${site}/account/tickets?new=1`)) + p("Best wishes,<br>CoreCart Team"),
    text: ["Your email address was changed", "", hi(d.name), `The email on your account was changed to ${d.newEmail} on ${d.when}.`, `Not you? Contact support: ${site}/account/tickets?new=1`] }),
  orderConfirmed: (d, site) => { const order = `${site}/account/orders/view?id=${encodeURIComponent(d.orderId)}`;
    return { subject: `Your CoreCart order ${d.number} is confirmed`, title: "Your order has been confirmed", preheader: `Order ${d.number} · ${d.total}. Your keys are ready in your account.`,
      body: hr.replace("18px 0", "0 0 18px") + `<div style="font-size:17px;font-weight:700;color:${INK};margin:0 0 14px">Purchased products</div>` + hr.replace("18px 0", "0 0 16px")
        + productRows(d.items, { key: order, rate: `${order}&rate=1`, receipt: `${site}/account/orders/receipt?id=${encodeURIComponent(d.orderId)}` }) + hr
        + kv([["Order number:", d.number, true], ["Order date:", d.date], ["Total paid:", d.total, true], ["Paid with:", d.payment]])
        + p(`Find all your purchases in: <a href="${e(site)}/account/orders" style="color:${BLUE};text-decoration:none">My orders</a>`) + p("Thank you for your purchase.") + wordmark,
      text: ["Your order has been confirmed", "", ...d.items.map((i) => `- ${i.name} (${i.sub}) — seller ${i.seller}`), "", `Get your keys: ${order}`, `Receipt: ${site}/account/orders/receipt?id=${d.orderId}`, "", `Order number: ${d.number}`, `Order date: ${d.date}`, `Total paid: ${d.total}`, `Paid with: ${d.payment}`, "", `My orders: ${site}/account/orders`] }; },
  paymentFailed: (d, site) => ({ subject: `Payment not completed for order ${d.number}`, title: "Your payment was not completed", preheader: "You were not charged. Your items are still in your cart.",
    body: p(`We could not take the payment for order <b>${e(d.number)}</b>, so the order is cancelled. You were not charged.`) + productRows(d.items) + hr + buttons(btn("Try again", `${site}/cart`)) + p("Your items are still in your cart.", "font-size:13px;color:" + GREY) + signature(),
    text: ["Your payment was not completed", "", `We could not take the payment for order ${d.number}, so the order is cancelled. You were not charged.`, ...d.items.map((i) => `- ${i.name}`), "", `Try again: ${site}/cart`] }),
  refund: (d, site) => ({ subject: `Refund for return ${d.returnNumber}`, title: "Your refund is on its way", preheader: `${d.amount} refunded to ${d.to}.`,
    body: p(e(hi(d.name))) + p(`Return <b>${e(d.returnNumber)}</b> for order <b>${e(d.orderNumber)}</b> was refunded.`) + kv([["Item:", d.item], ["Refund:", d.amount, true], ["Refunded to:", d.to]])
      + p("Card refunds can take 5–10 working days to show on your statement.", "font-size:13px;color:" + GREY) + buttons(btn("View return", `${site}/account/orders?tab=returns`)) + signature(),
    text: ["Your refund is on its way", "", `Return ${d.returnNumber} for order ${d.orderNumber} was refunded.`, `Item: ${d.item}`, `Refund: ${d.amount}`, `Refunded to: ${d.to}`, "", `View return: ${site}/account/orders?tab=returns`] }),
  returnUpdate: (d, site) => { const t = { received: ["We received your return request", "We check return requests within 2 working days and email you the answer."], approved: ["Your return request was approved", "We will send the refund soon and email you when it is done."], rejected: ["Your return request was not approved", "You can reply through a support ticket if you have questions."] }[d.state];
    return { subject: `Return ${d.returnNumber}: ${t[0]}`, title: t[0], preheader: `Return ${d.returnNumber} for order ${d.orderNumber}.`,
      body: p(e(hi(d.name))) + kv([["Return:", d.returnNumber, true], ["Order:", d.orderNumber], ["Item:", `${d.item} × ${d.quantity}`]]) + (d.note ? box(`${d.state === "rejected" ? "Reason" : "Note"}: ${d.note}`) : "") + p(t[1])
        + buttons(btn("View return", `${site}/account/orders?tab=returns`)) + signature(),
      text: [t[0], "", `Return: ${d.returnNumber}`, `Order: ${d.orderNumber}`, `Item: ${d.item} × ${d.quantity}`, ...(d.note ? [`${d.state === "rejected" ? "Reason" : "Note"}: ${d.note}`] : []), "", t[1], `View return: ${site}/account/orders?tab=returns`] }; },
  topUp: (d, site) => ({ subject: `Top-up ${d.number} complete: ${d.amount} added`, title: "Your wallet top-up is complete", preheader: `${d.amount} added to your CoreCart wallet.`,
    body: p("Amount added", `margin:0;font-size:13px;color:${GREY}`) + `<div style="font-size:30px;font-weight:700;color:${GREEN};margin:0 0 14px">+${e(d.amount)}</div>`
      + kv([["Paid:", d.paid], ["Top-up ID:", d.number], ["New balance:", d.balance, true]]) + buttons(btn("View balance", `${site}/account/balance`)) + signature(),
    text: ["Your wallet top-up is complete", "", `Amount added: +${d.amount}`, `Paid: ${d.paid}`, `Top-up ID: ${d.number}`, `New balance: ${d.balance}`, "", `View balance: ${site}/account/balance`] }),
  giftCard: (d, site) => ({ subject: `Gift card redeemed: ${d.amount} added`, title: "Gift card redeemed", preheader: `${d.amount} added to your gift balance.`,
    body: p("Amount added", `margin:0;font-size:13px;color:${GREY}`) + `<div style="font-size:30px;font-weight:700;color:${GREEN};margin:0 0 14px">+${e(d.amount)}</div>`
      + kv([["Gift card:", `••••-${d.last4}`], ["New gift balance:", d.balance, true]]) + p("Didn't redeem a gift card? Contact support right away.", "font-size:13px;color:" + GREY) + buttons(btn("View balance", `${site}/account/balance`)) + signature(),
    text: ["Gift card redeemed", "", `Amount added: +${d.amount}`, `Gift card: ••••-${d.last4}`, `New gift balance: ${d.balance}`, "", `View balance: ${site}/account/balance`] }),
  balanceAdjusted: (d, site) => ({ subject: `Your CoreCart balance was adjusted (${d.credit ? "+" : "−"}${d.amount})`, title: "Your balance was adjusted", preheader: `${d.credit ? "+" : "−"}${d.amount}: ${d.reason}`,
    body: p("Change", `margin:0;font-size:13px;color:${GREY}`) + `<div style="font-size:30px;font-weight:700;color:${d.credit ? GREEN : RED};margin:0 0 14px">${d.credit ? "+" : "−"}${e(d.amount)}</div>`
      + box(`Reason: ${d.reason}`) + kv([["New balance:", d.balance, true]]) + buttons(btn("View balance", `${site}/account/balance`)) + signature(),
    text: ["Your balance was adjusted", "", `Change: ${d.credit ? "+" : "−"}${d.amount}`, `Reason: ${d.reason}`, `New balance: ${d.balance}`, "", `View balance: ${site}/account/balance`] }),
  ticketCreated: (d, site) => ({ subject: `Ticket #${d.number} received: ${d.subject}`, title: "We got your support ticket", preheader: `Ticket #${d.number} · ${d.subject}`,
    body: p(`Ticket <b>#${d.number}</b> · ${e(d.subject)}`) + box(d.excerpt) + p("We usually reply within 24 hours. You'll get an email when we answer.")
      + buttons(btn("View ticket", `${site}/account/tickets?id=${encodeURIComponent(d.ticketId)}`)) + signature(),
    text: ["We got your support ticket", "", `Ticket #${d.number} · ${d.subject}`, "", d.excerpt, "", "We usually reply within 24 hours.", `View ticket: ${site}/account/tickets?id=${d.ticketId}`] }),
  ticketReply: (d, site) => ({ subject: `New reply on ticket #${d.number}: ${d.subject}`, title: `New reply on ticket #${d.number}`, preheader: d.excerpt.slice(0, 90),
    body: p(e(hi(d.name))) + p(`CoreCart support replied to <b>${e(d.subject)}</b>:`) + box(d.excerpt) + buttons(btn("Reply", `${site}/account/tickets?id=${encodeURIComponent(d.ticketId)}`)) + signature("CoreCart Support Team"),
    text: [`New reply on ticket #${d.number}`, "", `CoreCart support replied to ${d.subject}:`, "", d.excerpt, "", `Reply: ${site}/account/tickets?id=${d.ticketId}`] }),
  sellerReceived: (d, site) => ({ subject: `We got your seller application ${d.number}`, title: `Hello ${d.name.trim() || "there"},`, preheader: "We received your seller application.",
    body: p("Thank you for submitting your seller application at CoreCart.") + p("We appreciate you taking the time and are excited to start working together!")
      + p(`This is an automatic reply to let you know that we received your application <b>${e(d.number)}</b> and will review it as soon as possible.`)
      + p("If we need any extra information, we will contact you through our ticket system.") + p("If any questions come up in the meantime, please use the same contact channel.")
      + buttons(btn("See application status", `${site}/sell`), btn("Support tickets", `${site}/account/tickets`, "outline")) + p("Kind regards,<br>CoreCart Support Team"),
    text: [`Hello ${d.name},`, "", "Thank you for submitting your seller application at CoreCart.", `We received application ${d.number} and will review it as soon as possible.`, "If we need extra information, we will contact you through our ticket system.", "", `Status: ${site}/sell`] }),
  sellerApproved: (d, site) => ({ subject: "Congratulations! Your CoreCart seller profile was approved", title: `Congratulations, ${d.name.trim() || "seller"}!`, preheader: "Your seller profile was approved by the team.",
    body: p(`Congratulations — your seller profile <b>${e(d.merchant)}</b> was approved by the CoreCart team.`) + p("Your account is now a seller account. Seller tools (listings and payouts) are coming soon; we will email you when they open.")
      + buttons(btn("Open my account", `${site}/account`)) + p("Kind regards,<br>CoreCart Support Team"),
    text: [`Congratulations, ${d.name}!`, "", `Your seller profile ${d.merchant} was approved by the CoreCart team.`, "Your account is now a seller account.", "", `My account: ${site}/account`] }),
  sellerRejected: (d, site) => { const kind = d.business ? "business" : "personal"; const ticket = `${site}/account/tickets?new=1`;
    return { subject: `Your CoreCart ${kind} verification was declined`, title: `${d.business ? "Business" : "Personal"} verification rejected`, preheader: `Your ${kind} verification was declined.`,
      hero: { image: "/email/verification-rejected.png", alt: "Verification rejected" },
      body: p(e(hello(d.name))) + p(`We regret to inform you that your <b>${kind} verification</b> for the seller profile <b>${e(d.merchant)}</b> has been <b>declined</b>.`) + reasonBox(d.reason)
        + p(`Please correct the points above so your application meets our verification standards. To solve this, contact our support team by email at <b>${e(COMPANY.supportEmail)}</b> or <a href="${e(ticket)}" style="color:${BLUE};text-decoration:none;font-weight:700">create a ticket</a>.`)
        + `<p style="margin:6px 0 22px">${btn("CONTACT SUPPORT TEAM", ticket, "wide")}</p>` + p("Kind regards,<br>CoreCart Support Team"),
      text: [`${d.business ? "BUSINESS" : "PERSONAL"} VERIFICATION REJECTED`, "", hello(d.name), `We regret to inform you that your ${kind} verification for the seller profile ${d.merchant} has been declined.`, `Reason: ${d.reason}`, "",
        "Please correct the points above so your application meets our verification standards.", `Contact our support team by email at ${COMPANY.supportEmail} or create a ticket: ${ticket}`] }; },
};

// site = absolute store address without the last slash, e.g. "https://corecart.example" (links + images).
export function renderEmail<K extends EmailId>(id: K, data: EmailData[K], site: string): EmailOut {
  const b = T[id](data, site);
  const footer = ["", "—", "CoreCart", `Support: ${site}/account/tickets?new=1`];
  return { subject: b.subject, html: layout(site, b.title, b.preheader, b.body, b.hero), text: [...b.text, ...footer].join("\n") };
}

// Sample data for the admin preview (/admin/emails) and "Send test to me".
export function sampleEmail(id: EmailId, site: string, cover = (n: string) => n as string | null): EmailData[EmailId] {
  const when = emailTime(new Date()); const name = "Alex";
  const items: EmailItem[] = [{ name: "Elden Ring", sub: "Digital product · Qty 1 · ฿990.00", image: cover("Elden Ring"), seller: "CoreCart" }];
  const sign: SignInFacts = { name, when, device: "Chrome on Windows", ip: "171.96.x.x", location: "Bangkok, Thailand (sample location)" };
  const all: EmailData = {
    verify: { name, code: "138856", url: `${site}/verify-email?token=sample-token` },
    welcome: { name },
    reset: { name, url: `${site}/reset-password?token=sample-token` },
    adminCreated: { name, url: `${site}/reset-password?token=sample-token` },
    passwordChanged: sign, newSignIn: sign,
    emailChanged: { name, newEmail: "a***@gmail.com", when },
    orderConfirmed: { name, orderId: "sample", number: "CC-4K7Q2M9X", date: when, total: "฿990.00", payment: "Credit or debit card •••• 4242", items },
    paymentFailed: { name, orderId: "sample", number: "CC-7HN2PQ4D", items },
    refund: { name, returnNumber: "R-4K7Q2M", orderNumber: "CC-4K7Q2M9X", item: "Elden Ring × 1", amount: "฿990.00", to: "CoreCart wallet" },
    returnUpdate: { name, state: "approved", returnNumber: "R-4K7Q2M", orderNumber: "CC-4K7Q2M9X", item: "Elden Ring", quantity: 1, note: null },
    topUp: { name, number: "TU-000812", amount: "฿1,000.00", paid: "$29.50 (card •••• 4242)", balance: "฿1,240.00" },
    giftCard: { name, amount: "฿500.00", last4: "7Q2K", balance: "฿500.00" },
    balanceAdjusted: { name, amount: "฿50.00", credit: false, reason: "Duplicate refund corrected", balance: "฿1,190.00" },
    ticketCreated: { name, number: 1043, subject: "Key already used", excerpt: "Hi, the Steam key says it was already activated. Order CC-4K7Q2M9X.", ticketId: "sample" },
    ticketReply: { name, number: 1043, subject: "Key already used", excerpt: "Hi Alex, we checked the key and sent you a new one. It is in your Keys library.", ticketId: "sample" },
    sellerReceived: { name, number: "SA-1007" },
    sellerApproved: { name, merchant: "Gaming4Life" },
    sellerRejected: { name, merchant: "Gaming4Life", reason: "The sample invoices do not show the key supplier.", business: false },
  };
  return all[id];
}
