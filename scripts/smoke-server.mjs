// Server-mode API smoke test (test-only, not in live/). Run against the dev server with the local PGlite database:
//   npm run dev            (other terminal)
//   node scripts/smoke-server.mjs
// Admin login: SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD, else "Claude outputs/local-test-admin.txt" (Git-ignored, email= / password= lines).
// Make a local admin with: npm run admin:create -- --email local-admin@corecart.test (stop npm run dev first: PGlite = one process).
// One part only: node scripts/smoke-server.mjs returns | tickets | filters | wallet | users | topups | products | menu | admins | sellers | emails (skips promo, gift cards and the other account APIs).
// admins (T2): the smoke admin must be the master admin (npm run admin:create -- --email <it> --master, server stopped). The 403 checks of a
// plain admin need a second admin that can sign in: SMOKE_HELPER_EMAIL + SMOKE_HELPER_PASSWORD, or helper_email= / helper_password= lines in
// the same file (npm run admin:create -- --email helper@corecart.test). Without it those checks are listed as SKIP with the reason.
// sellers (T3): the smoke admin applies itself (it stays admin: approve only turns customers into sellers), files go to .data/uploads/seller.
// It leaves its applications as Rejected, so the part can run again. Close account is tested on an admin-made customer + a new sign-up.
// topups: full checks need PAYMENT_PROVIDER=dev in .env.local (restart npm run dev); with "none" only the "coming soon" checks run.
// Tickets: 5 new tickets per hour per user, so a second tickets run within an hour reports the create checks as 429.
// Checks saved values, not only status codes. Random x-forwarded-for IPs keep IP rate limits of earlier runs out of the way;
// the per-user gift card limit is not (5 tries / 10 min): wait 10 minutes between runs or the redeem checks report "Too many attempts".
import fs from "node:fs";
import { createHmac } from "node:crypto";
const only = process.argv[2] ?? "";
const B = process.env.SMOKE_URL || "http://localhost:3000";
const cred = process.env.SMOKE_ADMIN_EMAIL ? { email: process.env.SMOKE_ADMIN_EMAIL, password: process.env.SMOKE_ADMIN_PASSWORD }
  : Object.fromEntries(fs.readFileSync("Claude outputs/local-test-admin.txt", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
let cookie = ""; let ip = `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const results = []; const ok = (name, cond, extra = "") => { results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
async function req(method, path, body, headers = {}) {
  const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", Origin: B, Cookie: cookie, "x-forwarded-for": ip, ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) { const jar = Object.fromEntries(cookie.split("; ").filter(Boolean).map((c) => c.split(/=(.*)/s).slice(0, 2))); for (const c of set) { const [kv] = c.split(";"); const [k, v] = kv.split(/=(.*)/s); jar[k] = v; } cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "); }
  let data = null; const text = await res.text(); try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }
  return { status: res.status, data };
}

// Auth
let r = await req("POST", "/api/auth/sign-in/email", { email: cred.email, password: cred.password });
ok("admin sign-in", r.status === 200, `status ${r.status}`);
r = await req("GET", "/api/admin/me"); ok("admin/me", r.data?.admin === true, JSON.stringify(r.data));
const skip = (name, why) => results.push(`SKIP  ${name}  — ${why}`);
const meIdOf = () => meIdCache; let meIdCache = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data?.user?.id;

if (!only) {
// Promo codes (admin)
r = await req("GET", "/api/admin/promo-codes"); ok("promo list has dev WELCOME10", r.status === 200 && r.data.promos.some((p) => p.code === "WELCOME10"), `status ${r.status}`);
const code = `SRV${Date.now().toString().slice(-6)}`;
const base = { type: "percent", value: 20, appliesTo: "categories", categories: ["digital-games"], minSubtotal: null, startsAt: new Date(Date.now() - 60000).toISOString(), expiresAt: null, maxUses: 100, oncePerCustomer: true, enabled: true, maxDiscount: 50000 };
r = await req("POST", "/api/admin/promo-codes", { ...base, code: code.toLowerCase() }); ok("promo create (lower-case input → upper)", r.status === 200 && r.data.promo?.code === code, `status ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
const pid = r.data?.promo?.id;
ok("promo categories stored as array", Array.isArray(r.data?.promo?.categories) && r.data.promo.categories[0] === "digital-games");
r = await req("POST", "/api/admin/promo-codes", { ...base, code }); ok("promo duplicate code → 400 code taken", r.status === 400 && r.data.errors?.code === "This code is already taken.", JSON.stringify(r.data));
r = await req("POST", "/api/admin/promo-codes", { ...base, code: "BAD1", value: 150, expiresAt: new Date(Date.now() - 3600e3).toISOString() }); ok("promo validation errors", r.status === 400 && r.data.errors?.value && r.data.errors?.dates, JSON.stringify(r.data.errors));
r = await req("GET", `/api/admin/promo-codes?id=${pid}`); ok("promo get by id", r.status === 200 && r.data.promo.maxUses === 100);
r = await req("PATCH", "/api/admin/promo-codes", { id: pid, ...base, code, value: 25 }); ok("promo edit", r.status === 200 && r.data.promo.value === 25, `status ${r.status}`);

// Public validate
r = await req("POST", "/api/promo/validate", { code, items: [{ productId: "key-elden-ring-steam", qty: 1 }, { productId: "hw-990-pro-2tb", qty: 1 }] });
ok("validate active code + server discount on eligible line only", r.status === 200 && r.data.result?.discount === 24750 && r.data.promo.uses === undefined, JSON.stringify(r.data.result)); // 25% of 99000
r = await req("POST", "/api/promo/validate", { code, items: [{ productId: "hw-990-pro-2tb", qty: 1 }] }); ok("validate: nothing eligible → scope issue", r.data.result?.issue?.kind === "scope", JSON.stringify(r.data.result));
r = await req("PATCH", "/api/admin/promo-codes", { id: pid, enabled: false }); ok("promo disable", r.status === 200);
r = await req("POST", "/api/promo/validate", { code }); ok("validate disabled → 400 not active", r.status === 400 && r.data.error === "This code is not active.", JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/promo-codes", { id: pid, ...base, code, startsAt: new Date(Date.now() + 86400e3).toISOString() }); ok("promo schedule for tomorrow", r.status === 200);
r = await req("POST", "/api/promo/validate", { code }); ok("validate scheduled → not active yet", r.data.error === "This code is not active yet.", JSON.stringify(r.data));
r = await req("DELETE", `/api/admin/promo-codes?id=${pid}`); ok("promo delete", r.status === 200);
r = await req("POST", "/api/promo/validate", { code }); ok("validate deleted → 404", r.status === 404);
ip = `10.8.${Math.floor(Math.random() * 250)}.1`; let last;
for (let i = 0; i < 11; i++) last = await req("POST", "/api/promo/validate", { code: `NOPE${i}X` });
ok("validate rate limit: 11th unknown code → 429", last.status === 429, `status ${last.status}`);
r = await req("POST", "/api/promo/validate", { code: "WELCOME10" }); ok("…limited IP is blocked for valid codes too", r.status === 429);
ip = `10.7.${Math.floor(Math.random() * 250)}.1`;
r = await req("POST", "/api/promo/validate", { code: "WELCOME10" }); ok("other IP still works", r.status === 200);

// Gift cards (admin) + balance (account)
r = await req("POST", "/api/admin/gift-cards", { amountMinor: 25000, count: 2, expiresAt: null, note: "smoke" }); ok("gift cards create 2", r.status === 200 && r.data.created?.length === 2, `status ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
const [g1, g2] = r.data.created ?? [];
r = await req("GET", "/api/admin/gift-cards"); ok("gift card list never has full code", r.status === 200 && !JSON.stringify(r.data).includes(g1?.code ?? "x"));
r = await req("PATCH", "/api/admin/gift-cards", { id: g2.id, disabled: true }); ok("gift card disable", r.status === 200);
r = await req("GET", "/api/account/balance"); const before = r.data?.giftMinor ?? -1; ok("balance GET", r.status === 200, JSON.stringify(r.data).slice(0, 100));
r = await req("POST", "/api/account/balance", { code: g1.code.toLowerCase().replace(/-/g, " ") }); ok("redeem (lower case + spaces)", r.status === 200 && r.data.amountMinor === 25000 && r.data.balance.giftMinor === before + 25000, JSON.stringify(r.data).slice(0, 150));
r = await req("POST", "/api/account/balance", { code: g1.code }); ok("redeem again → already redeemed", r.data?.error === "This gift card was already redeemed.", JSON.stringify(r.data));
r = await req("POST", "/api/account/balance", { code: g2.code }); ok("redeem disabled", r.data?.error?.startsWith("This gift card is disabled"), JSON.stringify(r.data));
r = await req("POST", "/api/account/balance", { code: "ZZZZ-ZZZZ-ZZZZ-ZZZZ" }); ok("redeem unknown", r.data?.error?.startsWith("This gift card code was not found"));
r = await req("POST", "/api/account/balance", { code: "ZZZZ-ZZZZ-ZZZZ-ZZZY" }); ok("redeem 5th attempt still allowed", r.status === 400, `status ${r.status}`);
r = await req("POST", "/api/account/balance", { code: "ZZZZ-ZZZZ-ZZZZ-ZZZX" }); ok("redeem 6th attempt → 429 (limit 5 / 10 min per user)", r.status === 429, `status ${r.status}`);
r = await req("GET", "/api/admin/gift-cards"); const red = r.data.cards.find((c) => c.id === g1.id); ok("admin sees redeemed by email", red?.redeemedBy === cred.email && red.redeemedAt, JSON.stringify(red));

// Other account APIs never run before (cart, favorites, keys, logins, profile, orders)
r = await req("PUT", "/api/cart", { productId: "key-elden-ring-steam", qty: 9 }); ok("cart PUT caps at 5", r.status === 200 && r.data.items.find((i) => i.productId === "key-elden-ring-steam")?.qty === 5, JSON.stringify(r.data));
r = await req("POST", "/api/cart", { items: [{ productId: "hw-990-pro-2tb", qty: 2 }, { productId: "bogus", qty: 1 }] }); ok("cart merge drops unknown", r.status === 200 && r.data.items.length === 2, JSON.stringify(r.data));
r = await req("DELETE", "/api/cart"); ok("cart clear", r.status === 200 && r.data.items.length === 0);
r = await req("PUT", "/api/favorites", { productId: "key-elden-ring-steam" }); ok("favorites add", r.status === 200 && r.data.ids.includes("key-elden-ring-steam"), JSON.stringify(r.data));
r = await req("POST", "/api/favorites", { ids: ["hw-990-pro-2tb", "nope"] }); ok("favorites merge", r.status === 200 && r.data.ids.length === 2, JSON.stringify(r.data));
r = await req("DELETE", "/api/favorites?productId=key-elden-ring-steam"); ok("favorites remove", r.status === 200 && r.data.ids.length === 1);
r = await req("POST", "/api/account/orders"); ok("sample order (dev)", r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
r = await req("GET", "/api/account/keys"); const k = r.data?.keys?.[0]; ok("keys list, codes hidden before reveal", r.status === 200 && k && k.code === null, JSON.stringify(r.data).slice(0, 150));
r = await req("POST", "/api/account/keys", { id: k.id }); ok("key reveal returns code", r.status === 200 && /^SAMPLE-/.test(r.data.key.code) && r.data.key.revealedAt, JSON.stringify(r.data).slice(0, 150));
r = await req("GET", "/api/account/logins"); ok("login history", r.status === 200 && r.data.logins.length > 0, JSON.stringify(r.data).slice(0, 150));
const tag = ["blue", "teal"][Math.floor(Math.random() * 2)];
r = await req("POST", "/api/auth/update-user", { country: "TH", avatar: tag, currency: "THB", marketingOptIn: true }); ok("profile update 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 150)}`);
r = await req("GET", "/api/auth/get-session?disableCookieCache=true"); const su = r.data?.user ?? {};
ok("profile values really saved", su.country === "TH" && su.avatar === tag && su.currency === "THB" && su.marketingOptIn === true && su.marketingChoiceAt, JSON.stringify({ c: su.country, a: su.avatar, cur: su.currency, m: su.marketingOptIn, at: su.marketingChoiceAt }));
r = await req("POST", "/api/auth/update-user", { country: "XX" }); ok("profile bad country → 400 with message", r.status === 400 && /Unknown country/.test(JSON.stringify(r.data)), `status ${r.status} ${JSON.stringify(r.data)}`);
r = await req("GET", "/api/auth/get-session?disableCookieCache=true"); ok("bad value did not overwrite", r.data?.user?.country === "TH");
r = await req("POST", "/api/auth/update-user", { name: "  " }); ok("profile blank name → 400", r.status === 400);

} // end of !only

if (!only || only === "returns") {
// Returns & Orders (Handoff v14 task 2). The admin account acts as the customer here (own sample orders).
async function sampleLine(kind, want = 1) {
  for (let i = 0; i < 8; i++) {
    await req("POST", "/api/account/orders");
    const o = (await req("GET", "/api/account/orders")).data.orders[0];
    const line = o.items.find((x) => x.kind === kind && x.quantity === want); if (line) return { order: o, line };
  }
  return null;
}
const keysOf = async (itemId) => (await req("GET", "/api/account/keys")).data.keys.filter((k) => k.orderItemId === itemId);
const kl = await sampleLine("game_key"); ok("returns: sample order with a key line", Boolean(kl));
const [key1] = await keysOf(kl.line.id);
r = await req("POST", "/api/account/returns", { orderItemId: kl.line.id, quantity: 1, reason: "key_unused", message: "  not needed  " });
const ret = r.data?.ret;
ok("return create (key, not revealed)", r.status === 200 && /^RT-[A-Z0-9]{8}$/.test(ret?.number) && ret.status === "requested" && ret.message === "not needed" && ret.orderNumber === kl.order.number, `status ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
r = await req("GET", "/api/account/returns"); const saved = r.data?.returns?.find((x) => x.id === ret?.id);
ok("return really saved (GET values)", saved && saved.quantity === 1 && saved.reason === "key_unused" && saved.itemName === kl.line.name && saved.adminNote === null, JSON.stringify(saved));
r = await req("POST", "/api/account/returns", { orderItemId: kl.line.id, quantity: 1, reason: "key_unused", message: "" }); ok("same line again → 409 already requested", r.status === 409 && /already requested/.test(r.data.error), JSON.stringify(r.data));
r = await req("POST", "/api/account/keys", { id: key1.id }); ok("reveal blocked while return open → 409", r.status === 409 && /part of a return/.test(r.data.error), `status ${r.status}`);
r = await req("GET", `/api/account/keys?id=${key1.id}`); ok("…key really not revealed", r.data?.key?.revealedAt === null && r.data.key.code === null);
r = await req("POST", "/api/account/returns", { orderItemId: "nope", quantity: 1, reason: "other", message: "x" }); ok("unknown line → 404", r.status === 404);
const hw = await sampleLine("hardware"); ok("returns: sample order with a hardware line", Boolean(hw));
r = await req("POST", "/api/account/returns", { orderItemId: hw.line.id, quantity: 0, reason: "damaged", message: "" }); ok("quantity 0 → 400", r.status === 400 && r.data.error === "Choose how many to return.", JSON.stringify(r.data));
r = await req("POST", "/api/account/returns", { orderItemId: hw.line.id, quantity: 2, reason: "damaged", message: "" }); ok("quantity above line → 400", r.status === 400 && /return 1 unit/.test(r.data.error), JSON.stringify(r.data));
r = await req("POST", "/api/account/returns", { orderItemId: hw.line.id, quantity: 1, reason: "key_unused", message: "" }); ok("key reason on hardware → 400", r.status === 400 && r.data.error === "Choose a reason.");
r = await req("POST", "/api/account/returns", { orderItemId: hw.line.id, quantity: 1, reason: "other", message: " " }); ok("Other without message → 400", r.status === 400 && r.data.error === "Tell us more about the problem.");
r = await req("GET", "/api/account/returns"); ok("rejected inputs saved nothing", r.data.returns.filter((x) => x.orderItemId === hw.line.id).length === 0);
r = await req("POST", "/api/account/returns", { orderItemId: hw.line.id, quantity: 1, reason: "changed_mind", message: "" }); const hret = r.data?.ret; ok("hardware return (changed mind, today)", r.status === 200 && hret?.reason === "changed_mind", JSON.stringify(r.data).slice(0, 120));

// Admin side
r = await req("GET", "/api/admin/returns"); const adm = r.data?.returns?.find((x) => x.id === ret.id); ok("admin list has customer email", r.status === 200 && adm?.customerEmail === cred.email, JSON.stringify(adm).slice(0, 160));
r = await req("PATCH", "/api/admin/returns", { id: ret.id, status: "rejected", note: "" }); ok("reject without note → 400", r.status === 400 && /Add a note/.test(r.data.error));
r = await req("PATCH", "/api/admin/returns", { id: ret.id, status: "refunded", note: "x" }); ok("requested → refunded skip → 400", r.status === 400, JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/returns", { id: ret.id, status: "rejected", note: "Smoke: key window closed." }); ok("reject with note", r.status === 200);
r = await req("GET", "/api/account/returns"); const rj = r.data.returns.find((x) => x.id === ret.id); ok("customer sees rejected + note (saved)", rj?.status === "rejected" && rj.adminNote === "Smoke: key window closed.", JSON.stringify(rj));
r = await req("POST", "/api/account/keys", { id: key1.id }); ok("rejected return frees the key: reveal 200", r.status === 200 && r.data.key.revealedAt, `status ${r.status}`);
r = await req("POST", "/api/account/returns", { orderItemId: kl.line.id, quantity: 1, reason: "key_unused", message: "" }); ok("revealed key → 409 not eligible", r.status === 409 && /key was shown/.test(r.data.error), JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/returns", { id: hret.id, status: "approved", note: null }); ok("approve hardware", r.status === 200);
r = await req("PATCH", "/api/admin/returns", { id: hret.id, status: "refunded", note: "Smoke refund by bank transfer." }); ok("mark refunded", r.status === 200);
r = await req("GET", "/api/admin/returns"); const hr = r.data.returns.find((x) => x.id === hret.id); ok("refunded + note saved", hr?.status === "refunded" && hr.adminNote === "Smoke refund by bank transfer.", JSON.stringify(hr).slice(0, 200));
r = await req("PATCH", "/api/admin/returns", { id: hret.id, status: "approved", note: null }); ok("refunded is final → 400", r.status === 400);
const kl2 = await sampleLine("game_key"); await keysOf(kl2.line.id); // sample keys are made on the first keys fetch
const both = await Promise.all([1, 2].map(() => req("POST", "/api/account/returns", { orderItemId: kl2.line.id, quantity: 1, reason: "wrong_item", message: "" })));
ok("parallel double request → one 200, one 409", both.filter((x) => x.status === 200).length === 1 && both.filter((x) => x.status === 409).length === 1, both.map((x) => x.status).join(","));
r = await req("GET", "/api/account/returns"); ok("…only one row saved", r.data.returns.filter((x) => x.orderItemId === kl2.line.id).length === 1);

} // end of returns

if (!only || only === "tickets") {
// Tickets, customer side (Handoff v15 task 3: category = Subject id, orderRef = typed order number). The admin account acts as the customer.
await req("POST", "/api/account/orders");
const tkKeys = (await req("GET", "/api/account/keys")).data.keys; const tkKey = tkKeys[0];
const tkOrder = (await req("GET", "/api/account/orders")).data.orders.find((o) => o.id !== tkKey.orderId) ?? (await req("GET", "/api/account/orders")).data.orders[0];
const count = async () => (await req("GET", "/api/account/tickets")).data.tickets.length;
const n0 = await count();
r = await req("POST", "/api/account/tickets", { orderRef: "", message: "y" }); ok("ticket without subject → 400", r.status === 400 && r.data.error === "Choose a subject.", JSON.stringify(r.data));
r = await req("POST", "/api/account/tickets", { category: "key", message: "y" }); ok("old category id → 400", r.status === 400 && r.data.error === "Choose a subject.");
r = await req("POST", "/api/account/tickets", { category: "order_issue", orderRef: "  ", message: "y" }); ok("Order issue without order number → 400", r.status === 400 && r.data.error === "Enter your order number.", JSON.stringify(r.data));
r = await req("POST", "/api/account/tickets", { category: "return_refund", orderRef: "CC 12#", message: "y" }); ok("bad order number → 400", r.status === 400 && /valid order number/.test(r.data.error), JSON.stringify(r.data));
r = await req("POST", "/api/account/tickets", { category: "questions", orderRef: "", message: "  " }); ok("blank description → 400", r.status === 400 && r.data.error === "Write a description.");
r = await req("POST", "/api/account/tickets", { category: "order_issue", orderRef: "", message: "m", keyId: "nope" }); ok("ticket with a key that is not yours → 404", r.status === 404, JSON.stringify(r.data));
ok("invalid tickets saved nothing", (await count()) === n0);
r = await req("POST", "/api/account/tickets", { category: "order_issue", orderRef: "", message: "  Key says used.  ", keyId: tkKey.id, subject: "ignored free subject" });
const tid = r.data?.id; ok("ticket create with key (Report a problem)", r.status === 200 && typeof tid === "string", `status ${r.status} ${JSON.stringify(r.data)}`);
r = await req("GET", `/api/account/tickets?id=${tid}`); const th = r.data?.ticket;
ok("ticket really saved (key → its order number in order_ref)", th && th.number >= 1001 && th.status === "open" && th.category === "order_issue" && th.subject === "Order issue" && th.keyId === tkKey.id && th.orderId === tkKey.orderId && th.orderRef === tkKey.orderNumber && th.orderNumber === tkKey.orderNumber && th.keyName === tkKey.name && th.messages.length === 1 && th.messages[0].body === "Key says used." && !th.messages[0].fromSupport, String(JSON.stringify(th ?? r.data)).slice(0, 300));
r = await req("POST", "/api/account/tickets", { category: "return_refund", orderRef: `  ${tkOrder.number.toLowerCase()} `, message: "Refund please." });
r = await req("GET", `/api/account/tickets?id=${r.data?.id}`);
ok("typed own order number (lower-case) → upper-case + linked order", r.data?.ticket?.orderRef === tkOrder.number && r.data.ticket.orderId === tkOrder.id && r.data.ticket.subject === "Return/refund" && r.data.ticket.keyId === null, String(JSON.stringify(r.data?.ticket ?? r.data)).slice(0, 250));
r = await req("POST", "/api/account/tickets", { category: "questions", orderRef: "CC-00000000", message: "Other shop order?" });
r = await req("GET", `/api/account/tickets?id=${r.data?.id}`);
ok("unknown order number kept as typed, not linked", r.data?.ticket?.orderRef === "CC-00000000" && r.data.ticket.orderId === null && r.data.ticket.orderNumber === null && r.data.ticket.subject === "Questions", String(JSON.stringify(r.data?.ticket ?? r.data)).slice(0, 250));
r = await req("PATCH", "/api/account/tickets", { id: tid, reply: " " }); ok("empty reply → 400", r.status === 400);
r = await req("PATCH", "/api/account/tickets", { id: tid, reply: "More detail." }); ok("customer reply", r.status === 200);
r = await req("PATCH", "/api/account/tickets", { id: tid, close: true }); ok("customer close", r.status === 200);
r = await req("GET", `/api/account/tickets?id=${tid}`); ok("closed saved, 2 messages", r.data.ticket.status === "closed" && r.data.ticket.messages.length === 2 && r.data.ticket.messages[1].body === "More detail.", String(JSON.stringify(r.data?.ticket ?? r.data)).slice(0, 200));
r = await req("PATCH", "/api/account/tickets", { id: tid, reply: "Reopen please." }); r = await req("GET", `/api/account/tickets?id=${tid}`);
ok("reply on closed ticket → open again", r.data.ticket.status === "open" && r.data.ticket.lastReplyBy === "customer" && r.data.ticket.messages.length === 3);
r = await req("GET", "/api/account/tickets"); ok("list has the ticket + unread 0", r.data.tickets.some((t) => t.id === tid) && r.data.unread === 0, `unread ${r.data.unread}`);
r = await req("GET", "/api/account/tickets?unread=1"); ok("unread count endpoint", r.status === 200 && r.data.unread === 0, JSON.stringify(r.data));
r = await req("GET", "/api/account/tickets?id=nope"); ok("unknown ticket → 404", r.status === 404);
let tk429 = null; for (let i = 0; i < 6 && !tk429; i++) { const x = await req("POST", "/api/account/tickets", { category: "general_support", orderRef: "", message: `Limit ${i}` }); if (x.status === 429) tk429 = x; }
ok("new ticket limit → 429 within 6 more tries (5 per hour)", tk429 && /several tickets/.test(tk429.data.error), tk429 ? "" : "no 429");
// Regression 2026-09-28: Better Auth pruned our counters in its rate_limit table (every auth request) → limits reset within a minute. Now app_rate_limit.
await req("GET", "/api/auth/get-session");
r = await req("POST", "/api/account/tickets", { category: "general_support", orderRef: "", message: "after get-session" }); ok("limit still 429 after a Better Auth request (app_rate_limit)", r.status === 429, `status ${r.status}`);
// Admin side (4b). The same account is admin + customer here.
r = await req("GET", "/api/admin/tickets"); ok("admin tickets list has the ticket with customer email", r.status === 200 && r.data.tickets.some((t) => t.id === tid && t.customerEmail), `status ${r.status}`);
r = await req("PATCH", "/api/admin/tickets", { id: tid, reply: "  " }); ok("admin empty reply → 400", r.status === 400);
r = await req("PATCH", "/api/admin/tickets", { id: tid, reply: "Support answer <b>x</b>" }); ok("admin reply → 200", r.status === 200, JSON.stringify(r.data));
r = await req("GET", `/api/admin/tickets?id=${tid}`); const at = r.data.ticket;
ok("admin reply really saved: answered + unread + support message", at.status === "answered" && at.customerUnread === true && at.messages.at(-1).fromSupport && at.messages.at(-1).body === "Support answer <b>x</b>", JSON.stringify({ s: at.status, u: at.customerUnread }));
r = await req("GET", "/api/account/tickets?unread=1"); ok("customer unread count ≥ 1 after admin reply", (r.data.unread ?? r.data.count ?? 0) >= 1, JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/tickets", { id: tid, status: "done" }); ok("admin bad status → 400", r.status === 400);
r = await req("PATCH", "/api/admin/tickets", { id: tid, status: "closed" }); ok("admin status closed → 200", r.status === 200);
r = await req("GET", `/api/admin/tickets?id=${tid}`); ok("admin status really saved", r.data.ticket.status === "closed");
r = await req("PATCH", "/api/admin/tickets", { id: "nope", status: "closed" }); ok("admin status unknown ticket → 404", r.status === 404);
}

if (!only || only === "users") {
// Users (future task S7): register as seller, admin can never come from sign-up, Add user, role change + audit. Test users use @corecart.test.
const stamp = Date.now().toString(36); const keep = cookie; const ip0 = ip;
const find = async (email) => (await req("GET", `/api/admin/users?q=${encodeURIComponent(email)}`)).data.users?.[0];
cookie = ""; ip = `10.6.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Seller", email: `smoke.seller.${stamp}@corecart.test`, password: "smoke-password-2026", role: "seller" });
ok("sign-up asking for seller → 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Sneaky", email: `smoke.sneaky.${stamp}@corecart.test`, password: "smoke-password-2026", role: "admin" });
ok("sign-up asking for admin → 200 (made customer)", r.status === 200, `status ${r.status}`);
cookie = keep; ip = ip0;
let su2 = await find(`smoke.seller.${stamp}@corecart.test`); ok("seller request saved as customer (T3: sellers apply at /sell)", su2?.role === "customer", JSON.stringify(su2?.role));
su2 = await find(`smoke.sneaky.${stamp}@corecart.test`); ok("admin request saved as customer", su2?.role === "customer", JSON.stringify(su2?.role));
r = await req("POST", "/api/auth/update-user", { role: "admin" }); ok("update-user role → 400", r.status === 400, `status ${r.status}`);
const added = `smoke.added.${stamp}@corecart.test`;
r = await req("POST", "/api/admin/users", { name: "Smoke Added", email: added.toUpperCase(), role: "customer" }); const addedId = r.data?.id;
ok("admin add user → 200", r.status === 200 && typeof addedId === "string", `status ${r.status} ${JSON.stringify(r.data)}`);
r = await req("POST", "/api/admin/users", { name: "Smoke Added", email: added, role: "customer" }); ok("admin add same email → 409", r.status === 409);
r = await req("POST", "/api/admin/users", { name: "", email: "bad", role: "customer" }); ok("admin add bad input → 400", r.status === 400);
su2 = await find(added); ok("added user really saved (lower-case email, not verified, customer)", su2?.email === added && su2.emailVerified === false && su2.role === "customer", JSON.stringify(su2));
r = await req("PATCH", "/api/admin/user", { id: addedId, role: "seller" }); ok("role change → 200", r.status === 200);
r = await req("GET", `/api/admin/user?id=${addedId}`);
ok("role + audit really saved", r.data.user.role === "seller" && r.data.audit[0]?.detail === "customer → seller" && r.data.audit.some((a) => a.action === "created"), JSON.stringify(r.data.audit));
const me2 = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data.user;
r = await req("PATCH", "/api/admin/user", { id: me2.id, role: "customer" }); ok("own role change → 400", r.status === 400 && r.data.error === "You cannot change your own role.", JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/user", { id: addedId, role: "boss" }); ok("unknown role → 400", r.status === 400);
} // end of users

if (!only || only === "wallet") {
// Admin wallet (future task S8). The admin account adjusts its own balance, then reverses it (net 0).
const me = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data.user;
const w0 = (await req("GET", `/api/admin/user?id=${me.id}`)).data.wallet;
ok("wallet: user detail has wallet", w0 && Array.isArray(w0.transactions), JSON.stringify(w0)?.slice(0, 120));
const why = `Smoke credit ${Date.now()}`;
r = await req("POST", "/api/admin/balance", { userId: me.id, direction: "credit", bucket: "wallet", amountMinor: 12345, reason: why });
ok("wallet: credit → 200", r.status === 200 && r.data.wallet.walletMinor === w0.walletMinor + 12345, `status ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
let w1 = (await req("GET", `/api/admin/user?id=${me.id}`)).data.wallet; const row = w1.transactions[0];
ok("wallet: ledger row really saved (type, reason, amount, by)", row.type === "adjustment" && row.ref === why && row.amountMinor === 12345 && row.bucket === "wallet" && row.by === me.email, JSON.stringify(row));
r = await req("GET", "/api/account/balance"); ok("wallet: customer balance shows it (no admin email)", r.data.transactions?.[0]?.ref === why && !("by" in r.data.transactions[0]), JSON.stringify(r.data.transactions?.[0]));
r = await req("POST", "/api/admin/balance", { userId: me.id, direction: "debit", bucket: "wallet", amountMinor: w1.walletMinor + 1, reason: "too much" }); ok("wallet: debit below 0 → 400", r.status === 400 && r.data.error === "A debit cannot take the balance below ฿0.", JSON.stringify(r.data));
r = await req("POST", "/api/admin/balance", { userId: me.id, direction: "credit", bucket: "wallet", amountMinor: 100, reason: "  " }); ok("wallet: empty reason → 400", r.status === 400);
r = await req("POST", "/api/admin/balance", { userId: me.id, direction: "credit", bucket: "cash", amountMinor: 100, reason: "x" }); ok("wallet: bad bucket → 400", r.status === 400);
r = await req("POST", "/api/admin/balance", { userId: "nope", direction: "credit", bucket: "wallet", amountMinor: 100, reason: "x" }); ok("wallet: unknown user → 404", r.status === 404);
r = await req("GET", `/api/admin/users?q=${encodeURIComponent(me.email)}&sort=balance`); ok("wallet: users list balance column", r.data.users?.[0]?.balanceMinor === w1.walletMinor + w1.giftMinor, JSON.stringify(r.data.users?.[0]?.balanceMinor));
r = await req("GET", "/api/admin/stats"); ok("wallet: stats owed", typeof r.data.owed?.walletMinor === "number" && r.data.owed.walletMinor >= w1.walletMinor, JSON.stringify(r.data.owed));
// Two debits at once for the whole balance: only one may pass (row lock).
const both = await Promise.all([1, 2].map(() => req("POST", "/api/admin/balance", { userId: me.id, direction: "debit", bucket: "wallet", amountMinor: w1.walletMinor, reason: "Smoke parallel debit" })));
ok("wallet: parallel full debits → one 200, one 400", both.map((x) => x.status).sort().join() === "200,400", both.map((x) => x.status).join());
// Put the balance back as it was before the run.
r = await req("POST", "/api/admin/balance", { userId: me.id, direction: "credit", bucket: "wallet", amountMinor: w0.walletMinor, reason: "Smoke: restore" });
const wEnd = (await req("GET", `/api/admin/user?id=${me.id}`)).data.wallet; ok("wallet: restored to the start balance", wEnd.walletMinor === w0.walletMinor, `${wEnd.walletMinor} vs ${w0.walletMinor}`);
} // end of wallet

if (!only || only === "filters") {
// Filter manager (future task S4). Every change is undone at the end (shared database).
const flt = async () => (await req("GET", "/api/admin/filters")).data.config;
const opt = (c, g, v) => c.options.find((o) => o.group === g && o.value === v);
let c = await flt(); ok("filters: config has catalog values", opt(c, "genre", "FPS/TPS") && opt(c, "country", "TH") && c.groups.length === 8, `${c?.options?.length} options`);
const fps = opt(c, "genre", "FPS/TPS"); const fpsLabel = fps.label;
r = await req("PATCH", "/api/admin/filters", { id: fps.id, label: "Shooter smoke" }); ok("filters: rename", r.status === 200);
r = await req("GET", "/api/filters"); ok("filters: rename really saved (public read)", opt(r.data.config, "genre", "FPS/TPS")?.label === "Shooter smoke");
r = await req("PATCH", "/api/admin/filters", { id: fps.id, label: "horror" }); ok("filters: taken name → 400", r.status === 400 && r.data.error === "That name is already in this group.", JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/filters", { id: fps.id, hidden: true }); ok("filters: hide saved", r.status === 200 && opt(r.data.config, "genre", "FPS/TPS").hidden === true);
const list = (cfg) => cfg.options.filter((o) => o.group === "genre" && !o.deleted).sort((a, b) => a.position - b.position).map((o) => o.value);
const order0 = list(await flt()); const i0 = order0.indexOf("FPS/TPS");
r = await req("PATCH", "/api/admin/filters", { id: fps.id, move: i0 > 0 ? -1 : 1 }); const order1 = list(r.data.config);
ok("filters: move saved", order1.indexOf("FPS/TPS") === i0 + (i0 > 0 ? -1 : 1), `${i0} → ${order1.indexOf("FPS/TPS")}`);
const val = `Smoke${Date.now().toString().slice(-5)}`;
r = await req("POST", "/api/admin/filters", { group: "genre", label: val }); const added = opt(r.data?.config ?? { options: [] }, "genre", val); ok("filters: add saved", r.status === 200 && added && !added.hidden);
r = await req("POST", "/api/admin/filters", { group: "country", label: "Atlantis" }); ok("filters: add to Countries → 400", r.status === 400);
r = await req("DELETE", `/api/admin/filters?id=${opt(c, "sale", "On sale").id}`); ok("filters: delete Sale value → 400", r.status === 400);
r = await req("DELETE", `/api/admin/filters?id=${added?.id}`); ok("filters: delete saved (soft)", r.status === 200 && opt(r.data.config, "genre", val).deleted === true);
r = await req("PATCH", "/api/admin/filters", { group: "os", shown: false, startOpen: false }); ok("filters: group hide saved", r.status === 200 && r.data.config.groups.find((g) => g.id === "os").shown === false);
// Undo.
await req("PATCH", "/api/admin/filters", { id: fps.id, label: fpsLabel, hidden: false, move: i0 > 0 ? 1 : -1 });
await req("PATCH", "/api/admin/filters", { group: "os", shown: true, startOpen: true });
c = await flt(); ok("filters: undo restored", opt(c, "genre", "FPS/TPS").label === fpsLabel && !opt(c, "genre", "FPS/TPS").hidden && list(c).indexOf("FPS/TPS") === i0 && c.groups.find((g) => g.id === "os").shown);
} // end of filters

if (!only || only === "products") {
// Catalog DB + admin products + key inventory (task B). The test product is deleted at the end (status "deleted", id stays reserved).
const webp = (w, h) => { const b = Buffer.alloc(30); b.write("RIFF", 0); b.writeUInt32LE(22, 4); b.write("WEBPVP8X", 8); b.writeUInt32LE(10, 16);
  b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return `data:image/webp;base64,${b.toString("base64")}`; };
r = await req("GET", "/api/admin/products"); ok("products: admin list has the seed", r.status === 200 && r.data.products.length >= 31 && r.data.products.some((x) => x.id === "key-elden-ring-steam"), `${r.data.products?.length}`);
r = await req("GET", "/api/catalog"); const n0 = r.data.products?.length; ok("products: public catalog", r.status === 200 && n0 >= 30);
r = await req("POST", "/api/admin/products/image", { dataUrl: webp(10, 10) }); ok("products: wrong image size → 400", r.status === 400);
r = await req("POST", "/api/admin/products/image", { dataUrl: webp(800, 1000) }); const img = r.data.url; ok("products: 800 x 1000 image saved", r.status === 201 && (img ?? "").startsWith("/api/images/"), JSON.stringify(r.data));
const res = await fetch(B + img); const bytes = Buffer.from(await res.arrayBuffer());
ok("products: image served (type, cache, same bytes)", res.status === 200 && res.headers.get("content-type") === "image/webp" && /immutable/.test(res.headers.get("cache-control") ?? "") && bytes.length === 30);
const pid = `key-smoke-${Date.now().toString(36)}`;
const body = { kind: "game_key", id: pid, name: "Smoke Test Game", image: img, price: 45000, old: 60000, status: "published", platform: "Steam", region: "Asia", type: "Game", rule: "only", countries: ["TH", "SG"], genres: ["Action"], description: "Smoke description", requirements: [["OS", "Windows 11"]], trending: true, family: "smoke-game", edition: "Standard" };
r = await req("POST", "/api/admin/products", { ...body, price: 0 }); ok("products: bad price → 400", r.status === 400 && /price/.test(r.data.error));
r = await req("POST", "/api/admin/products", { ...body, image: "data:image/webp;base64,AAAA" }); ok("products: data URL image refused on server → 400", r.status === 400);
r = await req("POST", "/api/admin/products", body); ok("products: create", r.status === 201 && r.data.product.id === pid);
r = await req("GET", `/api/admin/products?id=${pid}`); const sp = r.data.product;
ok("products: values really saved", sp && sp.price === 45000 && sp.old === 60000 && sp.only?.join() === "TH,SG" && sp.genres?.join() === "Action" && sp.requirements?.[0]?.[1] === "Windows 11" && sp.trending === true && sp.family === "smoke-game" && sp.image === img, JSON.stringify(sp));
r = await req("POST", "/api/admin/products", body); ok("products: same id again → 409", r.status === 409);
r = await req("GET", "/api/catalog"); ok("products: in the public catalog", r.data.products.some((x) => x.id === pid && x.price === 45000));
r = await req("PATCH", "/api/admin/products", { ...body, price: 39900, status: "draft" }); ok("products: update to draft", r.status === 200 && r.data.product.price === 39900 && r.data.product.status === "draft");
r = await req("GET", "/api/catalog"); ok("products: draft left the public catalog", !r.data.products.some((x) => x.id === pid));
r = await req("PATCH", "/api/admin/products", { ...body, status: "published" }); ok("products: published again", r.status === 200);
r = await req("PUT", "/api/favorites", { productId: pid }); ok("products: new product can be a favorite (server catalog reloaded)", r.status === 200 && r.data.ids?.includes(pid), JSON.stringify(r.data).slice(0, 120));
await req("DELETE", `/api/favorites?productId=${pid}`);
// Key inventory
r = await req("POST", "/api/admin/products/keys", { productId: pid, text: ["SMOKE-AAAAA-1111", "smoke-aaaaa-1111", "bad key", "SMOKE-BBBBB-2222"].join("\n"), batch: "Smoke" });
ok("keys: add (dup + invalid skipped)", r.status === 201 && r.data.result.added === 2 && r.data.result.duplicates === 1 && r.data.result.invalid.length === 1, JSON.stringify(r.data));
r = await req("POST", "/api/admin/products/keys", { productId: pid, text: "SMOKE-BBBBB-2222\nSMOKE-CCCCC-3333" }); ok("keys: already stored → duplicate", r.data.result?.added === 1 && r.data.result.duplicates === 1);
r = await req("GET", `/api/admin/products/keys?productId=${pid}`); const inv = r.data.inventory;
ok("keys: counts + last 4 only (codes never sent)", inv?.counts.available === 3 && inv.keys.some((k) => k.last4 === "3333" && k.batch === null) && !JSON.stringify(r.data).includes("SMOKE-"), JSON.stringify(inv?.counts));
r = await req("POST", "/api/admin/products/keys", { productId: "hw-fractal-north", text: "HWKEY-11111" }); ok("keys: hardware product → 400", r.status === 400);
r = await req("DELETE", `/api/admin/products/keys?productId=${pid}&keyId=${inv?.keys[0]?.id}`); ok("keys: remove available key", r.status === 200);
r = await req("GET", "/api/admin/products/keys"); ok("keys: per-product counts saved", r.data.counts?.[pid]?.available === 2, JSON.stringify(r.data.counts?.[pid]));
// Delete
r = await req("DELETE", `/api/admin/products?id=${pid}`); ok("products: delete", r.status === 200);
r = await req("GET", `/api/admin/products?id=${pid}`); ok("products: deleted → 404 in admin", r.status === 404);
r = await req("GET", "/api/catalog"); ok("products: deleted left the catalog", !r.data.products.some((x) => x.id === pid) && r.data.products.length === n0);
r = await req("POST", "/api/admin/products", body); ok("products: deleted id stays reserved → 409", r.status === 409);
} // end of products

if (!only || only === "topups") {
// Wallet top-ups (future task T1). The webhook checks need PAYMENT_PROVIDER=dev in .env.local (restart npm run dev); with the default
// "none" only the "coming soon" checks run. The admin account tops up its own wallet; every credit is reversed at the end (Adjust balance).
const hook = async (raw, sig) => { const res = await fetch(`${B}/api/payments/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "x-dev-signature": sig, "x-forwarded-for": ip }, body: raw }); return { status: res.status, data: await res.json().catch(() => null) }; };
const sign = (raw) => createHmac("sha256", process.env.PAYMENT_DEV_SECRET || "corecart-dev-webhook-secret").update(raw).digest("hex");
const event = (t, type, extra = {}) => JSON.stringify({ id: `smoke_evt_${crypto.randomUUID()}`, type, topUpId: t.id, amountMinor: t.amountMinor, currency: t.currency, ...extra });
const key = () => `smoke-${crypto.randomUUID()}`;
const create = (amountMinor, idempotencyKey = key(), currency = "USD") => req("POST", "/api/account/topups", { amountMinor, currency, idempotencyKey });
const getTu = async (id) => (await req("GET", `/api/account/topups?id=${encodeURIComponent(id)}`)).data.topUp;
const cfg = (await req("GET", "/api/config")).data.payments;
ok("topups: config has payments", cfg && typeof cfg.available === "boolean" && typeof cfg.provider === "string", JSON.stringify(cfg));
if (!cfg?.available) {
  const before = (await req("GET", "/api/account/topups")).data.topUps.length;
  r = await create(500); ok("topups (none): create → 503 coming soon", r.status === 503 && r.data.error === "Card payments are coming soon.", JSON.stringify(r.data));
  ok("topups (none): nothing saved", (await req("GET", "/api/account/topups")).data.topUps.length === before);
  r = await hook(JSON.stringify({ id: "x", type: "payment.succeeded" }), "0".repeat(64)); ok("topups (none): webhook → 400", r.status === 400, `status ${r.status}`);
  results.push(`SKIP  topups: create, webhook credit, double webhook, failed, admin, daily cap — server runs PAYMENT_PROVIDER=${cfg?.provider}. Add PAYMENT_PROVIDER=dev to .env.local, restart npm run dev, run again.`);
} else {
  const me = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data.user;
  const wallet = async () => (await req("GET", `/api/admin/user?id=${me.id}`)).data.wallet;
  const w0 = (await wallet()).walletMinor;
  // Validation (nothing saved)
  r = await create(499); ok("topups: under $5 → 400", r.status === 400 && r.data.error === "The minimum top-up is $5.00.", JSON.stringify(r.data));
  r = await create(100001); ok("topups: over $1,000 → 400", r.status === 400 && r.data.error === "The maximum top-up is $1,000.00.", JSON.stringify(r.data));
  r = await create(500, key(), "XXX"); ok("topups: unknown currency → 400", r.status === 400 && r.data.error.includes("can't be charged"), JSON.stringify(r.data));
  r = await req("POST", "/api/account/topups", { amountMinor: 500, currency: "USD", idempotencyKey: "x" }); ok("topups: bad idempotency key → 400", r.status === 400);
  // Create + idempotency + one pending at a time
  const k1 = key(); r = await create(500, k1); const a = r.data.topUp;
  ok("topups: create → pending + simulate", r.status === 200 && a?.status === "pending" && r.data.payment?.kind === "simulate" && a.creditMinor > 0, `status ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  r = await create(500, k1); ok("topups: same idempotency key → same top-up", r.status === 200 && r.data.topUp?.id === a.id, JSON.stringify(r.data?.topUp?.number));
  let s = await getTu(a.id); ok("topups: pending really saved (amount, currency, 30 min deadline)", s.amountMinor === 500 && s.currency === "USD" && s.provider === "dev" && Date.parse(s.expiresAt) - Date.parse(s.createdAt) === 1800000, JSON.stringify(s));
  r = await create(700); const c = r.data.topUp;
  s = await getTu(a.id); ok("topups: new top-up cancels the older pending one", s.status === "cancelled" && s.failureReason === "Replaced by a newer top-up.", JSON.stringify(s.status));
  // Webhook: bad signature, credit once, repeat, second event, parallel
  const raw = event(c, "payment.succeeded");
  r = await hook(raw, "0".repeat(64)); ok("topups: webhook bad signature → 400", r.status === 400, `status ${r.status}`);
  ok("topups: bad signature changed nothing", (await getTu(c.id)).status === "pending" && (await wallet()).walletMinor === w0);
  r = await hook(raw, sign(raw)); ok("topups: webhook paid → credited", r.status === 200 && r.data.result === "credited", JSON.stringify(r.data));
  let w = await wallet(); const row = w.transactions[0];
  ok("topups: wallet +credit exactly once", w.walletMinor === w0 + c.creditMinor, `${w.walletMinor} vs ${w0 + c.creditMinor}`);
  ok("topups: ledger row really saved (type top_up, ref = number, amount)", row.type === "top_up" && row.ref === c.number && row.amountMinor === c.creditMinor && row.bucket === "wallet" && row.by === null, JSON.stringify(row));
  s = await getTu(c.id); ok("topups: top-up really saved as credited (paid + credited times)", s.status === "credited" && s.paidAt && s.creditedAt, JSON.stringify(s));
  r = await hook(raw, sign(raw)); ok("topups: same webhook again → duplicate", r.status === 200 && r.data.result === "duplicate", JSON.stringify(r.data));
  const raw2 = event(c, "payment.succeeded"); r = await hook(raw2, sign(raw2)); ok("topups: new event, same top-up → already credited", r.status === 200 && r.data.result === "ignored: already credited", JSON.stringify(r.data));
  w = await wallet(); ok("topups: still credited once (balance + one ledger row)", w.walletMinor === w0 + c.creditMinor && w.transactions.filter((t) => t.ref === c.number).length === 1, `${w.walletMinor}`);
  r = await create(600); const d = r.data.topUp; const p1 = event(d, "payment.succeeded"); const p2 = event(d, "payment.succeeded");
  const both = await Promise.all([hook(p1, sign(p1)), hook(p2, sign(p2))]);
  ok("topups: two webhooks at once → credited once", both.map((x) => x.data?.result).sort().join() === "credited,ignored: already credited", both.map((x) => x.data?.result).join());
  w = await wallet(); ok("topups: parallel balance +credit once", w.walletMinor === w0 + c.creditMinor + d.creditMinor, `${w.walletMinor}`);
  // Failed + amount mismatch
  r = await create(800); const e = r.data.topUp; const f1 = event(e, "payment.failed", { reason: "Card declined (smoke)." });
  r = await hook(f1, sign(f1)); s = await getTu(e.id); ok("topups: failed webhook → failed + reason saved", r.data?.result === "failed" && s.status === "failed" && s.failureReason === "Card declined (smoke)." && s.closedAt, JSON.stringify(s));
  r = await create(900); const f = r.data.topUp; const m1 = event(f, "payment.succeeded", { amountMinor: 901 });
  r = await hook(m1, sign(m1)); ok("topups: amount mismatch → not credited", r.data?.result?.startsWith("error: amount mismatch") && (await getTu(f.id)).status === "pending", JSON.stringify(r.data));
  w = await wallet(); ok("topups: failed + mismatch left the wallet alone", w.walletMinor === w0 + c.creditMinor + d.creditMinor, `${w.walletMinor}`);
  // Dev simulate endpoint (same webhook path)
  r = await req("POST", "/api/account/topups/simulate", { id: f.id, outcome: "paid" }); ok("topups: simulate paid → credited", r.status === 200 && r.data.result === "credited" && r.data.topUp.status === "credited", JSON.stringify(r.data?.result));
  r = await req("POST", "/api/account/topups/simulate", { id: f.id, outcome: "resend" }); ok("topups: simulate resend → duplicate", r.status === 200 && r.data.result === "duplicate", JSON.stringify(r.data?.result));
  // Admin list, filters, detail, cancel + audit
  r = await req("GET", `/api/admin/topups?q=${c.number}`); ok("topups admin: search by number", r.status === 200 && r.data.data.total === 1 && r.data.data.topUps[0].email === me.email && r.data.data.topUps[0].status === "credited", JSON.stringify(r.data?.data?.total));
  r = await create(500); const g = r.data.topUp;
  r = await req("GET", "/api/admin/topups?status=pending&provider=dev"); ok("topups admin: status + provider filter", r.data.data.topUps.some((t) => t.id === g.id) && r.data.data.topUps.every((t) => t.status === "pending" && t.provider === "dev"));
  r = await req("GET", `/api/admin/topups?id=${c.id}`); ok("topups admin: detail has the event log", r.data.topUp?.events?.length === 2 && r.data.topUp.events.some((x) => x.result === "credited") && r.data.topUp.fxRate, JSON.stringify(r.data.topUp?.events?.map((x) => x.result)));
  r = await req("PATCH", "/api/admin/topups", { id: g.id, action: "cancel", reason: " " }); ok("topups admin: cancel without reason → 400", r.status === 400);
  r = await req("PATCH", "/api/admin/topups", { id: g.id, action: "cancel", reason: "Smoke cancel" });
  ok("topups admin: cancel → cancelled, by admin, reason saved", r.status === 200 && r.data.topUp.status === "cancelled" && r.data.topUp.closedBy === me.email && r.data.topUp.failureReason === "Smoke cancel", JSON.stringify(r.data).slice(0, 160));
  r = await req("PATCH", "/api/admin/topups", { id: g.id, action: "fail", reason: "again" }); ok("topups admin: close a closed top-up → 409", r.status === 409);
  r = await req("PATCH", "/api/admin/topups", { id: c.id, action: "cancel", reason: "no" }); ok("topups admin: cannot cancel a credited top-up", r.status === 409 && (await getTu(c.id)).status === "credited");
  const detail = (await req("GET", `/api/admin/user?id=${me.id}`)).data;
  ok("topups admin: audit row saved", detail.audit[0]?.action === "topup_cancelled" && detail.audit[0].detail === `${g.number} · Smoke cancel` && detail.audit[0].by === me.email, JSON.stringify(detail.audit[0]));
  ok("topups admin: user detail lists top-ups", detail.topUps.some((t) => t.id === c.id && t.status === "credited"));
  // Daily cap: fill up to under $1,000 left with real credits if needed, then ask for more than is left.
  const cur = (await req("GET", "/api/currencies")).data; const thbRate = Number(cur.base.rate);
  const leftUsd = async () => Math.floor((await req("GET", "/api/account/topups")).data.dailyLeftMinor / thbRate);
  let left = await leftUsd();
  if (left > 100000) { r = await create(100000); const big = r.data.topUp; const b1 = event(big, "payment.succeeded"); await hook(b1, sign(b1)); left = await leftUsd(); }
  if (left > 100000) { r = await create(100000); const big = r.data.topUp; const b1 = event(big, "payment.succeeded"); await hook(b1, sign(b1)); left = await leftUsd(); }
  r = await create(Math.max(500, Math.min(100000, left + 200)));
  ok("topups: over the daily cap → 400", r.status === 400 && /daily top-up limit/.test(r.data.error), `left ~${(left / 100).toFixed(2)} → ${r.status} ${JSON.stringify(r.data)}`);
  // Put the wallet back (one reversing adjustment line; top-up rows stay as history).
  const extra = (await wallet()).walletMinor - w0;
  if (extra > 0) await req("POST", "/api/admin/balance", { userId: me.id, direction: "debit", bucket: "wallet", amountMinor: extra, reason: "Smoke: reverse test top-up credits" });
  ok("topups: wallet restored to the start balance", (await wallet()).walletMinor === w0);
  results.push("SKIP  topups: 30-minute expiry on the real server — waiting 30 minutes is too slow for a smoke run; the same rule (lib/topup.ts isExpiredNow + expireStale) is covered by the e2e clock test \"pending top-up expires after 30 minutes\".");
}
} // end of topups

if (!only || only === "menu") {
// Store menu (task D): admin writes → public read, values really saved; rules (safe links, one level); soft delete; undo.
const menuAll = async () => (await req("GET", "/api/admin/menu")).data.items;
const live = (items) => items.filter((m) => !m.deleted);
const item = (items, id) => items.find((m) => m.id === id);
let items = await menuAll(); ok("menu: default menu seeded", item(items, "m-trending")?.isNew === true && item(items, "m-random-steam")?.href === "/games?type=Random+key&platform=Steam" && item(items, "m-genres")?.kind === "genres", `${items?.length} items`);
const label = `Smoke menu ${Date.now().toString(36)}`;
r = await req("POST", "/api/admin/menu", { label, href: "/games?genre=Racing", kind: "link", parent: null, isNew: true, inBar: true, inFooter: false });
const mine = r.data?.items?.find((m) => m.label === label); ok("menu: add saved", r.status === 200 && mine && mine.isNew && mine.inBar && !mine.hidden, `status ${r.status}`);
r = await req("GET", "/api/menu"); ok("menu: add really saved (public read)", item(r.data.items, mine?.id)?.href === "/games?genre=Racing");
r = await req("POST", "/api/admin/menu", { label: "Sub smoke", href: "/games?genre=Racing&sale=On+sale", kind: "link", parent: mine?.id, isNew: false, inBar: true, inFooter: true });
const sub = r.data?.items?.find((m) => m.label === "Sub smoke" && m.parent === mine?.id); ok("menu: sub-item saved (bar/footer forced off)", r.status === 200 && sub && !sub.inBar && !sub.inFooter);
r = await req("POST", "/api/admin/menu", { label: "Deep", href: "/games", kind: "link", parent: sub?.id, isNew: false, inBar: false, inFooter: false }); ok("menu: second level → 400", r.status === 400 && r.data.error === "A sub-item can only sit under a top-level item.", JSON.stringify(r.data));
r = await req("POST", "/api/admin/menu", { label: "Evil", href: "https://example.com", kind: "link", parent: null, isNew: false, inBar: false, inFooter: false }); ok("menu: outside link → 400", r.status === 400);
r = await req("POST", "/api/admin/menu", { label: "Evil2", href: "//example.com", kind: "link", parent: null, isNew: false, inBar: false, inFooter: false }); ok("menu: protocol-relative link → 400", r.status === 400);
r = await req("POST", "/api/admin/menu", { label: "", href: "/games", kind: "link", parent: null, isNew: false, inBar: false, inFooter: false }); ok("menu: empty name → 400", r.status === 400);
r = await req("PATCH", "/api/admin/menu", { id: mine?.id, parent: "m-platforms" }); ok("menu: item with sub-items cannot be nested → 400", r.status === 400);
r = await req("PATCH", "/api/admin/menu", { id: mine?.id, label: `${label} x`, hidden: true, isNew: false }); const upd = item(r.data?.items ?? [], mine?.id);
ok("menu: edit + hide saved", r.status === 200 && upd?.label === `${label} x` && upd.hidden && !upd.isNew);
const tops = (xs) => live(xs).filter((m) => !m.parent).sort((a, b) => a.position - b.position).map((m) => m.id);
const at = tops(r.data.items).indexOf(mine.id);
r = await req("PATCH", "/api/admin/menu", { id: mine.id, move: -1 }); ok("menu: move up saved", tops(r.data.items).indexOf(mine.id) === at - 1, `${at} → ${tops(r.data.items).indexOf(mine.id)}`);
r = await req("DELETE", `/api/admin/menu?id=${mine.id}`); ok("menu: delete saved (soft, sub-item too)", r.status === 200 && item(r.data.items, mine.id)?.deleted && item(r.data.items, sub.id)?.deleted);
r = await req("DELETE", `/api/admin/menu?id=${mine.id}`); ok("menu: delete again → 404", r.status === 404);
items = await menuAll(); ok("menu: positions stay 0..n-1 after delete", tops(items).every((id, i) => item(items, id).position === i));
r = await req("GET", "/api/catalog"); const rk = r.data.products.filter((p) => p.type === "Random key");
ok("menu: 4 seed random keys in the catalog (3 Steam)", rk.length === 4 && rk.filter((p) => p.platform === "Steam").length === 3, rk.map((p) => p.id).join(", "));
} // end of menu

if (!only || only === "admins") {
// T2 master admin permissions: the master's API, values really saved, audit rows, guards. Test admins use @corecart.test.
const master = cookie; const stamp = Date.now().toString(36);
r = await req("GET", "/api/admin/me"); ok("admins: smoke admin is master with 11 sections", r.data?.master === true && r.data.perms?.length === 11, JSON.stringify(r.data) + (r.data?.master ? "" : " (run npm run admin:create -- --email <smoke admin> --master)"));
const list = async () => (await req("GET", "/api/admin/admins")).data;
let L = await list(); const meId = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data.user.id;
ok("admins: list has me as master_admin", L?.admins?.some((a) => a.id === meId && a.role === "master_admin" && a.perms.length === 11), JSON.stringify(L?.admins?.map((a) => a.email + ":" + a.role)));
const hEmail = `smoke.admin.${stamp}@corecart.test`;
r = await req("POST", "/api/admin/users", { name: "Smoke Admin", email: hEmail, role: "admin", perms: ["tickets", "promo", "tickets"] }); const hId = r.data?.id;
ok("admins: add admin with 2 sections → 200", r.status === 200 && typeof hId === "string", `status ${r.status} ${JSON.stringify(r.data)}`);
L = await list(); let h = L.admins.find((a) => a.id === hId);
ok("admins: new admin + sections really saved (section order, no repeats)", h?.role === "admin" && JSON.stringify(h.perms) === JSON.stringify(["promo", "tickets"]), JSON.stringify(h));
ok("admins: history has created + sections row", L.history.some((x) => x.email === hEmail && x.action === "perms" && x.detail === "none → Promo codes, Tickets") && L.history.some((x) => x.email === hEmail && x.action === "created" && x.detail === "admin"), JSON.stringify(L.history.slice(0, 3)));
r = await req("PATCH", "/api/admin/admins", { id: hId, perms: ["users", "tickets"] }); ok("admins: change sections → 200", r.status === 200 && JSON.stringify(r.data.perms) === JSON.stringify(["users", "tickets"]), JSON.stringify(r.data));
r = await req("GET", `/api/admin/user?id=${hId}`); ok("admins: change really saved + audited before → after (who, when)", r.data.audit?.[0]?.action === "perms" && r.data.audit[0].detail === "Promo codes, Tickets → Users, Tickets" && r.data.audit[0].by === cred.email && Date.now() - Date.parse(r.data.audit[0].createdAt) < 120_000, JSON.stringify(r.data.audit?.[0]));
r = await req("PATCH", "/api/admin/admins", { id: hId, perms: ["users", "tickets"] }); r = await req("GET", `/api/admin/user?id=${hId}`); ok("admins: same sections again → no new audit row", r.data.audit.filter((a) => a.action === "perms").length === 2, `${r.data.audit.filter((a) => a.action === "perms").length} rows`);
r = await req("PATCH", "/api/admin/admins", { id: hId, perms: ["users", "root"] }); ok("admins: unknown section → 400", r.status === 400, JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/admins", { id: meId, perms: [] }); ok("admins: own sections → 400 (master has all)", r.status === 400, JSON.stringify(r.data));
const cEmail = `smoke.cust.${stamp}@corecart.test`; r = await req("POST", "/api/admin/users", { name: "Smoke Cust", email: cEmail, role: "customer" }); const cId = r.data?.id;
r = await req("PATCH", "/api/admin/admins", { id: cId, perms: ["users"] }); ok("admins: sections on a customer → 400", r.status === 400 && r.data.error === "This user is not an admin.", JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/user", { id: cId, role: "admin" }); L = await list(); h = L.admins.find((a) => a.id === cId);
ok("admins: promote customer → admin starts with no sections", r.status === 200 && h && h.perms.length === 0, JSON.stringify(h));
r = await req("PATCH", "/api/admin/user", { id: cId, role: "customer" }); L = await list();
ok("admins: remove admin → customer, gone from list, audited", r.status === 200 && !L.admins.some((a) => a.id === cId) && L.history.some((x) => x.email === cEmail && x.detail === "admin → customer"), `status ${r.status}`);
r = await req("PATCH", "/api/admin/user", { id: meId, role: "admin" }); ok("admins: master cannot demote itself → 400", r.status === 400, JSON.stringify(r.data));
// A plain admin (optional second login): 403 outside its sections, never manages admins.
const helper = process.env.SMOKE_HELPER_EMAIL ? { email: process.env.SMOKE_HELPER_EMAIL, password: process.env.SMOKE_HELPER_PASSWORD } : { email: cred.helper_email, password: cred.helper_password };
if (!helper.email) {
  for (const n of ["plain admin: /me sections", "plain admin: section it has → 200", "plain admin: 9 other sections → 403", "plain admin: add admin → 403", "plain admin: admins page → 403", "plain admin: promote to admin → 403", "plain admin: overview hides users + balance owed"]) skip(`admins: ${n}`, "no helper admin login (SMOKE_HELPER_EMAIL / helper_email=, see file header)");
} else {
  cookie = ""; r = await req("POST", "/api/auth/sign-in/email", helper); const helperCookie = cookie;
  const hid = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data?.user?.id;
  cookie = master; r = await req("PATCH", "/api/admin/admins", { id: hid, perms: ["tickets"] }); ok("admins: master sets helper to Tickets only", r.status === 200, JSON.stringify(r.data));
  cookie = helperCookie;
  r = await req("GET", "/api/admin/me"); ok("admins: plain admin: /me sections", r.data?.admin === true && r.data.master === false && JSON.stringify(r.data.perms) === '["tickets"]', JSON.stringify(r.data));
  r = await req("GET", "/api/admin/tickets"); ok("admins: plain admin: section it has → 200", r.status === 200, `status ${r.status}`);
  const denied = []; for (const path of ["/api/admin/users", "/api/admin/topups", "/api/admin/products", "/api/admin/menu", "/api/admin/filters", "/api/admin/currencies", "/api/admin/gift-cards", "/api/admin/promo-codes", "/api/admin/returns"]) { r = await req("GET", path); if (r.status !== 403 || r.data.error !== "No access to this section. Ask the master admin.") denied.push(`${path} ${r.status}`); }
  r = await req("POST", "/api/admin/balance", { userId: hid, direction: "credit", bucket: "wallet", amountMinor: 100, reason: "x" }); if (r.status !== 403) denied.push(`balance ${r.status}`);
  ok("admins: plain admin: 9 other sections → 403", denied.length === 0, denied.join(", "));
  cookie = master; await req("PATCH", "/api/admin/admins", { id: hid, perms: ["users", "tickets"] }); cookie = helperCookie;
  r = await req("POST", "/api/admin/users", { name: "Nope", email: `smoke.nope.${stamp}@corecart.test`, role: "admin" }); ok("admins: plain admin: add admin → 403", r.status === 403, JSON.stringify(r.data));
  r = await req("GET", "/api/admin/admins"); ok("admins: plain admin: admins page → 403", r.status === 403, `status ${r.status}`);
  r = await req("PATCH", "/api/admin/user", { id: cId, role: "admin" }); ok("admins: plain admin: promote to admin → 403", r.status === 403, JSON.stringify(r.data));
  r = await req("GET", "/api/admin/stats"); ok("admins: plain admin: overview hides users + balance owed", r.status === 200 && r.data.recent !== null && r.data.owed === null, `owed ${JSON.stringify(r.data.owed)}`);
  cookie = master; await req("PATCH", "/api/admin/admins", { id: hid, perms: ["users", "wallet", "topups", "products", "menu", "filters", "currencies", "giftcards", "promo", "returns", "tickets"] }); // back to all
}
cookie = master;
r = await req("PATCH", "/api/admin/user", { id: hId, role: "customer" }); ok("admins: cleanup test admin → customer", r.status === 200);
} // end of admins

if (!only || only === "sellers") {
// T3 seller application + close account. Values really saved (DB via admin API, file bytes back through the audited route).
const stamp = Date.now().toString(36); const idNum = `SMK${Date.now().toString().slice(-8)}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
async function up(kind, name, bytes, type) {
  const form = new FormData(); form.append("kind", kind); form.append("file", new Blob([bytes], { type }), name);
  const res = await fetch(B + "/api/sell/files", { method: "POST", headers: { Origin: B, Cookie: cookie, "x-forwarded-for": ip }, body: form });
  return { status: res.status, data: await res.json().catch(() => null) };
}
r = await up("key", "fake.png", Buffer.from("not an image at all"), "image/png"); ok("sellers: text named .png → 400 (type by content)", r.status === 400 && r.data.error === "Use a JPG, PNG, WebP or PDF file.", JSON.stringify(r.data));
r = await up("key", "keys.pdf", PDF, "application/pdf"); ok("sellers: PDF as key photo → 400", r.status === 400 && r.data.error === "Use a JPG, PNG or WebP image.", JSON.stringify(r.data));
r = await up("invoice", "big.pdf", Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]), "application/pdf"); ok("sellers: over 5 MB → 413", r.status === 413, `status ${r.status}`);
const files = {};
for (const [kind, name, bytes, type] of [["invoice", "inv.pdf", PDF, "application/pdf"], ["key", "keys.png", PNG, "image/png"], ["id_front", "front.png", PNG, "image/png"], ["id_back", "back.png", PNG, "image/png"]]) {
  r = await up(kind, name, bytes, type); (files[kind] ??= []).push(r.data?.file?.id);
  ok(`sellers: upload ${kind} → 200 (type from content)`, r.status === 200 && r.data.file.mime === type && r.data.file.size === bytes.length, JSON.stringify(r.data));
}
const fileList = { invoice: files.invoice, key: files.key, id_front: files.id_front, id_back: files.id_back, selfie: [] };
const base = { firstName: "Smoke", lastName: "Seller", merchantName: `Smoke Shop ${stamp}`, storeUrl: "", profiles: "", why: "Smoke test application for the real server run.", sources: ["Official distributor"], businessCountry: "TH", citizenship: "TH", stockSize: "Under 100", productTypes: ["Game keys"], heardFrom: "Other",
  isCompany: false, companyName: "", companyReg: "", companyTax: "", companyAddress: "", idType: "passport", idNumber: idNum, confirm: true };
r = await req("POST", "/api/sell", { ...base, why: "short", files: fileList }); ok("sellers: bad step → 400 with field errors", r.status === 400 && r.data.errors?.why, JSON.stringify(r.data));
r = await req("POST", "/api/sell", { ...base, files: { ...fileList, id_front: ["not-my-file-id-123"] } }); ok("sellers: someone else's / unknown file → 400", r.status === 400 && r.data.error === "One of the files is missing. Upload it again.", JSON.stringify(r.data));
r = await req("POST", "/api/sell", { ...base, files: fileList }); const A = r.data?.application;
ok("sellers: submit → pending SA-number", r.status === 200 && /^SA-1\d{5}$/.test(A?.number) && A.status === "pending", JSON.stringify(r.data));
r = await req("POST", "/api/sell", { ...base, files: fileList }); ok("sellers: second submit while pending → 409", r.status === 409 && r.data.error === "You already have an application under review.", JSON.stringify(r.data));
r = await req("GET", "/api/sell"); ok("sellers: GET /api/sell = my application", r.data?.application?.id === A?.id && r.data.application.status === "pending");
r = await req("GET", `/api/admin/sellers?tab=pending&q=${A?.number}`); ok("sellers: admin Pending tab lists it", r.status === 200 && r.data.rows.some((x) => x.id === A?.id) && typeof r.data.counts.pending === "number", JSON.stringify(r.data?.counts));
r = await req("GET", `/api/admin/sellers?id=${A?.id}`); const D = r.data?.seller;
ok("sellers: detail really saved (answers, ID number decrypted, 4 files, submitted event)", D?.merchantName === base.merchantName && D.idNumber === idNum && D.idLast4 === idNum.slice(-4) && D.files.length === 4 && D.events.some((e) => e.action === "submitted"), JSON.stringify({ id: D?.idNumber, files: D?.files?.length }));
const front = D?.files?.find((f) => f.kind === "id_front");
let fr = await fetch(`${B}/api/admin/seller-files?id=${front?.id}`, { headers: { Cookie: cookie, Origin: B } }); const got = Buffer.from(await fr.arrayBuffer());
ok("sellers: admin views ID front → same bytes back (decrypted), no-store, nosniff", fr.status === 200 && got.equals(PNG) && fr.headers.get("cache-control")?.includes("no-store") && fr.headers.get("x-content-type-options") === "nosniff", `status ${fr.status} ${got.length} bytes`);
fr = await fetch(`${B}/api/admin/seller-files?id=${front?.id}&download=1`, { headers: { Cookie: cookie, Origin: B } });
ok("sellers: download = attachment", fr.status === 200 && fr.headers.get("content-disposition")?.startsWith("attachment"), fr.headers.get("content-disposition"));
r = await req("GET", `/api/admin/sellers?id=${A?.id}`); ok("sellers: every view / download audited with the admin", r.data.seller.events.filter((e) => (e.action === "viewed" || e.action === "downloaded") && e.by === cred.email).length === 2, JSON.stringify(r.data.seller.events.map((e) => e.action)));
const onDisk = fs.readdirSync(".data/uploads/seller").length; ok("sellers: files stored encrypted on disk (no plain PNG header)", onDisk > 0 && !fs.readdirSync(".data/uploads/seller").slice(-4).some((n) => fs.readFileSync(`.data/uploads/seller/${n}`).subarray(0, 8).equals(PNG.subarray(0, 8))), `${onDisk} files`);
r = await req("PATCH", "/api/admin/sellers", { id: A?.id, action: "reject", reason: "" }); ok("sellers: reject without reason → 400", r.status === 400);
r = await req("PATCH", "/api/admin/sellers", { id: A?.id, action: "approve" }); ok("sellers: approve → 200", r.status === 200, JSON.stringify(r.data));
r = await req("GET", `/api/admin/sellers?id=${A?.id}`); ok("sellers: approved + decided by me saved; admin role unchanged", r.data.seller.status === "approved" && r.data.seller.decidedBy === cred.email && (await req("GET", "/api/admin/me")).data.admin === true);
r = await req("PATCH", "/api/admin/sellers", { id: A?.id, action: "reject", reason: "late" }); ok("sellers: reject after approve → 409", r.status === 409);
r = await req("PATCH", "/api/admin/sellers", { id: A?.id, action: "blacklist", reason: "Smoke blacklist" }); r = await req("GET", `/api/admin/sellers?id=${A?.id}`);
ok("sellers: blacklist saved (reason, Blacklisted tab)", r.data.seller.status === "blacklisted" && r.data.seller.blacklistReason === "Smoke blacklist" && r.data.seller.tab === "blacklisted");
r = await req("GET", "/api/sell"); ok("sellers: applicant sees Rejected + generic text, never the blacklist reason", r.data.application.status === "rejected" && !JSON.stringify(r.data).includes("Smoke blacklist"), JSON.stringify(r.data.application));
// Same ID number again (new merchant name) → flagged as returning person with the blacklisted record.
const files2 = {}; for (const [kind, name, bytes, type] of [["invoice", "inv2.pdf", PDF, "application/pdf"], ["key", "k2.png", PNG, "image/png"], ["id_front", "f2.png", PNG, "image/png"]]) { r = await up(kind, name, bytes, type); files2[kind] = [r.data?.file?.id]; }
r = await req("POST", "/api/sell", { ...base, merchantName: `Smoke Two ${stamp}`, files: { ...files2, id_back: [], selfie: [] } }); const A2 = r.data?.application;
ok("sellers: new application while the old one is blacklisted → 200", r.status === 200 && A2?.status === "pending", JSON.stringify(r.data));
r = await req("GET", `/api/admin/sellers?id=${A2?.id}`); ok("sellers: returning person flagged (same KYC ID number, blacklisted, link)", r.data.seller.matchList.some((m) => m.kind === "id_number" && m.what === "blacklisted" && m.applicationId === A?.id), JSON.stringify(r.data.seller.matchList));
r = await req("GET", `/api/admin/sellers?tab=pending&q=${A2?.number}`); ok("sellers: list shows the match count", r.data.rows[0]?.matches >= 1, JSON.stringify(r.data.rows[0]));
r = await req("PATCH", "/api/admin/sellers", { id: A2?.id, action: "reject", reason: "Smoke reject" }); r = await req("GET", "/api/sell"); ok("sellers: reject reason reaches the applicant", r.data.application.status === "rejected" && r.data.application.reason === "Smoke reject");
r = await req("PATCH", "/api/admin/sellers", { id: A?.id, action: "unblacklist", reason: "Smoke cleanup" }); r = await req("GET", `/api/admin/sellers?id=${A?.id}`);
ok("sellers: remove from blacklist → Rejected (an approved seller never comes back silently)", r.data.seller.status === "rejected" && r.data.seller.events[0].action === "unblacklist");
// Close account (admin) on an admin-made customer; a new sign-up with that email frees it and is flagged.
const cEmail = `smoke.close.${stamp}@corecart.test`; r = await req("POST", "/api/admin/users", { name: "Smoke Close", email: cEmail, role: "customer" }); const cId = r.data?.id;
r = await req("PATCH", "/api/admin/user", { id: cId, close: "" }); ok("close: no reason → 400", r.status === 400);
r = await req("PATCH", "/api/admin/user", { id: cId, close: "Smoke close" }); r = await req("GET", `/api/admin/user?id=${cId}`);
ok("close: closed status, reason, audit really saved", r.data.user.status === "closed" && r.data.user.closedReason === "Smoke close" && r.data.user.closedEmail === cEmail && r.data.audit[0]?.action === "closed", JSON.stringify(r.data.user));
r = await req("GET", `/api/admin/users?status=closed&q=${encodeURIComponent(cEmail)}`); ok("close: Closed tab lists it", r.data.users?.length === 1 && r.data.users[0].status === "closed");
r = await req("GET", `/api/admin/users?status=active&q=${encodeURIComponent(cEmail)}`); ok("close: not in the Active tab", r.data.users?.length === 0);
r = await req("PATCH", "/api/admin/user", { id: meIdOf(), close: "self" }).catch(() => ({ status: 0 })); ok("close: own account → 400", r.status === 400);
const keepC = cookie; cookie = ""; const ipK = ip; ip = `10.5.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Back", email: cEmail, password: "smoke-password-2026" }); cookie = keepC; ip = ipK;
ok("close: sign-up again with the closed email → 200 (new account)", r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
r = await req("GET", `/api/admin/users?status=active&q=${encodeURIComponent(cEmail)}`); const nu = r.data.users?.[0];
ok("close: new account flagged as returning person", nu && nu.id !== cId && nu.returning === true, JSON.stringify(nu));
r = await req("GET", `/api/admin/user?id=${nu?.id}`); ok("close: new account links to the closed record", r.data.matches?.some((m) => m.what === "closed_account" && m.userId === cId), JSON.stringify(r.data.matches));
r = await req("GET", `/api/admin/user?id=${cId}`); ok("close: closed record kept, email column freed, closed_email kept", r.data.user.status === "closed" && r.data.user.email !== cEmail && r.data.user.closedEmail === cEmail, r.data.user.email);
r = await req("PATCH", "/api/admin/user", { id: cId, reopen: "Smoke reopen" }); ok("close: reopen while the email is taken → 409", r.status === 409, JSON.stringify(r.data));
const hEmail2 = `smoke.reopen.${stamp}@corecart.test`; r = await req("POST", "/api/admin/users", { name: "Smoke Reopen", email: hEmail2, role: "customer" }); const rId = r.data?.id;
await req("PATCH", "/api/admin/user", { id: rId, close: "Smoke close 2" }); r = await req("PATCH", "/api/admin/user", { id: rId, reopen: "Smoke reopen" }); const rr = await req("GET", `/api/admin/user?id=${rId}`);
ok("close: reopen → active again, email back, audited", r.status === 200 && rr.data.user.status === "active" && rr.data.user.email === hEmail2 && rr.data.audit[0]?.action === "reopened", JSON.stringify(rr.data.user));
r = await req("POST", "/api/account/close", { word: "close", password: "x" }); ok("close: own close needs the word CLOSE → 400", r.status === 400 && r.data.error === "Type CLOSE to confirm.");
r = await req("POST", "/api/account/close", { word: "CLOSE", password: "wrong-password" }); ok("close: wrong password → 400 (admin stays open)", r.status === 400 && r.data.error === "Wrong password.", JSON.stringify(r.data));
} // end of sellers

if (!only || only === "emails") {
// Email task (2026-09-29): verify code, welcome, order confirmed, order page + tax details + seller rating, password changed, new-device alert,
// login history location, admin test email. Reads the dev outbox (/api/admin/emails): needs npm run dev WITHOUT RESEND_API_KEY (dev only).
const adminJar = cookie; const ip0 = ip; const stamp = Date.now().toString(36);
// Emails go out after the response (next/server after()), so wait a moment before reading the outbox.
const outboxOf = async (to) => { await new Promise((res) => setTimeout(res, 500)); const keep = cookie; cookie = adminJar; const o = await req("GET", "/api/admin/emails"); cookie = keep; return (o.data?.outbox ?? []).filter((m) => m.to === to); };
r = await req("GET", "/api/admin/emails");
if (r.data?.resend) skip("emails part", "RESEND_API_KEY is set: emails leave the server, the dev outbox stays empty");
else {
  ok("admin email outbox (dev)", r.status === 200 && Array.isArray(r.data.outbox), `status ${r.status}`);
  r = await req("POST", "/api/admin/emails", { id: "orderConfirmed" }); ok("admin send test email → 200 to self", r.status === 200 && r.data.to === cred.email, JSON.stringify(r.data));
  r = await req("POST", "/api/admin/emails", { id: "nope" }); ok("admin test email unknown template → 400", r.status === 400);
  ok("test email really in outbox", (await outboxOf(cred.email)).some((m) => m.subject.startsWith("[Test] Your CoreCart order")));
  // Customer: sign up → code email
  const email = `smoke.mail.${stamp}@corecart.test`; const pw = "smoke-password-2026";
  cookie = ""; ip = `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Mail", email, password: pw }); ok("sign-up → 200", r.status === 200, `status ${r.status}`);
  let mails = await outboxOf(email); const v = mails.find((m) => m.template === "verify");
  const code = v?.subject.match(/^(\d{6}) is your CoreCart confirmation code$/)?.[1];
  ok("verify email: 6-digit code in subject + body, link in body, shared layout", !!code && v.html.includes(code) && v.html.includes("/verify-email?token=") && v.html.includes("#7C3AED"), v?.subject);
  r = await req("POST", "/api/verify-code", { email, code: code === "000000" ? "111111" : "000000" }); ok("verify-code wrong → 400", r.status === 400 && r.data.error === "Wrong code. Check the email and try again.", JSON.stringify(r.data));
  r = await req("POST", "/api/verify-code", { email, code: "12" }); ok("verify-code bad format → 400", r.status === 400);
  r = await req("POST", "/api/verify-code", { email, code }); ok("verify-code right → 200 + session", r.status === 200 && cookie.includes("session_token"), JSON.stringify(r.data));
  ok("device cookie set on that sign-in", /cc_device=[A-Za-z0-9_-]{43}/.test(cookie));
  r = await req("GET", "/api/auth/get-session?disableCookieCache=true"); ok("email really verified in DB", r.data?.user?.emailVerified === true);
  r = await req("POST", "/api/verify-code", { email, code }); ok("code used twice → 400 expired", r.status === 400 && r.data.error === "This code has expired. Send a new code.");
  ok("welcome email sent", (await outboxOf(email)).some((m) => m.template === "welcome"));
  // Order: sample → email + order page fields
  r = await req("POST", "/api/account/orders"); const oid = r.data?.id; ok("sample order → 200", r.status === 200 && !!oid, `status ${r.status}`);
  mails = await outboxOf(email); const oc = mails.find((m) => m.template === "orderConfirmed");
  ok("order confirmed email: Get key → order page, Rate the seller, Get receipt, no key codes", !!oc && oc.html.includes(`/account/orders/view?id=${oid}`) && oc.html.includes("&amp;rate=1") && oc.html.includes(`/account/orders/receipt?id=${oid}`), oc?.subject);
  r = await req("GET", `/api/account/orders?id=${oid}`); const o = r.data?.order;
  ok("order detail saved: card •••• 4242, paidAt, subtotal, seller CoreCart, productId", o?.paymentMethod === "card" && o.paymentLast4 === "4242" && !!o.paidAt && o.subtotalMinor === o.totalCents && o.items.every((i) => i.seller === "CoreCart") && o.items.some((i) => i.productId), JSON.stringify(o).slice(0, 200));
  r = await req("GET", `/api/account/orders?id=${o?.number}`); ok("order by CC- number", r.data?.order?.id === oid);
  r = await req("PATCH", "/api/account/orders", { id: oid, taxInfo: { name: "Smoke Co", taxId: "1", address: "Bangkok" } }); ok("tax ID bad → 400", r.status === 400 && r.data.error === "Tax ID: 5–20 letters, digits or dashes.");
  r = await req("PATCH", "/api/account/orders", { id: oid, taxInfo: { name: " Smoke  Co ", taxId: "0105561234567", address: "1 Sukhumvit Rd, Bangkok" } }); ok("tax details → 200", r.status === 200);
  r = await req("GET", `/api/account/orders?id=${oid}`); ok("tax details really saved (trimmed)", r.data.order.taxInfo?.name === "Smoke Co" && r.data.order.taxInfo.taxId === "0105561234567", JSON.stringify(r.data.order.taxInfo));
  r = await req("PATCH", "/api/account/orders", { id: oid, taxInfo: null }); r = await req("GET", `/api/account/orders?id=${oid}`); ok("tax details removed", r.data.order.taxInfo === null);
  r = await req("POST", "/api/account/ratings", { orderId: oid, seller: "CoreCart", stars: 6 }); ok("rating 6 stars → 400", r.status === 400);
  r = await req("POST", "/api/account/ratings", { orderId: oid, seller: "Someone", stars: 5 }); ok("rating seller not on order → 400", r.status === 400);
  r = await req("POST", "/api/account/ratings", { orderId: oid, seller: "CoreCart", stars: 4, comment: " Fast " }); ok("rating → 200", r.status === 200 && r.data.rating.stars === 4);
  r = await req("POST", "/api/account/ratings", { orderId: oid, seller: "CoreCart", stars: 5, comment: "Great" }); ok("rating again = edit", r.status === 200);
  r = await req("GET", `/api/account/orders?id=${oid}`); ok("one rating saved, edited", r.data.order.ratings?.length === 1 && r.data.order.ratings[0].stars === 5 && r.data.order.ratings[0].comment === "Great", JSON.stringify(r.data.order.ratings));
  // Password change → email; same device sign-in → no alert; new device → alert
  r = await req("POST", "/api/auth/change-password", { currentPassword: pw, newPassword: `${pw}-2`, revokeOtherSessions: true }); ok("change password → 200", r.status === 200, `status ${r.status}`);
  ok("password changed email", (await outboxOf(email)).some((m) => m.template === "passwordChanged"));
  await req("POST", "/api/auth/sign-out", {});
  r = await req("POST", "/api/auth/sign-in/email", { email, password: `${pw}-2` }); ok("sign-in same device → 200", r.status === 200);
  ok("same device: no new sign-in email", !(await outboxOf(email)).some((m) => m.template === "newSignIn"));
  await req("POST", "/api/auth/sign-out", {});
  cookie = cookie.split("; ").filter((c) => !c.startsWith("cc_device=")).join("; ");
  r = await req("POST", "/api/auth/sign-in/email", { email, password: `${pw}-2` }); ok("sign-in new device → 200", r.status === 200);
  const alert = (await outboxOf(email)).find((m) => m.template === "newSignIn");
  ok("new device: New sign-in email with device + sample location", !!alert && alert.html.includes("sample location"), alert?.subject);
  r = await req("GET", "/api/account/logins"); ok("login history has the location", r.data?.logins?.[0]?.location?.includes("sample location"), JSON.stringify(r.data?.logins?.[0]));
  r = await req("POST", "/api/account/ratings", { orderId: "nope", stars: 5 }); ok("rating other / unknown order → 404", r.status === 404);
  cookie = ""; r = await req("POST", "/api/account/ratings", { orderId: oid, stars: 5 }); ok("rating signed out → 401", r.status === 401);
  r = await req("GET", "/api/admin/emails"); ok("admin emails signed out → 401", r.status === 401);
}
cookie = adminJar; ip = ip0;
} // end of emails


