// Server-mode API smoke test (test-only, not in live/). Run against the dev server with the local PGlite database:
//   npm run dev            (other terminal)
//   node scripts/smoke-server.mjs
// Admin login: SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD, else "Claude outputs/local-test-admin.txt" (Git-ignored, email= / password= lines).
// Make a local admin with: npm run admin:create -- --email local-admin@corecart.test (stop npm run dev first: PGlite = one process).
// One part only: node scripts/smoke-server.mjs returns | tickets | filters | wallet | users | topups | products | menu | admins | sellers | emails | popup | checkout (skips promo, gift cards and the other account APIs).
// admins (T2): the smoke admin must be the master admin (npm run admin:create -- --email <it> --master, server stopped). The 403 checks of a
// plain admin need a second admin that can sign in: SMOKE_HELPER_EMAIL + SMOKE_HELPER_PASSWORD, or helper_email= / helper_password= lines in
// the same file (npm run admin:create -- --email helper@corecart.test). Without it those checks are listed as SKIP with the reason.
// sellers (T3): the smoke admin applies itself (it stays admin: approve only turns customers into sellers), files go to .data/uploads/seller.
// It leaves its applications as Rejected, so the part can run again. Close account is tested on an admin-made customer + a new sign-up.
// topups: full checks need PAYMENT_PROVIDER=dev in .env.local (restart npm run dev); with "none" only the "coming soon" checks run.
// topups also checks bank transfers (top-up redesign): admin bank details, send, confirm received, audit; runs with any provider.
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
// A crash (a step got an unexpected answer) still prints every check made so far, so the cause is visible.
let printed = false;
process.on("exit", (code) => { if (!printed && results.length) { console.log(`\n--- stopped early (exit ${code}); checks so far ---\n${results.join("\n")}`); } });
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
// R7: every email sign-up must send the Terms version (lib/terms.ts).
const TERMS = fs.readFileSync("lib/terms.ts", "utf8").match(/TERMS_VERSION = "([^"]+)"/)[1];
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
// R2: a return and a key reveal on the same 1-unit line, sent together, 5 rounds: never both succeed; the saved state matches.
for (let round = 1; round <= 5; round++) {
  const kl3 = await sampleLine("game_key"); const [k3] = await keysOf(kl3.line.id);
  const [ret3, rev3] = await Promise.all([req("POST", "/api/account/returns", { orderItemId: kl3.line.id, quantity: 1, reason: "key_unused", message: "" }), req("POST", "/api/account/keys", { id: k3.id })]);
  const keyNow = (await req("GET", `/api/account/keys?id=${k3.id}`)).data.key; const rows = (await req("GET", "/api/account/returns")).data.returns.filter((x) => x.orderItemId === kl3.line.id && x.status !== "rejected");
  const bothOk = ret3.status === 200 && rev3.status === 200;
  ok(`R2 round ${round}: return + reveal in parallel → never both (return ${ret3.status}, reveal ${rev3.status})`, !bothOk && (ret3.status === 200) !== (rev3.status === 200));
  ok(`R2 round ${round}: saved state matches (open return XOR revealed key)`, (rows.length === 1) === (keyNow.revealedAt === null) && rows.length <= 1, JSON.stringify({ rows: rows.length, revealedAt: keyNow.revealedAt }));
}

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
r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Seller", email: `smoke.seller.${stamp}@corecart.test`, password: "smoke-password-2026", termsVersion: TERMS, role: "seller" });
ok("sign-up asking for seller → 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Sneaky", email: `smoke.sneaky.${stamp}@corecart.test`, password: "smoke-password-2026", termsVersion: TERMS, role: "admin" });
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
// R8: a complete provider event = amount + currency as charged + the payment reference saved at create (read from the admin detail).
const refOf = async (t) => (await req("GET", `/api/admin/topups?id=${t.id}`)).data.topUp?.providerRef ?? null;
const event = async (t, type, extra = {}) => JSON.stringify({ id: `smoke_evt_${crypto.randomUUID()}`, type, topUpId: t.id, providerRef: await refOf(t), amountMinor: t.amountMinor, currency: t.currency, ...extra });
const key = () => `smoke-${crypto.randomUUID()}`;
// This part needs ~15 top-ups; the real limit is 10 per user per 10 min. The first 429 is checked (message), then the script waits for
// the window to reset and repeats the same request (same idempotency key), so the limit itself is tested, not loosened.
let limitSeen = false;
const create = async (amountMinor, idempotencyKey = key(), currency = "USD") => {
  for (let waited = 0; ; waited += 30) {
    const r = await req("POST", "/api/account/topups", { amountMinor, currency, idempotencyKey });
    if (r.status !== 429 || waited >= 690) return r;
    if (!limitSeen) { limitSeen = true; ok("topups: more than 10 top-ups in 10 min → 429", r.data?.error === "Too many top-ups. Wait 10 minutes and try again.", JSON.stringify(r.data)); console.log("topups: rate limit reached (10 / 10 min), waiting for the window to reset…"); }
    await new Promise((f) => setTimeout(f, 30_000));
  }
};
const getTu = async (id) => (await req("GET", `/api/account/topups?id=${encodeURIComponent(id)}`)).data.topUp;
const cfg = (await req("GET", "/api/config")).data.payments;
ok("topups: config has payments", cfg && typeof cfg.available === "boolean" && typeof cfg.provider === "string", JSON.stringify(cfg));
// ── Bank transfer (top-up redesign 2026-10-01). Works with any PAYMENT_PROVIDER: the admin confirms, no provider. Settings are restored at the end.
// Runs BEFORE the card checks below: those fill the $2,000 daily cap, which would refuse a new bank transfer.
const bankLeftThb = (await req("GET", "/api/account/topups")).data.dailyLeftMinor;
const bankThbRate = Number((await req("GET", "/api/currencies")).data.base.rate);
if (bankLeftThb < 6000 * bankThbRate) results.push("SKIP  bank: transfer checks — less than $60 of today's $2,000 top-up limit is left for this admin account (an earlier smoke run used it); run again after 24 hours.");
else {
  const me = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data.user;
  const wallet = async () => (await req("GET", `/api/admin/user?id=${me.id}`)).data.wallet;
  const w0 = (await wallet()).walletMinor;
  const before = (await req("GET", "/api/admin/bank-transfer")).data;
  ok("bank: admin GET settings + history", before && typeof before.settings?.bankName === "string" && Array.isArray(before.history), JSON.stringify(before).slice(0, 160));
  const empty = { bankName: "", accountName: "", accountNumber: "", swift: "" };
  r = await req("PUT", "/api/admin/bank-transfer", empty);
  r = await req("GET", "/api/account/topups"); ok("bank: not set up → customer bank = null (Coming soon)", r.status === 200 && r.data.bank === null, JSON.stringify(r.data.bank));
  r = await req("POST", "/api/account/topups", { amountMinor: 1000, currency: "USD", idempotencyKey: key(), method: "bank" });
  ok("bank: send while not set up → 503 coming soon, nothing saved", r.status === 503 && r.data.error === "Bank transfer is coming soon.", JSON.stringify(r.data));
  r = await req("PUT", "/api/admin/bank-transfer", { ...empty, bankName: "Smoke Bank" }); ok("bank: half-filled details → 400", r.status === 400 && /together/.test(r.data.error), JSON.stringify(r.data));
  r = await req("PUT", "/api/admin/bank-transfer", { ...empty, bankName: "Smoke Bank", accountName: "CoreCart Co., Ltd.", accountNumber: "123-4-56789-0", swift: "bad" }); ok("bank: bad SWIFT → 400", r.status === 400 && /SWIFT/.test(r.data.error), JSON.stringify(r.data));
  r = await req("PUT", "/api/admin/bank-transfer", { ...empty, bankName: "Smoke Bank", accountName: "CoreCart Co., Ltd.", accountNumber: "1" }); ok("bank: account number too short → 400", r.status === 400 && /Account number/.test(r.data.error), JSON.stringify(r.data));
  const good = { bankName: "Smoke Bank", accountName: "CoreCart Co., Ltd.", accountNumber: "123-4-56789-0", swift: "smokthbk" };
  r = await req("PUT", "/api/admin/bank-transfer", good);
  ok("bank: save → saved values read back (SWIFT upper-cased) + audit row", r.status === 200 && r.data.settings.bankName === "Smoke Bank" && r.data.settings.swift === "SMOKTHBK" && r.data.settings.accountNumber === "123-4-56789-0"
    && r.data.history[0]?.detail.includes("Bank transfer turned on") && r.data.history[0].by === me.email, JSON.stringify(r.data).slice(0, 200));
  r = await req("GET", "/api/admin/bank-transfer"); ok("bank: GET after save = same values", r.data.settings.bankName === "Smoke Bank" && r.data.settings.accountName === "CoreCart Co., Ltd." && r.data.settings.swift === "SMOKTHBK", JSON.stringify(r.data.settings));
  r = await req("PUT", "/api/admin/bank-transfer", good); const h1 = (await req("GET", "/api/admin/bank-transfer")).data.history.length;
  ok("bank: saving the same values again → no new audit row", r.status === 200 && h1 === r.data.history.length, `${h1}`);
  r = await req("GET", "/api/account/topups"); const info = r.data.bank;
  const enabled = (await req("GET", "/api/currencies")).data.currencies.map((c) => c.code);
  ok("bank: customer sees details + own reference CC-XXXXXX + every enabled currency", info && info.bankName === "Smoke Bank" && /^CC-[A-HJ-NP-Z2-9]{6}$/.test(info.reference) && info.currencies.join() === enabled.join(), JSON.stringify(info).slice(0, 200));
  r = await req("GET", "/api/account/topups"); ok("bank: reference stays the same", r.data.bank?.reference === info.reference, r.data.bank?.reference);
  const bank = async (amountMinor, currency = "USD", idempotencyKey = key()) => req("POST", "/api/account/topups", { amountMinor, currency, idempotencyKey, method: "bank" });
  r = await bank(99); ok("bank: under $1 → 400", r.status === 400 && r.data.error === "The minimum top-up is $1.00.", JSON.stringify(r.data));
  r = await bank(10001); ok("bank: over $100 → 400", r.status === 400 && r.data.error === "The maximum top-up is $100.00.", JSON.stringify(r.data));
  r = await bank(1000, "XXX"); ok("bank: unknown / disabled currency → 400", r.status === 400 && r.data.error === "This currency is not available. Choose another currency.", JSON.stringify(r.data));
  const disabled = ["RUB", "BGN"].find((c) => !enabled.includes(c));
  if (disabled) { r = await bank(100000, disabled); ok(`bank: currency switched off in Admin → Currencies (${disabled}) → 400`, r.status === 400 && /not available/.test(r.data.error), JSON.stringify(r.data)); }
  const bk = key(); r = await bank(5000, "USD", bk); const b1 = r.data.topUp;
  ok("bank: send → pending BT- top-up, no payment start", r.status === 200 && b1?.method === "bank" && b1.status === "pending" && /^BT-\d{8}$/.test(b1.number) && r.data.payment === null && b1.provider === "bank", JSON.stringify(r.data).slice(0, 200));
  let s = await getTu(b1.id); ok("bank: really saved (amount, currency, 7-day wait, credit > 0)", s.amountMinor === 5000 && s.currency === "USD" && s.method === "bank" && Date.parse(s.expiresAt) - Date.parse(s.createdAt) === 7 * 86400000 && s.creditMinor > 0, JSON.stringify(s));
  r = await bank(5000, "USD", bk); ok("bank: same idempotency key → same top-up", r.data.topUp?.id === b1.id);
  ok("bank: wallet not credited by sending", (await wallet()).walletMinor === w0);
  r = await req("POST", "/api/account/topups/simulate", { id: b1.id, outcome: "paid" }); ok("bank: cannot be simulated / credited by the browser", r.status === 400 || r.status === 403, `${r.status} ${JSON.stringify(r.data)}`);
  if (cfg?.available) { const fake = JSON.stringify({ id: `smoke_evt_${crypto.randomUUID()}`, type: "payment.succeeded", topUpId: b1.id, providerRef: null, amountMinor: 5000, currency: "USD" }); r = await hook(fake, sign(fake));
    ok("bank: a provider webhook never credits a bank transfer", r.data?.result?.startsWith("rejected") && (await getTu(b1.id)).status === "pending", JSON.stringify(r.data)); }
  const nonCard = (await req("GET", "/api/currencies")).data.currencies.find((c) => !c.chargeable && c.decimals === 2);
  r = await bank(1000, nonCard?.code ?? "USD"); const b2 = r.data.topUp;
  ok(`bank: a currency card top-ups cannot charge (${nonCard?.code ?? "none found"}) works for a bank transfer`, r.status === 200 && b2?.currency === (nonCard?.code ?? "USD") && b2.creditMinor > 0, JSON.stringify(r.data).slice(0, 160));
  const b3 = (await bank(2000)).data.topUp;
  r = await bank(3000); ok("bank: 4th waiting transfer → 409", r.status === 409 && /3 bank transfers waiting/.test(r.data.error), JSON.stringify(r.data));
  if (cfg?.available) { r = await create(500); s = await getTu(b1.id); ok("bank: a new card top-up does not cancel waiting bank transfers", s.status === "pending", s.status); if (r.data.topUp) await req("PATCH", "/api/admin/topups", { id: r.data.topUp.id, action: "cancel", reason: "Smoke bank cleanup" }); }
  // Admin: search by reference, confirm (wrong amount, card top-up, right amount, twice), audit, email.
  r = await req("GET", `/api/admin/topups?q=${info.reference}`); ok("bank admin: search by CC- reference", r.data.data.topUps.some((t) => t.id === b1.id) && r.data.data.topUps.every((t) => t.customerRef === info.reference), JSON.stringify(r.data.data.total));
  r = await req("GET", `/api/admin/topups?provider=bank&status=pending`); ok("bank admin: provider bank + pending filter", r.data.data.topUps.some((t) => t.id === b1.id) && r.data.data.topUps.every((t) => t.method === "bank" && t.status === "pending"));
  r = await req("PATCH", "/api/admin/topups", { id: b1.id, action: "confirm", receivedMinor: 4999 }); ok("bank admin: wrong amount → 400, nothing credited", r.status === 400 && /must be \$50\.00 USD/.test(r.data.error) && (await getTu(b1.id)).status === "pending", JSON.stringify(r.data));
  r = await req("PATCH", "/api/admin/topups", { id: b1.id, action: "confirm", receivedMinor: "5000" }); ok("bank admin: amount as text → 400", r.status === 400);
  r = await req("PATCH", "/api/admin/topups", { id: b1.id, action: "confirm", receivedMinor: 5000, bankRef: "x".repeat(81) }); ok("bank admin: bank ref over 80 → 400", r.status === 400);
  const cardTu = (await req("GET", "/api/admin/topups?provider=dev")).data.data.topUps[0];
  if (cardTu) { r = await req("PATCH", "/api/admin/topups", { id: cardTu.id, action: "confirm", receivedMinor: cardTu.amountMinor }); ok("bank admin: card top-up cannot be confirmed by hand → 409", r.status === 409 && /Only bank transfers/.test(r.data.error), JSON.stringify(r.data)); }
  const both = await Promise.all([req("PATCH", "/api/admin/topups", { id: b1.id, action: "confirm", receivedMinor: 5000, bankRef: "SMOKE-REF-1" }), req("PATCH", "/api/admin/topups", { id: b1.id, action: "confirm", receivedMinor: 5000, bankRef: "SMOKE-REF-1" })]);
  ok("bank admin: two confirms at once → one 200, one 409", both.map((x) => x.status).sort().join() === "200,409", both.map((x) => x.status).join());
  s = (await req("GET", `/api/admin/topups?id=${b1.id}`)).data.topUp;
  ok("bank admin: saved credited + confirmedBy + bank ref + times", s.status === "credited" && s.confirmedBy === me.email && s.providerRef === "SMOKE-REF-1" && s.paidAt && s.creditedAt, JSON.stringify(s).slice(0, 240));
  let w = await wallet(); ok("bank: wallet + credit exactly once (balance + one ledger row)", w.walletMinor === w0 + b1.creditMinor && w.transactions.filter((t) => t.ref === b1.number).length === 1 && w.transactions.find((t) => t.ref === b1.number).type === "top_up", `${w.walletMinor} vs ${w0 + b1.creditMinor}`);
  r = await req("PATCH", "/api/admin/topups", { id: b1.id, action: "confirm", receivedMinor: 5000 }); ok("bank admin: confirm again → 409", r.status === 409);
  const det = (await req("GET", `/api/admin/user?id=${me.id}`)).data;
  ok("bank admin: audit row topup_confirmed", det.audit[0]?.action === "topup_confirmed" && det.audit[0].detail === `${b1.number} · $50.00 USD received · bank ref SMOKE-REF-1` && det.audit[0].by === me.email, JSON.stringify(det.audit[0]));
  const ob = (await req("GET", "/api/admin/emails?outbox=1")).data;
  const mails = ob?.outbox ?? ob?.emails ?? [];
  if (Array.isArray(mails) && mails.length) ok("bank: 'top-up complete' email sent", mails.some((m) => (m.subject ?? "").includes(b1.number)), JSON.stringify(mails.slice(0, 2)).slice(0, 200));
  else results.push("SKIP  bank: 'top-up complete' email check — the dev outbox is not readable by this account (master admin only) or empty; the email call is the same mailTopUp as card top-ups.");
  r = await req("PATCH", "/api/admin/topups", { id: b2.id, action: "cancel", reason: "Smoke bank cancel" }); ok("bank admin: cancel a waiting transfer with reason", r.status === 200 && r.data.topUp.status === "cancelled" && r.data.topUp.failureReason === "Smoke bank cancel");
  r = await req("PATCH", "/api/admin/topups", { id: b2.id, action: "confirm", receivedMinor: b2.amountMinor }); ok("bank admin: cancelled transfer cannot be confirmed → 409", r.status === 409);
  await req("PATCH", "/api/admin/topups", { id: b3.id, action: "cancel", reason: "Smoke bank cleanup" });
  // Put everything back: wallet (one reversing adjustment) + bank settings as they were.
  const extra = (await wallet()).walletMinor - w0;
  if (extra > 0) await req("POST", "/api/admin/balance", { userId: me.id, direction: "debit", bucket: "wallet", amountMinor: extra, reason: "Smoke: reverse bank transfer test" });
  ok("bank: wallet restored", (await wallet()).walletMinor === w0);
  r = await req("PUT", "/api/admin/bank-transfer", before.settings); ok("bank: settings restored", r.status === 200 && JSON.stringify(r.data.settings) === JSON.stringify(before.settings), JSON.stringify(r.data?.settings));
  results.push("SKIP  bank: 7-day expiry on the real server — waiting 7 days is not possible in a smoke run; the same expireStale rule as card top-ups (method-aware reason) runs on every read.");
}
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
  r = await create(99); ok("topups: under $1 → 400 (redesign limit)", r.status === 400 && r.data.error === "The minimum top-up is $1.00.", JSON.stringify(r.data));
  r = await create(10001); ok("topups: over $100 → 400 (redesign limit)", r.status === 400 && r.data.error === "The maximum top-up is $100.00.", JSON.stringify(r.data));
  r = await create(100); ok("topups: exactly $1 → allowed (pending)", r.status === 200 && r.data.topUp?.status === "pending" && r.data.topUp.method === "card" && /^TU-\d{8}$/.test(r.data.topUp.number), JSON.stringify(r.data).slice(0, 160));
  r = await create(500, key(), "XXX"); ok("topups: unknown currency → 400", r.status === 400 && r.data.error.includes("can't be charged"), JSON.stringify(r.data));
  r = await req("POST", "/api/account/topups", { amountMinor: 500, currency: "USD", idempotencyKey: "x" }); ok("topups: bad idempotency key → 400", r.status === 400);
  // Create + idempotency + one pending at a time
  const k1 = key(); r = await create(500, k1); const a = r.data.topUp;
  ok("topups: create → pending + simulate", r.status === 200 && a?.status === "pending" && r.data.payment?.kind === "simulate" && a.creditMinor > 0, `status ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  r = await create(500, k1); ok("topups: same idempotency key → same top-up", r.status === 200 && r.data.topUp?.id === a.id, JSON.stringify(r.data?.topUp?.number));
  let s = await getTu(a.id); ok("topups: pending really saved (amount, currency, method card, 30 min deadline)", s.amountMinor === 500 && s.currency === "USD" && s.provider === "dev" && s.method === "card" && Date.parse(s.expiresAt) - Date.parse(s.createdAt) === 1800000, JSON.stringify(s));
  r = await create(700); const c = r.data.topUp;
  s = await getTu(a.id); ok("topups: new top-up cancels the older pending one", s.status === "cancelled" && s.failureReason === "Replaced by a newer top-up.", JSON.stringify(s.status));
  // Webhook: bad signature, credit once, repeat, second event, parallel
  const raw = await event(c, "payment.succeeded");
  r = await hook(raw, "0".repeat(64)); ok("topups: webhook bad signature → 400", r.status === 400, `status ${r.status}`);
  ok("topups: bad signature changed nothing", (await getTu(c.id)).status === "pending" && (await wallet()).walletMinor === w0);
  r = await hook(raw, sign(raw)); ok("topups: webhook paid → credited", r.status === 200 && r.data.result === "credited", JSON.stringify(r.data));
  let w = await wallet(); const row = w.transactions[0];
  ok("topups: wallet +credit exactly once", w.walletMinor === w0 + c.creditMinor, `${w.walletMinor} vs ${w0 + c.creditMinor}`);
  ok("topups: ledger row really saved (type top_up, ref = number, amount)", row.type === "top_up" && row.ref === c.number && row.amountMinor === c.creditMinor && row.bucket === "wallet" && row.by === null, JSON.stringify(row));
  s = await getTu(c.id); ok("topups: top-up really saved as credited (paid + credited times)", s.status === "credited" && s.paidAt && s.creditedAt, JSON.stringify(s));
  r = await hook(raw, sign(raw)); ok("topups: same webhook again → duplicate", r.status === 200 && r.data.result === "duplicate", JSON.stringify(r.data));
  const raw2 = await event(c, "payment.succeeded"); r = await hook(raw2, sign(raw2)); ok("topups: new event, same top-up → already credited", r.status === 200 && r.data.result === "ignored: already credited", JSON.stringify(r.data));
  w = await wallet(); ok("topups: still credited once (balance + one ledger row)", w.walletMinor === w0 + c.creditMinor && w.transactions.filter((t) => t.ref === c.number).length === 1, `${w.walletMinor}`);
  r = await create(600); const d = r.data.topUp; const p1 = await event(d, "payment.succeeded"); const p2 = await event(d, "payment.succeeded");
  const both = await Promise.all([hook(p1, sign(p1)), hook(p2, sign(p2))]);
  ok("topups: two webhooks at once → credited once", both.map((x) => x.data?.result).sort().join() === "credited,ignored: already credited", both.map((x) => x.data?.result).join());
  w = await wallet(); ok("topups: parallel balance +credit once", w.walletMinor === w0 + c.creditMinor + d.creditMinor, `${w.walletMinor}`);
  // Failed + amount mismatch
  r = await create(800); const e = r.data.topUp; const f1 = await event(e, "payment.failed", { reason: "Card declined (smoke)." });
  r = await hook(f1, sign(f1)); s = await getTu(e.id); ok("topups: failed webhook → failed + reason saved", r.data?.result === "failed" && s.status === "failed" && s.failureReason === "Card declined (smoke)." && s.closedAt, JSON.stringify(s));
  r = await create(900); const f = r.data.topUp; const m1 = await event(f, "payment.succeeded", { amountMinor: 901 });
  r = await hook(m1, sign(m1)); ok("topups: amount mismatch → rejected (200, not retried), not credited", r.status === 200 && r.data?.result === "rejected: amount mismatch (901 ≠ 900 USD)" && (await getTu(f.id)).status === "pending", JSON.stringify(r.data));
  r = await hook(m1, sign(m1)); ok("R8 same refused event again → duplicate (a permanent refusal is not processed again)", r.data?.result === "duplicate", JSON.stringify(r.data));
  // R8: every refused event leaves the wallet, the ledger and the top-up alone; the admin detail gets a review note.
  const fRef = await refOf(f); const bad = async (name, obj, want, status = 200) => {
    const raw = JSON.stringify({ id: `smoke_evt_${crypto.randomUUID()}`, type: "payment.succeeded", topUpId: f.id, providerRef: fRef, amountMinor: f.amountMinor, currency: f.currency, ...obj });
    for (const k of Object.keys(obj)) if (obj[k] === undefined) { const o = JSON.parse(raw); delete o[k]; return check(name, JSON.stringify(o), want, status); }
    return check(name, raw, want, status);
  };
  // (Creating the "other" top-up below cancels f by the one-pending-at-a-time rule, so "no credit" = not credited, not "still pending".)
  const check = async (name, raw, want, status) => { const x = await hook(raw, sign(raw)); const t = await getTu(f.id); ok(`R8 ${name} → ${want}, no credit`, x.status === status && String(x.data?.result ?? x.data?.error).startsWith(want) && t.status !== "credited" && !t.creditedAt, `${x.status} ${JSON.stringify(x.data)} top-up ${t.status}`); };
  await bad("missing amount", { amountMinor: undefined }, "rejected: missing amount");
  await bad("missing currency", { currency: undefined }, "rejected: missing currency");
  await bad("amount as text", { amountMinor: "900" }, "rejected: invalid amount");
  await bad("amount 900.5", { amountMinor: 900.5 }, "rejected: invalid amount");
  await bad("amount 0", { amountMinor: 0 }, "rejected: invalid amount");
  await bad("amount negative", { amountMinor: -900 }, "rejected: invalid amount");
  await bad("amount above safe integer", { amountMinor: 2 ** 60 }, "rejected: invalid amount");
  await bad("wrong currency", { currency: "EUR" }, "rejected: currency mismatch");
  await bad("lower-case right currency is normalized, then amount must still match", { currency: "usd", amountMinor: 1 }, "rejected: amount mismatch");
  await bad("missing payment reference", { providerRef: undefined }, "rejected: missing payment reference");
  await bad("wrong payment reference", { providerRef: "dev_someone-else" }, "rejected: payment reference mismatch");
  const otherRes = await create(1000); if (!otherRes.data?.topUp) throw new Error(`topups: second top-up not created: ${otherRes.status} ${JSON.stringify(otherRes.data)}`);
  const other = otherRes.data.topUp; const otherRef = await refOf(other);
  await bad("top-up id + another top-up's reference", { providerRef: otherRef }, "rejected: top-up id and payment reference name different top-ups");
  ok("R8 conflicting event did not touch the other top-up either", (await getTu(other.id)).status === "pending");
  await bad("unknown top-up id", { topUpId: "no-such-top-up" }, "rejected: unknown top-up");
  await bad("authorized-only / pending event type", { type: "payment.authorized" }, "ignored: payment.authorized");
  let ghost = JSON.stringify({ id: `smoke_evt_${crypto.randomUUID()}`, type: "payment.succeeded", providerRef: "dev_not-saved-yet", amountMinor: 900, currency: "USD" });
  let gx = await hook(ghost, sign(ghost)); ok("R8 reference not known yet → 503 deferred (provider retries), nothing credited", gx.status === 503 && gx.data?.error?.startsWith("deferred"), JSON.stringify(gx));
  gx = await hook(ghost, sign(ghost)); ok("R8 retry of a deferred event is processed again (not skipped as duplicate)", gx.status === 503, JSON.stringify(gx));
  r = await hook(await event(f, "payment.succeeded"), "f".repeat(64)); ok("R8 invalid signature → 400, no credit", r.status === 400 && (await getTu(f.id)).status !== "credited");
  const fd = (await req("GET", `/api/admin/topups?id=${f.id}`)).data.topUp;
  ok("R8 admin review note saved on the top-up (reasons listed)", /amount mismatch/.test(fd.reviewNote ?? "") && /missing amount/.test(fd.reviewNote) && /payment reference mismatch/.test(fd.reviewNote), (fd.reviewNote ?? "").slice(0, 160));
  ok("R8 refused events are in the event log with their result", fd.events.some((x) => x.result.startsWith("rejected: currency mismatch")), JSON.stringify(fd.events.map((x) => x.result)).slice(0, 200));
  await req("PATCH", "/api/admin/topups", { id: other.id, action: "cancel", reason: "Smoke R8 cleanup" });
  w = await wallet(); ok("topups: failed + mismatch left the wallet alone", w.walletMinor === w0 + c.creditMinor + d.creditMinor, `${w.walletMinor}`);
  // Dev simulate endpoint (same webhook path)
  r = await req("POST", "/api/account/topups/simulate", { id: f.id, outcome: "paid" }); ok("topups: simulate paid (complete event with the saved reference) → credited", r.status === 200 && r.data.result === "credited" && r.data.topUp.status === "credited", JSON.stringify(r.data?.result));
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
  const lateEv = await event(g, "payment.succeeded"); r = await hook(lateEv, sign(lateEv)); const gl = await getTu(g.id);
  ok("R8 valid late payment after cancel → credited once (existing policy, full checks)", r.data?.result === "credited" && gl.status === "credited" && gl.failureReason === "Paid after it was cancelled.", JSON.stringify(gl));
  const lateEv2 = await event(g, "payment.succeeded"); r = await hook(lateEv2, sign(lateEv2)); ok("R8 second event id for the late payment → already credited", r.data?.result === "ignored: already credited");
  const gw = await wallet(); ok("R8 late payment: one ledger row", gw.transactions.filter((t) => t.ref === g.number).length === 1);
  r = await req("PATCH", "/api/admin/topups", { id: c.id, action: "cancel", reason: "no" }); ok("topups admin: cannot cancel a credited top-up", r.status === 409 && (await getTu(c.id)).status === "credited");
  const detail = (await req("GET", `/api/admin/user?id=${me.id}`)).data;
  ok("topups admin: audit row saved", detail.audit[0]?.action === "topup_cancelled" && detail.audit[0].detail === `${g.number} · Smoke cancel` && detail.audit[0].by === me.email, JSON.stringify(detail.audit[0]));
  ok("topups admin: user detail lists top-ups", detail.topUps.some((t) => t.id === c.id && t.status === "credited"));
  // Daily cap: fill up to under $1,000 left with real credits if needed, then ask for more than is left.
  const cur = (await req("GET", "/api/currencies")).data; const thbRate = Number(cur.base.rate);
  const leftUsd = async () => Math.floor((await req("GET", "/api/account/topups")).data.dailyLeftMinor / thbRate);
  let left = await leftUsd();
  // Top-up redesign: max $100 per top-up, so filling the $2,000 day takes up to 20 credited top-ups (create() waits out the 10 / 10 min limit).
  for (let i = 0; i < 25 && left > 10000; i++) { r = await create(10000); const big = r.data.topUp; if (!big) break; const b1 = await event(big, "payment.succeeded"); await hook(b1, sign(b1)); left = await leftUsd(); }
  r = await create(Math.max(100, Math.min(10000, left + 200)));
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
// Every admin section in lib/admin-perms.ts (12 since T3 added Seller applications).
const SECTIONS = (fs.readFileSync("lib/admin-perms.ts", "utf8").split("export const ALL_PERMS")[0].match(/{ id: "/g) ?? []).length;
r = await req("GET", "/api/admin/me"); ok(`admins: smoke admin is master with every section (${SECTIONS})`, r.data?.master === true && r.data.perms?.length === SECTIONS, JSON.stringify(r.data) + (r.data?.master ? "" : " (run npm run admin:create -- --email <smoke admin> --master)"));
const list = async () => (await req("GET", "/api/admin/admins")).data;
let L = await list(); const meId = (await req("GET", "/api/auth/get-session?disableCookieCache=true")).data.user.id;
ok("admins: list has me as master_admin", L?.admins?.some((a) => a.id === meId && a.role === "master_admin" && a.perms.length === SECTIONS), JSON.stringify(L?.admins?.map((a) => a.email + ":" + a.role)));
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
  for (const n of ["plain admin: /me sections", "plain admin: section it has → 200", "plain admin: 9 other sections → 403", "plain admin: add admin → 403", "plain admin: admins page → 403", "plain admin: promote to admin → 403", "plain admin: overview hides users + balance owed", "N2 plain admin: dev outbox withheld"]) skip(`admins: ${n}`, "no helper admin login (SMOKE_HELPER_EMAIL / helper_email=, see file header)");
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
  r = await req("GET", "/api/admin/emails"); ok("N2 plain admin: email previews open, dev outbox withheld (null)", r.status === 200 && r.data.outbox === null, JSON.stringify(r.data).slice(0, 80));
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
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
r = await up("invoice", "fake.png", Buffer.from("not an image at all"), "image/png"); ok("sellers: text named .png → 400 (type by content)", r.status === 400 && r.data.error === "Use a JPEG, PNG, GIF or PDF file.", JSON.stringify(r.data));
r = await up("selfie", "selfie.gif", GIF, "image/gif"); ok("sellers: GIF selfie → 400 (selfie JPEG / PNG / PDF only)", r.status === 400 && r.data.error === "Use a JPEG, PNG or PDF file.", JSON.stringify(r.data));
r = await up("key", "keys.png", PNG, "image/png"); ok("sellers: older kind 'key' no longer asked → 400", r.status === 400, JSON.stringify(r.data));
r = await up("invoice", "big.pdf", Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]), "application/pdf"); ok("sellers: over 10 MB → 413", r.status === 413, `status ${r.status}`);
// R6: chunked uploads WITHOUT Content-Length. Big → 413 once the byte cap is passed (the server stops reading); small → parsed normally.
const upChunked = async (kind, name, bytes, type) => {
  const form = new FormData(); form.append("kind", kind); form.append("file", new Blob([bytes], { type }), name);
  const enc = new Response(form); const ct = enc.headers.get("content-type"); const all = new Uint8Array(await enc.arrayBuffer());
  let at = 0; const stream = new ReadableStream({ pull(c) { if (at >= all.length) { c.close(); return; } c.enqueue(all.subarray(at, at + 64 * 1024)); at += 64 * 1024; } });
  const res = await fetch(B + "/api/sell/files", { method: "POST", headers: { Origin: B, Cookie: cookie, "x-forwarded-for": ip, "Content-Type": ct }, body: stream, duplex: "half" });
  return { status: res.status, data: await res.json().catch(() => null), sentAll: at >= all.length };
};
r = await upChunked("invoice", "huge.pdf", Buffer.concat([PDF, Buffer.alloc(12 * 1024 * 1024)]), "application/pdf");
ok("R6 12 MB upload with NO Content-Length → 413 (stopped at the cap)", r.status === 413 && r.data?.error === "Files can be 10 MB at most.", `status ${r.status} ${JSON.stringify(r.data)}`);
r = await upChunked("invoice", "small.pdf", PDF, "application/pdf");
ok("R6 small upload with NO Content-Length → 200 (parsed after the capped read)", r.status === 200 && r.data?.file?.size === PDF.length, `status ${r.status} ${JSON.stringify(r.data)}`);
async function uploads(list) {
  const out = {};
  for (const [kind, name, bytes, type] of list) { r = await up(kind, name, bytes, type); (out[kind] ??= []).push(r.data?.file?.id); ok(`sellers: upload ${kind} ${name} → 200 (type from content)`, r.status === 200 && r.data.file.mime === type && r.data.file.size === bytes.length, JSON.stringify(r.data)); }
  return out;
}
const files = await uploads([["invoice", "inv.gif", GIF, "image/gif"], ["id_front", "front.png", PNG, "image/png"], ["id_back", "back.png", PNG, "image/png"], ["selfie", "selfie.pdf", PDF, "application/pdf"]]);
const noFiles = { id_front: [], id_back: [], selfie: [], invoice: [], certificate: [], doc_gov_id: [], doc_registration: [], doc_address: [], doc_tax: [], doc_supply: [], doc_ubo: [], doc_articles: [] };
const fileList = { ...noFiles, ...files };
const base = { sellerType: "individual", firstName: "Smoke", lastName: "Seller", citizenship: "TH", storeUrl: "", heardFrom: "Other", merchantName: `Smoke Shop ${stamp}`, businessCountry: "TH",
  offers: { video: ["Game keys"], online: [], other: ["Direct top up"] }, idType: "national_id", idNumber: idNum,
  purchaseSource: "suppliers", procurement: "Smoke test: licensed distributor, monthly B2B orders.", stockRange: "10–50", otherPlatforms: "no", profiles: "", confirm: true, terms: true };
// Draft: step order, step check, completed + progress, document number encrypted (back only to the owner), Delete keeps files.
r = await req("PUT", "/api/sell", { input: { ...base, files: fileList }, step: "proofs" }); ok("draft: Continue on step 2 before step 1 → 409", r.status === 409 && r.data.error === "Finish the earlier steps first.", JSON.stringify(r.data));
r = await req("PUT", "/api/sell", { input: { ...base, merchantName: "x", files: fileList }, step: "basic" }); ok("draft: bad step → 400 with field errors", r.status === 400 && r.data.errors?.merchantName, JSON.stringify(r.data));
r = await req("PUT", "/api/sell", { input: { ...base, files: { ...fileList, id_front: ["not-my-file-id-123"] } }, step: "basic" });
ok("draft: basic saved → completed [basic], 33%, foreign file id dropped", r.status === 200 && r.data.draft.completed.join() === "basic" && r.data.draft.progress.percent === 33 && r.data.draft.progress.next === "proofs" && r.data.draft.input.files.id_front.length === 0, JSON.stringify(r.data?.draft?.progress));
r = await req("GET", "/api/sell"); ok("draft: GET returns it with the document number + files (owner only)", r.data.draft?.input.idNumber === idNum && r.data.draft.files.length === 3 && (r.data.application === null || r.data.application.status === "rejected"), JSON.stringify({ n: r.data.draft?.input.idNumber, f: r.data.draft?.files.length, app: r.data.application?.status ?? null })); // rejected = left by an earlier run
r = await req("DELETE", "/api/sell"); ok("draft: Delete → 200", r.status === 200);
r = await req("GET", "/api/sell"); ok("draft: after Delete → no draft", r.data.draft === null);
r = await req("DELETE", "/api/sell"); ok("draft: Delete again → 404", r.status === 404);
for (const s of ["basic", "proofs", "product"]) { r = await req("PUT", "/api/sell", { input: { ...base, files: fileList }, step: s }); }
ok("draft: all 3 steps completed, 100%", r.status === 200 && r.data.draft.completed.length === 3 && r.data.draft.progress.percent === 100, JSON.stringify(r.data?.draft?.progress));
r = await req("POST", "/api/sell", { ...base, terms: false, files: fileList }); ok("sellers: send without terms tick → 400", r.status === 400 && r.data.errors?.terms === "Agree to the terms and conditions.", JSON.stringify(r.data));
r = await req("POST", "/api/sell", { ...base, files: { ...fileList, id_front: ["not-my-file-id-123"] } }); ok("sellers: someone else's / unknown file → 400", r.status === 400 && r.data.error === "One of the files is missing. Upload it again.", JSON.stringify(r.data));
r = await req("POST", "/api/sell", { ...base, files: fileList }); const A = r.data?.application;
ok("sellers: submit → pending SA-number (files kept after the draft Delete)", r.status === 200 && /^SA-1\d{5}$/.test(A?.number) && A.status === "pending" && A.sellerType === "individual", JSON.stringify(r.data));
r = await req("POST", "/api/sell", { ...base, files: fileList }); ok("sellers: second submit while pending → 409", r.status === 409 && r.data.error === "You already have an application under review.", JSON.stringify(r.data));
r = await req("GET", "/api/sell"); ok("sellers: GET = my application, draft marked sent (null)", r.data?.application?.id === A?.id && r.data.application.status === "pending" && r.data.draft === null);
r = await req("PUT", "/api/sell", { input: { ...base, files: fileList }, step: "basic" }); ok("draft: saving while pending → 409", r.status === 409);
r = await req("GET", "/api/sell?details=1"); const MD = r.data?.details;
ok("sellers: own details (answers v2, terms version + time, last 4 only, file names)", MD?.answers?.v === 2 && MD.answers.procurement === base.procurement && MD.termsVersion === TERMS && !!MD.termsAcceptedAt && MD.idLast4 === idNum.slice(-4) && !JSON.stringify(MD).includes(idNum) && MD.files.length === 4, JSON.stringify(MD).slice(0, 200));
r = await req("GET", `/api/admin/sellers?tab=pending&q=${A?.number}`); ok("sellers: admin Pending tab lists it (type, 4 files, no freeze)", r.status === 200 && r.data.rows.some((x) => x.id === A?.id && x.sellerType === "individual" && x.fileCount === 4 && x.freeze === 0), JSON.stringify(r.data?.rows?.[0]));
r = await req("GET", `/api/admin/sellers?id=${A?.id}`); const D = r.data?.seller;
ok("sellers: detail really saved (answers, offers, ID number decrypted, terms, 4 files, submitted event)", D?.merchantName === base.merchantName && D.answers.firstName === "Smoke" && D.answers.offers.other.includes("Direct top up") && D.idNumber === idNum && D.termsVersion === TERMS && D.files.length === 4 && D.events.some((e) => e.action === "submitted"), JSON.stringify({ id: D?.idNumber, files: D?.files?.length, t: D?.termsVersion }));
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
// Same ID number again (new merchant name, passport: no back side) → flagged as returning person with the blacklisted record.
const files2 = await uploads([["invoice", "inv2.pdf", PDF, "application/pdf"], ["id_front", "f2.png", PNG, "image/png"], ["selfie", "s2.png", PNG, "image/png"]]);
r = await req("POST", "/api/sell", { ...base, idType: "passport", merchantName: `Smoke Two ${stamp}`, files: { ...noFiles, ...files2 } }); const A2 = r.data?.application;
ok("sellers: new application while the old one is blacklisted → 200", r.status === 200 && A2?.status === "pending", JSON.stringify(r.data));
r = await req("GET", `/api/admin/sellers?id=${A2?.id}`); ok("sellers: returning person flagged (same KYC ID number, blacklisted, link)", r.data.seller.matchList.some((m) => m.kind === "id_number" && m.what === "blacklisted" && m.applicationId === A?.id), JSON.stringify(r.data.seller.matchList));
r = await req("GET", `/api/admin/sellers?tab=pending&q=${A2?.number}`); ok("sellers: list shows the match count", r.data.rows[0]?.matches >= 1, JSON.stringify(r.data.rows[0]));
r = await req("PATCH", "/api/admin/sellers", { id: A2?.id, action: "reject", reason: "Smoke reject" }); r = await req("GET", "/api/sell"); ok("sellers: reject reason reaches the applicant", r.data.application.status === "rejected" && r.data.application.reason === "Smoke reject");
r = await req("PATCH", "/api/admin/sellers", { id: A?.id, action: "unblacklist", reason: "Smoke cleanup" }); r = await req("GET", `/api/admin/sellers?id=${A?.id}`);
ok("sellers: remove from blacklist → Rejected (an approved seller never comes back silently)", r.data.seller.status === "rejected" && r.data.seller.events[0].action === "unblacklist");
// Business: 5 steps, 7 supporting documents (tax skipped), representative + UBO, supplier proof = invoice only → 10-day freeze.
const bFiles = await uploads([["certificate", "cert.pdf", PDF, "application/pdf"], ["doc_gov_id", "gov.png", PNG, "image/png"], ["doc_registration", "reg.pdf", PDF, "application/pdf"], ["doc_address", "addr.pdf", PDF, "application/pdf"],
  ["doc_supply", "supply.pdf", PDF, "application/pdf"], ["doc_ubo", "ubo.pdf", PDF, "application/pdf"], ["doc_articles", "articles.pdf", PDF, "application/pdf"], ["id_front", "pass.png", PNG, "image/png"], ["selfie", "bself.png", PNG, "image/png"], ["supplier_proof", "inv-sep.gif", GIF, "image/gif"]]);
const repEmail = `smoke.rep.${stamp}@corecart.test`;
const biz = { sellerType: "business", merchantName: `Smoke Biz ${stamp}`, businessCountry: "TH", companyName: `Smoke Biz ${stamp} Co., Ltd.`, companyReg: "0105566012345", companyRegPlace: "Bangkok · Co., Ltd.", companyTax: "", address1: "12 Sukhumvit Rd", address2: "", state: "", postalCode: "10110", city: "Bangkok",
  rep: { fullName: "Smoke Rep", dob: "1996-10-05", email: repEmail, phoneCountry: "TH", phone: "812345678", basis: "CEO", citizenship: "TH" }, ceoSame: true, ceo: {}, ubos: [{ fullName: "Smoke Rep", dob: "1996-10-05", country: "TH", address: "12 Sukhumvit Rd", city: "Bangkok", zip: "10110" }],
  idType: "passport", idNumber: `BZ${Date.now().toString().slice(-8)}`, offers: { video: ["Game keys"], online: [], other: [] },
  suppliers: [{ name: "Supplier X", companyType: "Publisher", companyName: "Supplier X GmbH", companyNumber: "", country: "DE", address: "Alexanderplatz 1", city: "Berlin", zip: "10115", productTypes: ["Games", "DLCs"], proofType: "invoice", files: bFiles.supplier_proof }],
  products: ["Steam keys"], quantity: "20–100", api: "no", links: [], confirm: true, terms: true,
  files: { ...noFiles, certificate: bFiles.certificate, doc_gov_id: bFiles.doc_gov_id, doc_registration: bFiles.doc_registration, doc_address: bFiles.doc_address, doc_supply: bFiles.doc_supply, doc_ubo: bFiles.doc_ubo, doc_articles: bFiles.doc_articles, id_front: bFiles.id_front, selfie: bFiles.selfie } };
const regionReq = (await req("PUT", "/api/sell", { input: biz, step: "basic" })).data?.errors?.state; if (regionReq) biz.state = "Bangkok";
for (const s of ["basic", "documents", "representative", "trade", "offers"]) { r = await req("PUT", "/api/sell", { input: biz, step: s }); if (r.status !== 200) break; }
ok("business draft: 5 steps completed", r.status === 200 && r.data.draft.completed.length === 5, JSON.stringify(r.data?.errors ?? r.data?.draft?.progress));
r = await req("POST", "/api/sell", { ...biz, rep: { ...biz.rep, dob: "2015-01-01" } }); ok("business: representative under 18 → 400", r.status === 400 && r.data.errors?.["rep.dob"] === "Must be 18 or older.", JSON.stringify(r.data?.errors));
r = await req("POST", "/api/sell", biz); const BZ = r.data?.application;
ok("business: submit → pending", r.status === 200 && BZ?.sellerType === "business", JSON.stringify(r.data));
r = await req("GET", `/api/admin/sellers?id=${BZ?.id}`); const BD = r.data?.seller;
ok("business: saved answers (company, rep, UBO, supplier + file id), 10 files, freeze 10, terms", BD?.answers?.companyName === biz.companyName && BD.answers.rep.email === repEmail && BD.answers.ubos.length === 1 && BD.answers.suppliers[0].files[0] === bFiles.supplier_proof[0] && BD.files.length === 10 && BD.freeze === 10 && BD.termsVersion === TERMS && BD.name === biz.companyName,
  JSON.stringify({ f: BD?.files?.length, fr: BD?.freeze, n: BD?.name }));
const outbox = (await req("GET", "/api/admin/emails")).data?.outbox ?? [];
ok("business: received email also to the representative", outbox.some((m) => m.to === repEmail && m.template === "sellerReceived"), outbox.slice(0, 3).map((m) => `${m.to} ${m.template}`).join(" | "));
// Sales freeze timer: Approve starts the hold (approved + 10 days, or SELLER_FREEZE_SECONDS on a test server), Release now ends it early.
r = await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "approve" }); r = await req("GET", `/api/admin/sellers?id=${BZ?.id}`); const H = r.data?.seller?.hold;
const holdMs = H ? Date.parse(H.until) - Date.parse(r.data.seller.decidedAt) : 0; const freezeSec = Number(process.env.SMOKE_FREEZE_SECONDS || 0);
ok("freeze: approve saved the hold (until = approved + 10 days, or the test length)", !!H && !H.releasedAt && (freezeSec ? Math.abs(holdMs - freezeSec * 1000) < 5000 : Math.abs(holdMs - 10 * 86400_000) < 5000) && r.data.seller.events.some((e) => e.action === "freeze_started"), JSON.stringify(H));
let ob = (await req("GET", "/api/admin/emails")).data?.outbox ?? [];
ok("freeze: approved email tells the seller the hold date", ob.some((m) => m.to === cred.email && m.template === "sellerApproved" && /on hold until/.test(m.html)), ob.slice(0, 3).map((m) => m.template).join(" | "));
r = await req("GET", `/api/admin/sellers?tab=on_hold&q=${BZ?.number}`); ok("freeze: On hold tab lists it", r.data?.rows?.some((x) => x.id === BZ?.id) && r.data.counts.on_hold >= 1, JSON.stringify(r.data?.counts));
r = await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "release", reason: "" }); ok("freeze: Release now without reason → 400", r.status === 400);
r = await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "release", reason: "Smoke: documents complete" }); ok("freeze: Release now → 200", r.status === 200, JSON.stringify(r.data));
r = await req("GET", `/api/admin/sellers?id=${BZ?.id}`); const H2 = r.data?.seller?.hold;
ok("freeze: released early saved (time + by me), history row with reason", !!H2?.releasedAt && !!H2.releasedBy && r.data.seller.events[0]?.action === "release" && r.data.seller.events[0].detail === "Smoke: documents complete", JSON.stringify(H2));
r = await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "release", reason: "again" }); ok("freeze: release twice → 409", r.status === 409);
ob = (await req("GET", "/api/admin/emails")).data?.outbox ?? [];
ok("freeze: seller got 'sales open' (early)", ob.some((m) => m.to === cred.email && m.template === "sellerSalesOpen"), ob.slice(0, 3).map((m) => m.template).join(" | "));
r = await req("GET", "/api/admin/sellers?notices=1"); ok("freeze: early release makes no Overview notice", r.status === 200 && !r.data.notices.some((n) => n.id === BZ?.id), JSON.stringify(r.data));
// Automatic release needs a short hold: start the server with SELLER_FREEZE_SECONDS=20 and run this with SMOKE_FREEZE_SECONDS=20.
if (!freezeSec) skip("freeze: automatic release after the hold time (history 'System', admin notice + email, seller email, once)", "needs a short test hold: start the server with SELLER_FREEZE_SECONDS=20 and run with SMOKE_FREEZE_SECONDS=20 (10 days otherwise)");
else {
  await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "blacklist", reason: "Smoke freeze cleanup" }); await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "unblacklist", reason: "Smoke freeze cleanup" });
  const f3 = await uploads([["certificate", "c3.pdf", PDF, "application/pdf"], ["doc_gov_id", "g3.png", PNG, "image/png"], ["doc_registration", "r3.pdf", PDF, "application/pdf"], ["doc_address", "a3.pdf", PDF, "application/pdf"], ["doc_supply", "s3.pdf", PDF, "application/pdf"], ["doc_ubo", "u3.pdf", PDF, "application/pdf"], ["doc_articles", "ar3.pdf", PDF, "application/pdf"], ["id_front", "p3.png", PNG, "image/png"], ["selfie", "sf3.png", PNG, "image/png"], ["supplier_proof", "i3.gif", GIF, "image/gif"]]);
  const biz3 = { ...biz, merchantName: `Smoke Timer ${stamp}`, idNumber: `TM${Date.now().toString().slice(-8)}`, suppliers: [{ ...biz.suppliers[0], files: f3.supplier_proof }],
    files: { ...noFiles, ...Object.fromEntries(Object.entries(f3).filter(([k]) => k !== "supplier_proof")) } };
  r = await req("POST", "/api/sell", biz3); const T3 = r.data?.application; await req("PATCH", "/api/admin/sellers", { id: T3?.id, action: "approve" });
  await new Promise((res) => setTimeout(res, (freezeSec + 35) * 1000)); // hold + the 30 s read throttle
  r = await req("GET", `/api/admin/sellers?id=${T3?.id}`); const H3 = r.data?.seller?.hold;
  ok("freeze: released automatically (by System), one history row", !!H3?.releasedAt && H3.releasedBy === null && r.data.seller.events.filter((e) => e.action === "freeze_released" && e.by === null).length === 1, JSON.stringify(H3));
  r = await req("GET", "/api/admin/sellers?notices=1"); const N = r.data?.notices?.find((n) => n.id === T3?.id); ok("freeze: Overview notice listed", !!N, JSON.stringify(r.data));
  ob = (await req("GET", "/api/admin/emails")).data?.outbox ?? [];
  ok("freeze: admin email 'Sales freeze ended' + seller 'sales open'", ob.some((m) => m.template === "adminFreezeEnded" && m.subject.includes(biz3.merchantName)) && ob.some((m) => m.template === "sellerSalesOpen" && m.to === cred.email), ob.slice(0, 4).map((m) => m.template).join(" | "));
  r = await req("PATCH", "/api/admin/sellers", { id: T3?.id, dismissNotice: true }); r = await req("GET", "/api/admin/sellers?notices=1"); ok("freeze: Dismiss hides the notice", !r.data.notices.some((n) => n.id === T3?.id));
  await req("PATCH", "/api/admin/sellers", { id: T3?.id, action: "blacklist", reason: "Smoke freeze cleanup" }); await req("PATCH", "/api/admin/sellers", { id: T3?.id, action: "unblacklist", reason: "Smoke freeze cleanup" });
}
if (!freezeSec) { await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "blacklist", reason: "Smoke freeze cleanup" }); await req("PATCH", "/api/admin/sellers", { id: BZ?.id, action: "unblacklist", reason: "Smoke freeze cleanup" }); }
// Rejected seller: the rejection email's support link opens the "Account verification" ticket subject.
ob = (await req("GET", "/api/admin/emails")).data?.outbox ?? [];
ok("rejection email links to the Account verification ticket", ob.some((m) => m.template === "sellerRejected" && m.html.includes("subject=account_verification")), "");
// R3: two different people send the same merchant name at the same moment → exactly one open application (unique index).
const helperS = process.env.SMOKE_HELPER_EMAIL ? { email: process.env.SMOKE_HELPER_EMAIL, password: process.env.SMOKE_HELPER_PASSWORD } : { email: cred.helper_email, password: cred.helper_password };
if (!helperS.email) skip("R3 same merchant name from two people at once", "no helper admin login (SMOKE_HELPER_EMAIL / helper_email=, see file header)");
else {
  const adminS = cookie; cookie = ""; await req("POST", "/api/auth/sign-in/email", helperS); const helperJar = cookie;
  const filesFor = async () => ({ ...noFiles, ...(await uploads([["invoice", "r3.pdf", PDF, "application/pdf"], ["id_front", "r3f.png", PNG, "image/png"], ["selfie", "r3s.png", PNG, "image/png"]])) });
  const hFiles = await filesFor(); cookie = adminS; const aFiles = await filesFor();
  const name = `Smoke Race ${stamp}`; const body = (files, n) => ({ ...base, idType: "passport", merchantName: name, idNumber: `R3${n}${Date.now().toString().slice(-7)}`, files });
  const send = (jar, files, n) => fetch(B + "/api/sell", { method: "POST", headers: { "Content-Type": "application/json", Origin: B, Cookie: jar, "x-forwarded-for": ip }, body: JSON.stringify(body(files, n)) }).then(async (x) => ({ status: x.status, data: await x.json().catch(() => null) }));
  const pair = await Promise.all([send(helperJar, hFiles, 1), send(adminS, aFiles, 2)]);
  ok("R3 same merchant name, two people, same moment → one 200, one 409", pair.filter((x) => x.status === 200).length === 1 && pair.filter((x) => x.status === 409).length === 1 && pair.find((x) => x.status === 409)?.data?.error === "This merchant name is taken. Choose another.", pair.map((x) => `${x.status} ${x.data?.error ?? ""}`).join(" | "));
  r = await req("GET", `/api/admin/sellers?tab=pending&q=${encodeURIComponent(name.toLowerCase())}`); ok("R3 only one open application saved with that name", r.data.rows?.length === 1, JSON.stringify(r.data.rows?.map((x) => x.number)));
  for (const row of r.data.rows ?? []) await req("PATCH", "/api/admin/sellers", { id: row.id, action: "reject", reason: "Smoke R3 cleanup" });
}
// Close account (admin) on an admin-made customer; a new sign-up with that email frees it and is flagged.
const cEmail = `smoke.close.${stamp}@corecart.test`; r = await req("POST", "/api/admin/users", { name: "Smoke Close", email: cEmail, role: "customer" }); const cId = r.data?.id;
r = await req("PATCH", "/api/admin/user", { id: cId, close: "" }); ok("close: no reason → 400", r.status === 400);
r = await req("PATCH", "/api/admin/user", { id: cId, close: "Smoke close" }); r = await req("GET", `/api/admin/user?id=${cId}`);
ok("close: closed status, reason, audit really saved", r.data.user.status === "closed" && r.data.user.closedReason === "Smoke close" && r.data.user.closedEmail === cEmail && r.data.audit[0]?.action === "closed", JSON.stringify(r.data.user));
r = await req("GET", `/api/admin/users?status=closed&q=${encodeURIComponent(cEmail)}`); ok("close: Closed tab lists it", r.data.users?.length === 1 && r.data.users[0].status === "closed");
r = await req("GET", `/api/admin/users?status=active&q=${encodeURIComponent(cEmail)}`); ok("close: not in the Active tab", r.data.users?.length === 0);
r = await req("PATCH", "/api/admin/user", { id: meIdOf(), close: "self" }).catch(() => ({ status: 0 })); ok("close: own account → 400", r.status === 400);
// R1: a sign-up with the closed email never changes the closed account; only a VERIFIED claim moves the address (one transaction).
const adminC = cookie; const ipK = ip; ip = `10.5.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const anon = async (method, url, body) => { cookie = ""; const x = await req(method, url, body); const jar = cookie; cookie = adminC; return { ...x, jar }; };
const heldBy = async () => (await req("GET", `/api/admin/user?id=${cId}`)).data.user;
const codeFor = async (to) => { await new Promise((res) => setTimeout(res, 500)); const o = await req("GET", "/api/admin/emails"); const m = (o.data?.outbox ?? []).find((x) => x.to === to && x.template === "verify"); return { code: m?.subject.match(/^(\d{6}) /)?.[1] ?? null, redacted: Boolean(m?.redacted), resend: Boolean(o.data?.resend) }; };
r = await anon("POST", "/api/auth/sign-up/email", { name: "Smoke Back", email: cEmail, password: "x", termsVersion: TERMS });
ok("R1 failed sign-up (short password) with the closed email → 400", r.status === 400, `status ${r.status}`);
ok("R1 failed sign-up did NOT change the closed account's email", (await heldBy()).email === cEmail);
r = await anon("POST", "/api/auth/sign-up/email", { name: "Smoke Back", email: cEmail, password: "smoke-password-2026", termsVersion: TERMS });
ok("R1 sign-up with the closed email → 200 (generic)", r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
ok("R1 unverified sign-up did NOT change the closed account's email", (await heldBy()).email === cEmail);
const c1 = await codeFor(cEmail);
let claimed = false;
if (c1.resend || c1.redacted || !c1.code) skip("R1 claim verify steps", c1.resend ? "RESEND_API_KEY is set (dev outbox empty)" : "dev outbox hides auth codes: set DEV_OUTBOX_SECRETS=1 in .env.local on a private machine, restart, run again");
else {
  ok("R1 verification code went to the real address", !!c1.code);
  r = await req("PATCH", "/api/admin/user", { id: cId, reopen: "Smoke reopen while a claim waits" }); const ro = await heldBy();
  ok("R1 admin reopen with an unverified claim waiting → 200, email back", r.status === 200 && ro.status === "active" && ro.email === cEmail, JSON.stringify(ro));
  r = await anon("POST", "/api/verify-code", { email: cEmail, code: c1.code });
  ok("R1 claim after reopen → refused, nothing moves, no session", r.status === 400 && (await heldBy()).email === cEmail && !r.jar.includes("session_token"), JSON.stringify(r.data));
  await req("PATCH", "/api/admin/user", { id: cId, close: "Smoke close again" });
  r = await anon("POST", "/api/auth/sign-up/email", { name: "Smoke Back", email: cEmail, password: "smoke-password-2026", termsVersion: TERMS });
  const c2 = await codeFor(cEmail);
  r = await anon("POST", "/api/verify-code", { email: cEmail, code: c2.code });
  ok("R1 verified claim → 200 + session", r.status === 200 && r.jar.includes("session_token"), JSON.stringify(r.data));
  claimed = r.status === 200;
}
cookie = adminC; ip = ipK;
r = await req("GET", `/api/admin/users?status=active&q=${encodeURIComponent(cEmail)}`); const nu = r.data.users?.[0];
ok("close: new account flagged as returning person", nu && nu.id !== cId && nu.returning === true, JSON.stringify(nu));
r = await req("GET", `/api/admin/user?id=${nu?.id}`); ok("close: new account links to the closed record", r.data.matches?.some((m) => m.what === "closed_account" && m.userId === cId), JSON.stringify(r.data.matches));
r = await req("GET", `/api/admin/user?id=${cId}`); ok("close: closed record kept, email moved only after verification, closed_email kept, audited", r.data.user.status === "closed" && r.data.user.email !== cEmail && r.data.user.closedEmail === cEmail && r.data.audit.some((a) => a.action === "email_claimed"), r.data.user.email);
r = await req("PATCH", "/api/admin/user", { id: cId, reopen: "Smoke reopen" }); ok("close: reopen while the email is taken → 409", r.status === 409, JSON.stringify(r.data));
// Task list row 30: a closed account never gets a session (same session hook blocks Google, reset and verification links; Google itself needs real OAuth).
if (!claimed) skip("close: closed account cannot sign in", "needs the verified claim above (DEV_OUTBOX_SECRETS=1 in .env.local)");
else {
  r = await req("PATCH", "/api/admin/user", { id: nu.id, close: "Smoke sign-in block" }); ok("close: close the new (verified) account → 200", r.status === 200, JSON.stringify(r.data));
  r = await anon("POST", "/api/auth/sign-in/email", { email: cEmail, password: "smoke-password-2026" });
  ok("close: closed account, right password → refused, no session, closed message", r.status === 403 && !r.jar.includes("session_token") && r.data?.message === "This account is closed. Contact support to reopen it.", `status ${r.status} ${JSON.stringify(r.data)}`);
  r = await req("GET", `/api/admin/user?id=${nu.id}`); ok("close: refused sign-in left the account closed + data kept", r.data.user.status === "closed" && r.data.user.closedReason === "Smoke sign-in block" && r.data.user.email === cEmail, JSON.stringify(r.data.user));
}
const hEmail2 = `smoke.reopen.${stamp}@corecart.test`; r = await req("POST", "/api/admin/users", { name: "Smoke Reopen", email: hEmail2, role: "customer" }); const rId = r.data?.id;
await req("PATCH", "/api/admin/user", { id: rId, close: "Smoke close 2" }); r = await req("PATCH", "/api/admin/user", { id: rId, reopen: "Smoke reopen" }); const rr = await req("GET", `/api/admin/user?id=${rId}`);
ok("close: reopen → active again, email back, audited", r.status === 200 && rr.data.user.status === "active" && rr.data.user.email === hEmail2 && rr.data.audit[0]?.action === "reopened", JSON.stringify(rr.data.user));
r = await req("POST", "/api/account/close", { word: "close", password: "x" }); ok("close: own close needs the word CLOSE → 400", r.status === 400 && r.data.error === "Type CLOSE to confirm.");
r = await req("POST", "/api/account/close", { word: "CLOSE", password: "wrong-password" }); ok("close: wrong password → 400 (admin stays open)", r.status === 400 && r.data.error === "Wrong password.", JSON.stringify(r.data));
} // end of sellers

if (!only || only === "popup") {
// Purchase popup (2026-09-30): admin settings saved + audited, public feed rules (paid orders of active buyer accounts, account country,
// 24 h, hidden products, off switch), privacy (no name / email / order number). Buyer steps need DEV_OUTBOX_SECRETS=1 (verify code).
// The public feed is cached 10 s (an admin save clears it at once), so steps that change orders / accounts wait 10.5 s.
const adminJar = cookie; const ip0 = ip; const stamp = Date.now().toString(36); const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const feed = async () => { const keep = cookie; cookie = ""; const f = await req("GET", "/api/recent-purchases"); cookie = keep; return f; };
r = await req("GET", "/api/admin/purchase-popup");
ok("popup: admin settings → 200 (settings + history)", r.status === 200 && typeof r.data.settings?.enabled === "boolean" && Array.isArray(r.data.settings.hidden) && Array.isArray(r.data.history), JSON.stringify(r.data).slice(0, 160));
const before = r.data.settings;
r = await req("PUT", "/api/admin/purchase-popup", { enabled: "yes", hidden: [] }); ok("popup: bad settings → 400", r.status === 400 && r.data.error === "Invalid settings.", JSON.stringify(r.data));
r = await req("PUT", "/api/admin/purchase-popup", { enabled: true, hidden: ["no-such-product"] }); ok("popup: unknown hidden product → 400", r.status === 400 && r.data.error === "One of the hidden products does not exist.", JSON.stringify(r.data));
r = await req("PUT", "/api/admin/purchase-popup", { enabled: true, hidden: [] }); ok("popup: turn on, nothing hidden → 200", r.status === 200 && r.data.settings.enabled === true && r.data.settings.hidden.length === 0, JSON.stringify(r.data.settings));
cookie = ""; r = await req("GET", "/api/admin/purchase-popup"); ok("popup: admin settings signed out → 401", r.status === 401);
r = await req("PUT", "/api/admin/purchase-popup", { enabled: false, hidden: [] }); ok("popup: admin save signed out → 401", r.status === 401); cookie = adminJar;
// Admin's own order never shows (buyer accounts only).
r = await req("POST", "/api/account/orders"); const adminOrder = r.data?.id; ok("popup: admin sample order → 200", r.status === 200 && !!adminOrder, JSON.stringify(r.data));
r = await req("GET", `/api/account/orders?id=${adminOrder}`); const adminLines = (r.data?.order?.items ?? []).map((i) => i.id);
// Buyer: sign up, verify with the code from the dev outbox, set the account country, place a (dev sample) order.
const email = `smoke.popup.${stamp}@corecart.test`; const pw = "smoke-password-2026";
cookie = ""; ip = `10.6.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Popup Buyer", email, password: pw, termsVersion: TERMS }); ok("popup: buyer sign-up → 200", r.status === 200, `status ${r.status}`);
await wait(500); cookie = adminJar; const mail = ((await req("GET", "/api/admin/emails")).data?.outbox ?? []).find((m) => m.to === email && m.template === "verify"); cookie = "";
const code = mail?.subject.match(/^(\d{6}) /)?.[1];
if (!code) skip("popup: buyer steps (feed shows the order with the account country, hide, off, closed buyer)", mail?.redacted ? "dev outbox hides auth codes: set DEV_OUTBOX_SECRETS=1 in .env.local on a private machine, restart, run again" : "no verify email in the dev outbox (RESEND_API_KEY set?)");
else {
  r = await req("POST", "/api/verify-code", { email, code }); ok("popup: buyer verified + signed in", r.status === 200 && cookie.includes("session_token"), JSON.stringify(r.data));
  r = await req("POST", "/api/auth/update-user", { country: "TH" }); r = await req("GET", "/api/auth/get-session?disableCookieCache=true"); const buyerId = r.data?.user?.id;
  ok("popup: buyer account country saved (TH)", r.data?.user?.country === "TH", JSON.stringify(r.data?.user?.country));
  r = await req("GET", "/api/admin/purchase-popup"); ok("popup: customer opens admin settings → 403", r.status === 403, `status ${r.status}`);
  r = await req("POST", "/api/account/orders"); const order = r.data; ok("popup: buyer sample order (paid) → 200", r.status === 200 && !!order?.id, JSON.stringify(r.data));
  r = await req("GET", `/api/account/orders?id=${order.id}`); const all = r.data?.order?.items ?? []; const lines = all.filter((i) => i.productId); // lines without a catalog product never show
  ok("popup: buyer order saved with at least one catalog product line", lines.length > 0, JSON.stringify(all.map((i) => i.productId)));
  cookie = adminJar; ip = ip0; await wait(10_500);
  let f = await feed(); const mine = f.data.purchases.filter((p) => lines.some((l) => l.id === p.id));
  ok("popup: feed shows every line of the buyer's order with country TH, time now", mine.length === lines.length && mine.every((p) => p.country === "TH" && Math.abs(Date.now() - Date.parse(p.at)) < 120_000 && lines.some((l) => l.id === p.id && l.productId === p.productId)), JSON.stringify(mine));
  ok("popup: order lines without a product are left out", !f.data.purchases.some((p) => all.some((l) => !l.productId && l.id === p.id)));
  ok("popup: feed rows carry only id, productId, at, country", f.data.purchases.every((p) => Object.keys(p).sort().join() === "at,country,id,productId"), JSON.stringify(f.data.purchases[0]));
  const raw = JSON.stringify(f.data); ok("popup: feed never has the buyer's name, email or order number", !raw.includes(email) && !raw.includes("Smoke Popup Buyer") && !raw.includes(order.number) && !raw.includes(order.id), raw.slice(0, 120));
  ok("popup: admin's own order never in the feed", !f.data.purchases.some((p) => adminLines.includes(p.id)), JSON.stringify(adminLines));
  ok("popup: newest first, max 10", f.data.purchases.length <= 10 && f.data.purchases.every((p, i, a) => i === 0 || a[i - 1].at >= p.at));
  // Hide one product → gone from the feed at once; saved + audited; the same save again adds no audit row.
  const hideId = lines[0].productId; const hideName = (await req("GET", `/api/admin/products?id=${hideId}`)).data?.product?.name;
  r = await req("PUT", "/api/admin/purchase-popup", { enabled: true, hidden: [hideId] });
  ok("popup: hide a product → saved + history row (who, what)", r.status === 200 && r.data.settings.hidden[0] === hideId && r.data.history[0]?.by === cred.email && r.data.history[0]?.detail === `Hidden: ${hideName}` && Date.now() - Date.parse(r.data.history[0].at) < 120_000, JSON.stringify(r.data.history[0]));
  const rows = r.data.history.length;
  r = await req("GET", "/api/admin/purchase-popup"); ok("popup: hidden list really saved", r.data.settings.hidden.includes(hideId));
  r = await req("PUT", "/api/admin/purchase-popup", { enabled: true, hidden: [hideId] }); ok("popup: same settings again → no new history row", r.status === 200 && r.data.history.length === rows, `${r.data.history.length} vs ${rows}`);
  f = await feed(); ok("popup: hidden product left out of the feed at once", !f.data.purchases.some((p) => p.productId === hideId), JSON.stringify(f.data.purchases.map((p) => p.productId)));
  // Off → nothing.
  r = await req("PUT", "/api/admin/purchase-popup", { enabled: false, hidden: [hideId] }); ok("popup: turn off → history 'Popup turned off'", r.status === 200 && r.data.history[0]?.detail === "Popup turned off", JSON.stringify(r.data.history[0]));
  f = await feed(); ok("popup: off → feed { enabled: false, purchases: [] }", f.data.enabled === false && f.data.purchases.length === 0, JSON.stringify(f.data));
  r = await req("PUT", "/api/admin/purchase-popup", { enabled: true, hidden: [] }); ok("popup: on again + shown again → audited", r.status === 200 && r.data.history[0]?.detail === `Popup turned on · Shown again: ${hideName}`, JSON.stringify(r.data.history[0]));
  // Closed buyer → their orders leave the feed.
  r = await req("PATCH", "/api/admin/user", { id: buyerId, close: "Smoke popup: closed buyer" }); ok("popup: admin closes the buyer → 200", r.status === 200, JSON.stringify(r.data));
  await wait(10_500); f = await feed(); ok("popup: closed buyer's orders left out", !f.data.purchases.some((p) => lines.some((l) => l.id === p.id)), JSON.stringify(f.data.purchases.map((p) => p.id)));
}
r = await req("PUT", "/api/admin/purchase-popup", before); r = await req("GET", "/api/admin/purchase-popup");
ok("popup: settings restored to how they were before the run", r.data.settings.enabled === before.enabled && JSON.stringify(r.data.settings.hidden) === JSON.stringify(before.hidden), JSON.stringify(r.data.settings));
} // end of popup

if (!only || only === "checkout") {
// Checkout tasks 5 + 7 (2026-09-30): billing address API (same checks as the form, lib/address-formats.ts), Fees & tax admin settings
// (audited) + public GET, and a sample order that stores fee, tax, rate and billing (total = sub-total + fee + tax). Settings restored at the end.
const adminJar = cookie; const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const TH = { country: "TH", line1: "1 Silom Road", subdistrict: "Silom", district: "Bang Rak", region: "Bangkok", postcode: "10500" };
r = await req("GET", "/api/account/billing-address"); ok("billing: GET → 200 { address }", r.status === 200 && "address" in r.data, JSON.stringify(r.data));
const billingBefore = r.data?.address ?? null;
r = await req("PUT", "/api/account/billing-address", { ...TH, postcode: "1011" });
ok("billing: TH 4-digit postcode → 400 per-field error", r.status === 400 && r.data.errors?.postcode === "Postcode is not valid (example: 10110).", JSON.stringify(r.data));
r = await req("PUT", "/api/account/billing-address", { ...TH, line1: "" }); ok("billing: missing address line → 400", r.status === 400 && !!r.data.errors?.line1, JSON.stringify(r.data));
r = await req("PUT", "/api/account/billing-address", { ...TH, region: "Atlantis" }); ok("billing: province not in the list → 400", r.status === 400 && !!r.data.errors?.region, JSON.stringify(r.data));
r = await req("PUT", "/api/account/billing-address", { country: "ZZ", line1: "x" }); ok("billing: unknown country → 400", r.status === 400 && r.data.errors?.country === "Choose your country.", JSON.stringify(r.data));
r = await req("PUT", "/api/account/billing-address", { country: "HK", line1: "Flat 1, 2/F, Tower A", line2: "1 Queen's Road", district: "Central", region: "Hong Kong Island", postcode: "99999" });
ok("billing: HK (no postcode) → 200, postcode dropped", r.status === 200 && r.data.address.postcode === undefined && r.data.address.region === "Hong Kong Island", JSON.stringify(r.data));
r = await req("PUT", "/api/account/billing-address", { ...TH, country: "th", line1: "  1   Silom Road ", house: "ignored for TH" });
ok("billing: TH address → 200 (tidied, only TH fields)", r.status === 200 && r.data.address.country === "TH" && r.data.address.line1 === "1 Silom Road" && r.data.address.house === undefined, JSON.stringify(r.data));
r = await req("GET", "/api/account/billing-address"); ok("billing: really saved on the account", r.data?.address?.postcode === "10500" && r.data.address.region === "Bangkok" && r.data.address.line1 === "1 Silom Road", JSON.stringify(r.data));
r = await req("PUT", "/api/account/billing-address", { country: "GB", line1: "10 Downing Street", city: "London", postcode: "sw1a 2aa" }); ok("billing: GB postcode saved upper case", r.status === 200 && r.data.address.postcode === "SW1A 2AA", JSON.stringify(r.data));
r = await req("GET", "/api/account/billing-address"); ok("billing: GB address really saved", r.data?.address?.country === "GB" && r.data.address.postcode === "SW1A 2AA", JSON.stringify(r.data));
r = await req("PUT", "/api/account/billing-address", { country: "TH", line1: "x".repeat(5000) }); ok("billing: oversized body → 400", r.status === 400, `status ${r.status}`);
cookie = ""; r = await req("GET", "/api/account/billing-address"); ok("billing: signed out → 401", r.status === 401);
r = await req("PUT", "/api/account/billing-address", TH); ok("billing: save signed out → 401", r.status === 401); cookie = adminJar;
r = await req("PUT", "/api/account/billing-address", TH);

r = await req("GET", "/api/admin/fees"); ok("fees: admin settings → 200 (settings + history)", r.status === 200 && typeof r.data.settings?.feeEnabled === "boolean" && Array.isArray(r.data.history), JSON.stringify(r.data).slice(0, 160));
const feesBefore = r.data.settings;
const OFF = { feeEnabled: false, feePercentBp: 0, feeFixedMinor: 0, feeMinMinor: 0, taxEnabled: false, taxDefaultBp: 0, taxRates: [] };
const ON = { feeEnabled: true, feePercentBp: 250, feeFixedMinor: 1000, feeMinMinor: 0, taxEnabled: true, taxDefaultBp: 0, taxRates: [{ country: "TH", rateBp: 700 }] };
r = await req("PUT", "/api/admin/fees", { ...ON, feePercentBp: 5000 }); ok("fees: fee over 20 % → 400", r.status === 400 && r.data.error === "Service fee: 0–20 %.", JSON.stringify(r.data));
r = await req("PUT", "/api/admin/fees", { ...ON, taxRates: [{ country: "TH", rateBp: 700 }, { country: "th", rateBp: 100 }] }); ok("fees: same country twice → 400", r.status === 400 && r.data.error === "Each country can have one tax rate.", JSON.stringify(r.data));
r = await req("PUT", "/api/admin/fees", { ...ON, taxRates: [{ country: "XX", rateBp: 700 }] }); ok("fees: unknown country → 400", r.status === 400, JSON.stringify(r.data));
r = await req("PUT", "/api/admin/fees", { ...ON, feeFixedMinor: 1.5 }); ok("fees: non-integer amount → 400", r.status === 400, JSON.stringify(r.data));
r = await req("PUT", "/api/admin/fees", OFF);
r = await req("PUT", "/api/admin/fees", ON);
ok("fees: turn on 2.5% + ฿10, TH 7% → saved + history row (who, what)", r.status === 200 && r.data.settings.feePercentBp === 250 && r.data.settings.taxRates[0]?.rateBp === 700 && r.data.history[0]?.by === cred.email
  && r.data.history[0]?.detail.includes("Service fee turned on") && r.data.history[0]?.detail.includes("Tax TH 7% added"), JSON.stringify(r.data.history[0]));
const rows = r.data.history.length;
r = await req("PUT", "/api/admin/fees", ON); ok("fees: same settings again → no new history row", r.status === 200 && r.data.history.length === rows, `${r.data.history.length} vs ${rows}`);
r = await req("GET", "/api/admin/fees"); ok("fees: settings really saved (read back)", JSON.stringify(r.data.settings) === JSON.stringify(ON), JSON.stringify(r.data.settings));
cookie = ""; r = await req("GET", "/api/fees"); ok("fees: public GET (signed out) shows the saved settings", r.status === 200 && r.data.settings.feeEnabled === true && r.data.settings.taxRates[0]?.country === "TH", JSON.stringify(r.data));
r = await req("GET", "/api/admin/fees"); ok("fees: admin settings signed out → 401", r.status === 401);
r = await req("PUT", "/api/admin/fees", ON); ok("fees: admin save signed out → 401", r.status === 401); cookie = adminJar;

r = await req("POST", "/api/account/orders"); const oid = r.data?.id; ok("fees: sample order → 200", r.status === 200 && !!oid, JSON.stringify(r.data));
r = await req("GET", `/api/account/orders?id=${oid}`); const o = r.data?.order;
ok("fees: order saved fee + tax + 7% + billing (TH 10500)", o?.serviceFeeMinor > 0 && o.taxMinor > 0 && o.taxRateBp === 700 && o.billing?.postcode === "10500" && o.billing.country === "TH", JSON.stringify(o && { f: o.serviceFeeMinor, t: o.taxMinor, bp: o.taxRateBp, b: o.billing }));
ok("fees: total = sub-total + fee + tax", o && o.totalCents === o.subtotalMinor + o.serviceFeeMinor + o.taxMinor, JSON.stringify(o && [o.subtotalMinor, o.serviceFeeMinor, o.taxMinor, o.totalCents]));
await wait(600);
const box = await req("GET", "/api/admin/emails");
if (box.data?.resend) skip("fees: order email lines", "RESEND_API_KEY is set: the dev outbox stays empty");
else { const m = (box.data?.outbox ?? []).find((x) => x.template === "orderConfirmed" && x.to === cred.email && x.html.includes(o?.number));
  ok("fees: order email has Service fee, Sales tax (7%, TH), billing and Get key → Get your product", !!m && m.html.includes("Service fee:") && m.html.includes("Sales tax (7%, TH):") && m.html.includes("Bangkok 10500, TH") && m.html.includes("/account/keys/get?item="), m ? "" : "no order email"); }
r = await req("PUT", "/api/admin/fees", feesBefore); r = await req("GET", "/api/admin/fees");
ok("fees: settings restored to how they were before the run", JSON.stringify(r.data.settings) === JSON.stringify(feesBefore), JSON.stringify(r.data.settings));
if (billingBefore) { r = await req("PUT", "/api/account/billing-address", billingBefore); ok("billing: admin's address restored", r.status === 200); }
} // end of checkout

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
  ok("N4 master admin gets the failed-sends list (email_failure table readable)", Array.isArray(r.data.failures), JSON.stringify(r.data.failures)?.slice(0, 80));
  skip("N4 provider refusal recorded + test email → 502", "needs a real Resend call that fails (e.g. RESEND_API_KEY=re_invalid on a private run); not run by default");
  r = await req("POST", "/api/admin/emails", { id: "orderConfirmed" }); ok("admin send test email → 200 to self", r.status === 200 && r.data.to === cred.email, JSON.stringify(r.data));
  r = await req("POST", "/api/admin/emails", { id: "nope" }); ok("admin test email unknown template → 400", r.status === 400);
  ok("test email really in outbox", (await outboxOf(cred.email)).some((m) => m.subject.startsWith("[Test] Your CoreCart order")));
  // Customer: sign up → code email
  const email = `smoke.mail.${stamp}@corecart.test`; const pw = "smoke-password-2026";
  cookie = ""; ip = `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Mail", email, password: pw }); ok("R7 sign-up without Terms version → 400, nothing sent", r.status === 400 && (await outboxOf(email)).length === 0, `status ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
  r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Mail", email, password: pw, termsVersion: "1999-01-01" }); ok("R7 sign-up with an old Terms version → 400", r.status === 400, `status ${r.status}`);
  r = await req("POST", "/api/terms/accept", { version: "1999-01-01" }); ok("R7 terms accept wrong version → 400, no cookie", r.status === 400 && !cookie.includes("cc_terms"), `status ${r.status}`);
  r = await req("POST", "/api/terms/accept", { version: TERMS }); ok("R7 terms accept (Google path) → 200 + signed cc_terms cookie", r.status === 200 && /cc_terms=[\w-]+\.\d+\.[\w-]+/.test(cookie), cookie.slice(0, 80));
  r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke Mail", email, password: pw, termsVersion: TERMS }); ok("sign-up → 200", r.status === 200, `status ${r.status}`);
  // N1: 8 wrong codes at the same moment all count (5 tries per code): at least 3 answer "too many", and the next try too.
  const nEmail = `smoke.n1.${stamp}@corecart.test`; const ipN = ip; ip = `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  r = await req("POST", "/api/auth/sign-up/email", { name: "Smoke N1", email: nEmail, password: pw, termsVersion: TERMS });
  const guesses = await Promise.all(Array.from({ length: 8 }, (_, i) => req("POST", "/api/verify-code", { email: nEmail, code: String(100000 + i * 11111) })));
  const tooMany = guesses.filter((g) => g.data?.error === "Too many wrong codes. Send a new code.").length;
  ok("N1 8 parallel wrong codes → every one counted (≥ 3 refused as too many)", tooMany >= 3 && guesses.every((g) => g.status === 400), guesses.map((g) => g.data?.error).join(" | "));
  r = await req("POST", "/api/verify-code", { email: nEmail, code: "123456" }); ok("N1 code is dead after 5 counted tries", r.data?.error === "Too many wrong codes. Send a new code.", JSON.stringify(r.data));
  ip = ipN;
  let mails = await outboxOf(email); const v = mails.find((m) => m.template === "verify");
  // N2: the outbox hides sign-in secrets unless the server runs with DEV_OUTBOX_SECRETS=1 (private machine only).
  if (v?.redacted) {
    ok("N2 dev outbox keeps the verify email with code + link hidden", !/\b\d{6}\b/.test(v.subject) && !v.html.includes("token=") && v.html.includes("[hidden]"), v.subject);
    skip("emails: customer steps (code sign-in, order email, tax, rating, device alert)", "outbox hides codes: set DEV_OUTBOX_SECRETS=1 in .env.local on a private machine, restart npm run dev, run again");
  } else {
  const code = v?.subject.match(/^(\d{6}) is your CoreCart confirmation code$/)?.[1];
  ok("verify email: 6-digit code in subject + body, link in body, shared layout", !!code && v.html.includes(code) && v.html.includes("/verify-email?token=") && v.html.includes("#7C3AED"), v?.subject);
  r = await req("POST", "/api/verify-code", { email, code: code === "000000" ? "111111" : "000000" }); ok("verify-code wrong → 400", r.status === 400 && r.data.error === "Wrong code. Check the email and try again.", JSON.stringify(r.data));
  r = await req("POST", "/api/verify-code", { email, code: "12" }); ok("verify-code bad format → 400", r.status === 400);
  r = await req("POST", "/api/verify-code", { email, code }); ok("verify-code right → 200 + session", r.status === 200 && cookie.includes("session_token"), JSON.stringify(r.data));
  ok("device cookie set on that sign-in", /cc_device=[A-Za-z0-9_-]{43}/.test(cookie));
  r = await req("GET", "/api/auth/get-session?disableCookieCache=true"); ok("email really verified in DB", r.data?.user?.emailVerified === true);
  ok("R7 Terms version + time really saved", r.data?.user?.termsVersion === TERMS && !!r.data?.user?.termsAcceptedAt, JSON.stringify({ v: r.data?.user?.termsVersion, at: r.data?.user?.termsAcceptedAt }));
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
  } // end of customer steps (N2)
  cookie = ""; r = await req("GET", "/api/admin/emails"); ok("admin emails signed out → 401", r.status === 401);
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

console.log(results.join("\n")); printed = true;
const failed = results.filter((x) => x.startsWith("FAIL")).length;
const skipped = results.filter((x) => x.startsWith("SKIP")).length;
console.log(`\n${results.length - failed - skipped} passed, ${failed} failed${skipped ? `, ${skipped} skipped (reasons above)` : ""}`);
process.exit(failed ? 1 : 0);
