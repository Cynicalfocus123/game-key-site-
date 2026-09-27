// Server-mode API smoke test (test-only, not in live/). Run against the dev server with the local PGlite database:
//   npm run dev            (other terminal)
//   node scripts/smoke-server.mjs
// Admin login: SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD, else "Claude outputs/local-test-admin.txt" (Git-ignored, email= / password= lines).
// Make a local admin with: npm run admin:create -- --email local-admin@corecart.test (stop npm run dev first: PGlite = one process).
// Checks saved values, not only status codes. Random x-forwarded-for IPs keep IP rate limits of earlier runs out of the way;
// the per-user gift card limit is not (5 tries / 10 min): wait 10 minutes between runs or the redeem checks report "Too many attempts".
import fs from "node:fs";
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

// Signed out
cookie = "";
r = await req("GET", "/api/account/balance"); ok("balance signed out → 401", r.status === 401);
r = await req("GET", "/api/admin/promo-codes"); ok("admin promo signed out → 401", r.status === 401);
r = await req("POST", "/api/promo/validate", { code: "WELCOME10" }); ok("validate works for guests", r.status === 200);

console.log(results.join("\n"));
const failed = results.filter((x) => x.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