// Signed out
cookie = "";
r = await req("GET", "/api/sell"); ok("sell signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/sellers"); ok("admin sellers signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/seller-files?id=x"); ok("admin seller files signed out → 401", r.status === 401);
r = await req("POST", "/api/account/close", { word: "CLOSE" }); ok("close signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/admins"); ok("admin admins signed out → 401", r.status === 401);
r = await req("GET", "/api/account/tickets"); ok("tickets signed out → 401", r.status === 401);
r = await req("GET", "/api/account/returns"); ok("returns signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/returns"); ok("admin returns signed out → 401", r.status === 401);
r = await req("GET", "/api/account/balance"); ok("balance signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/promo-codes"); ok("admin promo signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/filters"); ok("admin filters signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/tickets"); ok("admin tickets signed out → 401", r.status === 401);
r = await req("POST", "/api/admin/users", { name: "x", email: "x@corecart.test", role: "admin" }); ok("admin add user signed out → 401", r.status === 401);
r = await req("PATCH", "/api/admin/user", { id: "x", role: "admin" }); ok("admin role change signed out → 401", r.status === 401);
r = await req("POST", "/api/admin/balance", { userId: "x", direction: "credit", bucket: "wallet", amountMinor: 100, reason: "x" }); ok("admin balance signed out → 401", r.status === 401);
r = await req("GET", "/api/account/topups"); ok("topups signed out → 401", r.status === 401);
r = await req("POST", "/api/account/topups/simulate", { id: "x", outcome: "paid" }); ok("topup simulate signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/topups"); ok("admin topups signed out → 401", r.status === 401);
r = await req("POST", "/api/admin/filters", { group: "genre", label: "Nope" }); ok("admin filters write signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/products"); ok("admin products signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/menu"); ok("admin menu signed out → 401", r.status === 401);
r = await req("POST", "/api/admin/menu", { label: "Nope", href: "/games" }); ok("admin menu write signed out → 401", r.status === 401);
r = await req("GET", "/api/menu"); ok("public menu works for guests", r.status === 200 && r.data.items.some((m) => m.id === "m-all-offers"));
r = await req("POST", "/api/admin/products/image", { dataUrl: "x" }); ok("admin image upload signed out → 401", r.status === 401);
r = await req("GET", "/api/catalog"); ok("public catalog works for guests", r.status === 200 && r.data.products.length > 0);
r = await req("GET", "/api/filters"); ok("public filters works for guests", r.status === 200 && Array.isArray(r.data.config?.options));
r = await req("POST", "/api/promo/validate", { code: "WELCOME10" }); ok("validate works for guests", r.status === 200);

console.log(results.join("\n"));
const failed = results.filter((x) => x.startsWith("FAIL")).length;
const skipped = results.filter((x) => x.startsWith("SKIP")).length;
console.log(`\n${results.length - failed - skipped} passed, ${failed} failed${skipped ? `, ${skipped} skipped (reasons above)` : ""}`);
process.exit(failed ? 1 : 0);
