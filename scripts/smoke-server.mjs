// Server-mode API smoke test (test-only, not in live/). Run against the dev server with the local PGlite database:
//   npm run dev            (other terminal)
//   node scripts/smoke-server.mjs
// Admin login: SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD, else "Claude outputs/local-test-admin.txt" (Git-ignored, email= / password= lines).
// Make a local admin with: npm run admin:create -- --email local-admin@corecart.test (stop npm run dev first: PGlite = one process).
// One part only: node scripts/smoke-server.mjs returns | tickets | filters | wallet (skips promo, gift cards and the other account APIs).
// Tickets: 5 new tickets per hour per user, so a second tickets run within an hour reports the create checks as 429.
// Checks saved values, not only status codes. Random x-forwarded-for IPs keep IP rate limits of earlier runs out of the way;
// the per-user gift card limit is not (5 tries / 10 min): wait 10 minutes between runs or the redeem checks report "Too many attempts".
import fs from "node:fs";
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
r = await req("GET", "/api/account/balance"); ok("wallet: customer balance shows it (no admin email)", r.data.balance.transactions[0]?.ref === why && !("by" in r.data.balance.transactions[0]), JSON.stringify(r.data.balance.transactions[0]));
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
let c = await flt(); ok("filters: config has catalog values", opt(c, "genre", "FPS") && opt(c, "country", "TH") && c.groups.length === 8, `${c?.options?.length} options`);
const fps = opt(c, "genre", "FPS"); const fpsLabel = fps.label;
r = await req("PATCH", "/api/admin/filters", { id: fps.id, label: "Shooter smoke" }); ok("filters: rename", r.status === 200);
r = await req("GET", "/api/filters"); ok("filters: rename really saved (public read)", opt(r.data.config, "genre", "FPS")?.label === "Shooter smoke");
r = await req("PATCH", "/api/admin/filters", { id: fps.id, label: "horror" }); ok("filters: taken name → 400", r.status === 400 && r.data.error === "That name is already in this group.", JSON.stringify(r.data));
r = await req("PATCH", "/api/admin/filters", { id: fps.id, hidden: true }); ok("filters: hide saved", r.status === 200 && opt(r.data.config, "genre", "FPS").hidden === true);
const list = (cfg) => cfg.options.filter((o) => o.group === "genre" && !o.deleted).sort((a, b) => a.position - b.position).map((o) => o.value);
const order0 = list(await flt()); const i0 = order0.indexOf("FPS");
r = await req("PATCH", "/api/admin/filters", { id: fps.id, move: i0 > 0 ? -1 : 1 }); const order1 = list(r.data.config);
ok("filters: move saved", order1.indexOf("FPS") === i0 + (i0 > 0 ? -1 : 1), `${i0} → ${order1.indexOf("FPS")}`);
const val = `Smoke${Date.now().toString().slice(-5)}`;
r = await req("POST", "/api/admin/filters", { group: "genre", label: val }); const added = opt(r.data?.config ?? { options: [] }, "genre", val); ok("filters: add saved", r.status === 200 && added && !added.hidden);
r = await req("POST", "/api/admin/filters", { group: "country", label: "Atlantis" }); ok("filters: add to Countries → 400", r.status === 400);
r = await req("DELETE", `/api/admin/filters?id=${opt(c, "sale", "On sale").id}`); ok("filters: delete Sale value → 400", r.status === 400);
r = await req("DELETE", `/api/admin/filters?id=${added?.id}`); ok("filters: delete saved (soft)", r.status === 200 && opt(r.data.config, "genre", val).deleted === true);
r = await req("PATCH", "/api/admin/filters", { group: "os", shown: false, startOpen: false }); ok("filters: group hide saved", r.status === 200 && r.data.config.groups.find((g) => g.id === "os").shown === false);
// Undo.
await req("PATCH", "/api/admin/filters", { id: fps.id, label: fpsLabel, hidden: false, move: i0 > 0 ? 1 : -1 });
await req("PATCH", "/api/admin/filters", { group: "os", shown: true, startOpen: true });
c = await flt(); ok("filters: undo restored", opt(c, "genre", "FPS").label === fpsLabel && !opt(c, "genre", "FPS").hidden && list(c).indexOf("FPS") === i0 && c.groups.find((g) => g.id === "os").shown);
} // end of filters

// Signed out
cookie = "";
r = await req("GET", "/api/account/tickets"); ok("tickets signed out → 401", r.status === 401);
r = await req("GET", "/api/account/returns"); ok("returns signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/returns"); ok("admin returns signed out → 401", r.status === 401);
r = await req("GET", "/api/account/balance"); ok("balance signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/promo-codes"); ok("admin promo signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/filters"); ok("admin filters signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/tickets"); ok("admin tickets signed out → 401", r.status === 401);
r = await req("POST", "/api/admin/balance", { userId: "x", direction: "credit", bucket: "wallet", amountMinor: 100, reason: "x" }); ok("admin balance signed out → 401", r.status === 401);
r = await req("POST", "/api/admin/filters", { group: "genre", label: "Nope" }); ok("admin filters write signed out → 401", r.status === 401);
r = await req("GET", "/api/filters"); ok("public filters works for guests", r.status === 200 && Array.isArray(r.data.config?.options));
r = await req("POST", "/api/promo/validate", { code: "WELCOME10" }); ok("validate works for guests", r.status === 200);

console.log(results.join("\n"));
const failed = results.filter((x) => x.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
