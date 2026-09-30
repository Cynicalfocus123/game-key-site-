import { expect, test, type Page } from "@playwright/test";
import { TERMS_VERSION } from "../lib/terms";
import { DEMO_PASSWORD, registerAndVerify, signInDemoAdmin, uniqueEmail } from "./helpers";

// Code review fixes (R1–R8, N1–N4), demo build. Server paths are covered by scripts/smoke-server.mjs (real server). Desktop and mobile.
const KEY = "corecart-demo-v1";
type DemoUser = { id: string; email: string; claimEmail?: string | null; status?: string; emailVerified: boolean; termsVersion?: string | null; termsAcceptedAt?: string | null };
const users = (page: Page) => page.evaluate((k) => (JSON.parse(localStorage.getItem(k) || "{}").users ?? []) as DemoUser[], KEY);
const signOutDemo = (page: Page) => page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); }, KEY);

async function closeOwnAccount(page: Page) {
  await page.goto("account/settings/");
  await page.getByRole("button", { name: "Close account…" }).click();
  await page.getByLabel("Password (leave empty for Google-only accounts)").fill(DEMO_PASSWORD);
  await page.getByLabel("Type CLOSE to confirm").fill("CLOSE");
  await page.getByRole("button", { name: "Close my account" }).click();
  await expect(page.getByText("Your account is closed and you are signed out everywhere.", { exact: false })).toBeVisible();
}
// Fills the register form and stops at "Check your email"; returns the verification link (demo inbox).
async function registerOnly(page: Page, email: string) {
  await page.goto("register/");
  await page.locator("input[name=name]").fill("Claimer");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.locator("input[name=confirm]").fill(DEMO_PASSWORD);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  return (await page.getByRole("link", { name: "Open verification link" }).getAttribute("href"))!;
}

test("R1: an unverified sign-up with a closed account's email changes nothing; admin reopen works; the late claim is refused", async ({ page }) => {
  const email = uniqueEmail("r1");
  await registerAndVerify(page, { name: "Original Owner", email });
  await closeOwnAccount(page);
  const link = await registerOnly(page, email);
  let all = await users(page);
  const old = all.find((u) => u.status === "closed" && u.email === email);
  expect(old, "closed account still holds the email").toBeTruthy();
  const claim = all.find((u) => u.claimEmail === email)!;
  expect(claim.email).toMatch(/^claim\+.+@claim\.invalid$/);
  expect(claim.emailVerified).toBe(false);

  await signInDemoAdmin(page);
  await page.goto(`admin/user/?id=${old!.id}`);
  await page.getByRole("button", { name: "Reopen account…" }).click();
  await page.getByLabel("Note (required)").fill("Owner asked to reopen");
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(page.getByText("Account reopened.")).toBeVisible();
  await signOutDemo(page);

  await page.goto(link.replace(/^.*?(verify-email\/)/, "$1"));
  await expect(page.getByText("This email is in use again, so this sign-up cannot be finished.", { exact: false })).toBeVisible();
  all = await users(page);
  expect(all.find((u) => u.id === old!.id)).toMatchObject({ status: "active", email });
  expect(all.find((u) => u.id === claim.id)).toMatchObject({ emailVerified: false, claimEmail: email });
});

test("R1: a verified sign-up takes the closed account's email only at verification", async ({ page }) => {
  const email = uniqueEmail("r1b");
  await registerAndVerify(page, { name: "Original Owner", email });
  await closeOwnAccount(page);
  const link = await registerOnly(page, email);
  expect((await users(page)).find((u) => u.status === "closed")?.email).toBe(email);
  await page.goto(link.replace(/^.*?(verify-email\/)/, "$1"));
  await page.waitForURL(/verified=1/);
  const all = await users(page);
  const closed = all.find((u) => u.status === "closed" && u.email.startsWith("closed+"));
  const fresh = all.find((u) => u.email === email && u.status !== "closed");
  expect(closed, "closed account moved to a placeholder").toBeTruthy();
  expect(fresh).toMatchObject({ emailVerified: true, claimEmail: null });
});

test("R7: sign-up records the accepted Terms version + time (email and Google)", async ({ page }) => {
  const email = await registerAndVerify(page, { name: "Terms Person" });
  const u = (await users(page)).find((x) => x.email === email)!;
  expect(u.termsVersion).toBe(TERMS_VERSION);
  expect(Date.now() - Date.parse(u.termsAcceptedAt!)).toBeLessThan(120_000);
  await signOutDemo(page);
  await page.goto("login/");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.waitForURL(/account/);
  const g = (await users(page)).find((x) => x.email === "demo.google.user@gmail.com")!;
  expect(g.termsVersion).toBe(TERMS_VERSION);
});

test("R4: fast quantity clicks keep the LAST quantity saved and shown; a failed save shows the saved cart + a note", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("");
  await page.getByRole("button", { name: "Add to cart: Elden Ring" }).first().click();
  await page.goto("cart/");
  const plus = page.getByRole("button", { name: "Increase quantity of Elden Ring" });
  const qty = page.getByRole("group", { name: "Quantity of Elden Ring" }).locator("output");
  await expect(qty).toHaveText("1");
  await plus.click(); await plus.click(); await plus.click(); // no waiting between clicks
  await expect(qty).toHaveText("4");
  await page.reload();
  await expect(qty).toHaveText("4"); // what the store saved
  // Saving fails (storage write throws, like a network error on the server build): the saved 4 comes back + an amber note.
  await page.evaluate(() => { const orig = Storage.prototype.setItem; (window as unknown as { __restore: () => void }).__restore = () => { Storage.prototype.setItem = orig; };
    Storage.prototype.setItem = function (k: string, v: string) { if (k === "corecart-demo-v1") throw new Error("disk full"); return orig.call(this, k, v); }; });
  await plus.click();
  await expect(page.getByRole("alert").filter({ hasText: "We couldn't save your last cart change." })).toBeVisible();
  await expect(qty).toHaveText("4");
  await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore());
  await plus.click();
  await expect(qty).toHaveText("5");
  await expect(page.getByText("We couldn't save your last cart change.")).toHaveCount(0);
});

test("N2: only the master admin sees the email outbox (real emails); another admin sees a notice", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/emails/");
  await expect(page.getByRole("heading", { name: "Demo outbox (this browser)" })).toBeVisible();
  await expect(page.getByText("Only the master admin can see the outbox", { exact: false })).toHaveCount(0);
  // Same admin as a plain admin with every section (test data set in this browser's demo store).
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)!); const me = s.users.find((u: DemoUser) => u.id === s.sessionUserId); me.role = "admin"; me.adminPerms = null; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload();
  await expect(page.getByText("Only the master admin can see the outbox: it holds real emails of real accounts.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(0);
});

test("R5 (server build only): a failed /api/catalog is retried; the cart waits for live prices", async ({ page }) => {
  test.skip(!process.env.E2E_SERVER_URL, "Needs the real server build (the static demo has no /api/catalog). Runs when E2E_SERVER_URL is set after the user opens npm run dev.");
  let calls = 0;
  await page.route("**/api/catalog", (route) => (++calls <= 2 ? route.fulfill({ status: 503, body: "{}" }) : route.continue()));
  await page.goto(`${process.env.E2E_SERVER_URL}/cart`);
  // npm run dev builds + hydrates the page slowly (~11 s on first visits), so the waits are long.
  await expect(page.getByText("Live prices could not be loaded yet. Retrying…", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Your cart \(\d+\)/ })).toBeVisible({ timeout: 30_000 });
  expect(calls).toBeGreaterThanOrEqual(3);
});

// R8: the payment event contract + match rules (pure functions, no screen).
test.describe("R8 payment event checks", () => {
  test("normalizeEvent + matchEvent refuse every incomplete or mismatched event", async ({ isMobile }) => {
    test.skip(isMobile, "Pure logic (no screen): runs once on desktop. Server paths are in scripts/smoke-server.mjs topups.");
    const { normalizeEvent, matchEvent } = await import("../lib/server/payments/event");
    const ok = { eventId: "evt_1", type: "payment.succeeded", rawType: "payment.succeeded", topUpId: "t1", providerRef: "dev_t1", amountMinor: 900, currency: "usd" };
    const t = { id: "t1", provider: "dev", providerRef: "dev_t1", amountMinor: 900, currency: "USD" };
    const n = normalizeEvent(ok); expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.ev.type === "payment.succeeded" && n.ev.currency).toBe("USD"); // normalized
    expect(matchEvent(n.ev, t, "dev")).toEqual({ ok: true });
    const bad = (patch: Record<string, unknown>) => { const r = normalizeEvent({ ...ok, ...patch }); return r.ok ? "accepted" : r.reason; };
    expect(bad({ amountMinor: undefined })).toBe("missing amount");
    expect(bad({ currency: undefined })).toBe("missing currency");
    expect(bad({ currency: "" })).toBe("missing currency");
    for (const a of ["900", 900.5, 0, -1, Number.NaN, Infinity, 2 ** 60]) expect(bad({ amountMinor: a })).toBe("invalid amount");
    expect(bad({ currency: "US" })).toBe("invalid currency");
    expect(bad({ providerRef: undefined })).toBe("missing payment reference");
    expect(bad({ providerRef: "bad ref with spaces" })).toBe("invalid payment reference");
    expect(bad({ eventId: "" })).toBe("missing event id");
    const ev = (patch: Record<string, unknown>) => { const r = normalizeEvent({ ...ok, ...patch }); if (!r.ok) throw new Error(r.reason); return r.ev; };
    expect(matchEvent(ev({}), { ...t, provider: "stripe" }, "dev")).toMatchObject({ ok: false, kind: "permanent", reason: expect.stringContaining("wrong provider") });
    expect(matchEvent(ev({ topUpId: "t2" }), t, "dev")).toMatchObject({ ok: false, kind: "permanent", reason: expect.stringContaining("different top-ups") });
    expect(matchEvent(ev({ providerRef: "dev_other" }), t, "dev")).toMatchObject({ ok: false, kind: "permanent", reason: "payment reference mismatch" });
    expect(matchEvent(ev({}), { ...t, providerRef: null }, "dev")).toMatchObject({ ok: false, kind: "transient", reason: "payment reference not saved yet" });
    expect(matchEvent(ev({ amountMinor: 901 }), t, "dev")).toMatchObject({ ok: false, kind: "permanent", reason: expect.stringContaining("amount mismatch") });
    expect(matchEvent(ev({ currency: "EUR" }), t, "dev")).toMatchObject({ ok: false, kind: "permanent", reason: expect.stringContaining("currency mismatch") });
    // Pending / authorized-only provider events never become a success.
    const auth = normalizeEvent({ ...ok, type: "payment.authorized", rawType: "payment.authorized" }); expect(auth.ok && auth.ev.type).toBe("other");
    // A failed event needs the same provider + reference match (it must not fail someone else's top-up).
    const failed = normalizeEvent({ eventId: "evt_2", type: "payment.failed", rawType: "payment.failed", topUpId: "t1", providerRef: "dev_other" });
    expect(failed.ok && matchEvent(failed.ev, t, "dev")).toMatchObject({ ok: false, reason: "payment reference mismatch" });
  });
});
