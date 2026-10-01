import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Wallet top-ups: T1 + top-up redesign 2026-10-01 (wireframe topup-wireframe.png). Demo store: card top-ups are simulated on the result page
// (stands in for the provider); bank transfers wait until the admin confirms them. Desktop and mobile, no skips (layout checks branch on isMobile).
// Prices pinned to USD so preset and limit texts are fixed.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "USD")); });

const KEY = "corecart-demo-v1";
const signOutDemo = (page: Page) => page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
const status = (page: Page) => page.getByTestId("tu-status");
async function openWallet(page: Page) {
  await page.goto("account/balance/");
  await expect(page.getByRole("heading", { name: "Wallet", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add funds" })).toBeVisible();
}
// One click on a preset card → top-up result page, Pending.
async function preset(page: Page, amount: string) {
  await page.getByRole("button", { name: `Top up ${amount}` }).click();
  await expect(status(page)).toHaveText("Pending");
  return (await page.getByRole("heading", { name: /Top-up TU-\d{8}/ }).textContent())!.replace("Top-up ", "");
}
const cardAmount = (page: Page) => page.getByRole("tabpanel", { name: "Payment methods" }).getByLabel("Amount (USD)");

test("Wallet page: menu name, balance card, 5 preset cards, custom panel + option cards, limits, no sideways scroll", async ({ page, isMobile }) => {
  await registerAndVerify(page, { name: "Wallet Person" });
  await openWallet(page);
  // Menu says Wallet (sidebar on desktop, section picker on phones).
  if (isMobile) await expect(page.getByRole("combobox", { name: "Account section" }).locator("option:checked")).toHaveText("Wallet");
  else await expect(page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Wallet", exact: true })).toHaveAttribute("aria-current", "page");
  const card = page.getByRole("region", { name: "Current available balance" });
  await expect(card.getByTestId("total-balance")).toHaveText("$0.00");
  await expect(card).toContainText("US Dollar");
  await expect(card.getByRole("link", { name: "Top up history" })).toHaveAttribute("href", "#tu-history");
  const presets = page.locator(".wal-preset");
  await expect(presets.locator("strong")).toHaveText(["$10.00", "$15.00", "$25.00", "$50.00", "$100.00"]);
  await expect(presets.locator("small")).toHaveText(Array(5).fill(/^≈ ฿[\d,]+$/)); // wallet-currency (THB) estimate under each, whole baht like the wireframe
  for (const a of ["$10.00", "$15.00", "$25.00", "$50.00", "$100.00"]) await expect(page.getByRole("button", { name: `Top up ${a}` })).toBeEnabled();
  await expect(page.getByText("Demo: no card is charged.").first()).toBeVisible();
  // Layout: desktop 5 cards in one row, option cards right of the panel; phones 2 per row ($100 full width), tabs above the panel.
  const boxes = await presets.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) })));
  if (isMobile) {
    expect(boxes[0].y).toBe(boxes[1].y); expect(boxes[2].y).toBeGreaterThan(boxes[0].y); expect(boxes[4].w).toBeGreaterThan(boxes[0].w * 1.8);
  } else expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
  const tabs = page.getByRole("tablist", { name: "Top-up method" });
  await expect(tabs.getByRole("tab")).toHaveText([/Payment methods/, /Bank transfer/, /Gift card/]);
  await expect(tabs.getByRole("tab", { name: /Payment methods/ })).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel", { name: "Payment methods" });
  const [tb, pb] = [await tabs.boundingBox(), await panel.boundingBox()];
  if (isMobile) expect(tb!.y + tb!.height).toBeLessThanOrEqual(pb!.y + 1); // tabs on top
  else expect(tb!.x).toBeGreaterThanOrEqual(pb!.x + pb!.width - 1); // option cards on the right
  await expect(panel.getByRole("heading", { name: "Top up with payment methods" })).toBeVisible();
  await expect(panel.locator(".pay-tiles img")).toHaveCount(10);
  await expect(panel.getByText("Min limit $1.00 · Max limit $100.00 per top-up")).toBeVisible();
  await expect(page.getByTestId("tu-left")).toHaveText(/^\$(1,999\.9\d|2,000\.0\d)$/); // $2,000 a day → THB → USD again (satang rounding)
  await expect(panel.getByRole("button", { name: "TOP UP BALANCE" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Top up history" })).toBeVisible();
  await expect(page.getByText("No top-ups yet.")).toBeVisible();
  await noHorizontalScroll(page);
  // The old picker address has no amount screen any more: it goes back to the Wallet.
  await page.goto("account/balance/top-up/");
  await page.waitForURL(/account\/balance\/?$/);
  await expect(page.getByRole("heading", { name: "Add funds" })).toBeVisible();
});

test("custom amount: under $1 and over $100 are refused, cents are fine; TOP UP BALANCE starts the top-up", async ({ page }) => {
  await registerAndVerify(page, { name: "Custom Person" });
  await openWallet(page);
  const panel = page.getByRole("tabpanel", { name: "Payment methods" });
  await cardAmount(page).fill("0.99");
  await expect(panel.getByRole("alert").filter({ hasText: "The minimum top-up is $1.00." })).toBeVisible();
  await panel.getByRole("button", { name: "TOP UP BALANCE" }).click(); // refused before anything is created
  await expect(status(page)).toHaveCount(0);
  await cardAmount(page).fill("100.01");
  await expect(panel.getByText("The maximum top-up is $100.00.")).toBeVisible();
  await cardAmount(page).fill("12.50");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("tu-pay")).toHaveText("$12.50 USD");
  await expect(panel.locator(".tu-total dd")).toHaveText(/^\$12\.(49|50|51)$/); // New balance = 0 + credit (THB round trip)
  await noHorizontalScroll(page);
  await panel.getByRole("button", { name: "TOP UP BALANCE" }).click();
  await expect(status(page)).toHaveText("Pending");
  await expect(page.locator(".tu-lines")).toContainText("$12.50 USD");
  await expect(page.locator(".tu-lines")).toContainText("Card");
});

test("preset one click → simulate paid → wallet up once; same event again → still once; history + transactions", async ({ page }) => {
  await registerAndVerify(page, { name: "Paid Person" });
  await openWallet(page);
  const number = await preset(page, "$25.00");
  await expect(page.getByText("Waiting for the payment confirmation.")).toBeVisible();
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(status(page)).toHaveText("Credited");
  await expect(page.locator(".tu-sim").getByRole("status")).toContainText("wallet credited");
  const wallet = page.getByTestId("tu-wallet");
  await expect(wallet).toHaveText(/^\$(24\.99|25\.00|25\.01)$/);
  const first = await wallet.textContent();
  await page.getByRole("button", { name: "Send the same event again" }).click();
  await expect(page.locator(".tu-sim").getByRole("status")).toContainText("ignored as a duplicate");
  await expect(wallet).toHaveText(first!);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "Back to wallet" }).click();
  await expect(page.getByTestId("wallet-balance")).toHaveText(first!);
  const tx = page.locator(".bal-tx tbody tr", { hasText: "Wallet top-up" });
  await expect(tx).toHaveCount(1);
  await expect(tx.first()).toContainText(number);
  const history = page.getByRole("region", { name: "Top up history" }).locator("tbody tr");
  await expect(history.first()).toContainText(number);
  await expect(history.first()).toContainText("Card");
  await expect(history.first()).toContainText("Credited");
});

test("simulate failed → failed, wallet unchanged; a new card top-up cancels the older pending one; See all", async ({ page }) => {
  await registerAndVerify(page, { name: "Failed Person" });
  await openWallet(page);
  await preset(page, "$10.00");
  await page.getByRole("button", { name: "Simulate failed" }).click();
  await expect(status(page)).toHaveText("Failed");
  await expect(page.getByText("Card declined (simulated). Nothing was charged.")).toBeVisible();
  await page.getByRole("link", { name: "Top up again" }).click();
  const firstPending = await preset(page, "$15.00");
  for (const a of ["$25.00", "$50.00", "$100.00", "$10.00"]) { await page.goto("account/balance/"); await preset(page, a); }
  await page.goto("account/balance/");
  await expect(page.getByTestId("wallet-balance")).toHaveText("$0.00");
  const history = page.getByRole("region", { name: "Top up history" });
  await expect(history.locator("tbody tr")).toHaveCount(5); // last 5
  await history.getByRole("button", { name: "See all" }).click();
  await expect(history.locator("tbody tr")).toHaveCount(6);
  await expect(history.locator("tbody tr").nth(0)).toContainText("Pending");
  await expect(history.locator("tbody tr", { hasText: firstPending })).toContainText("Cancelled");
  await expect(history.locator("tbody tr").nth(5)).toContainText("Failed");
  await noHorizontalScroll(page);
});

test("pending card top-up expires after 30 minutes", async ({ page }) => {
  await page.clock.install();
  await registerAndVerify(page, { name: "Expire Person" });
  await openWallet(page);
  await preset(page, "$25.00");
  await expect(page.locator(".tu-lines > div", { hasText: "Expires in" })).toContainText(/(29|30):\d\d/);
  await page.clock.fastForward("31:00");
  await expect(status(page)).toHaveText("Expired");
  await expect(page.getByText("This top-up expired before it was paid. Nothing was charged.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Simulate paid" })).toHaveCount(0);
});

test("daily limit: with the $2,000 day used up, a preset is refused before anything is created", async ({ page }) => {
  await registerAndVerify(page, { name: "Cap Person" });
  // Seed one credited top-up worth more than the daily cap (this browser's demo store), instead of 20 × $100 through the UI.
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); const now = new Date().toISOString();
    (s.topUps ??= []).push({ id: "cap-seed", number: "TU-00000001", method: "card", userId: s.sessionUserId, amountMinor: 10000, currency: "USD", creditMinor: 10_000_000, fxRate: "1", status: "credited", provider: "demo",
      providerRef: null, idempotencyKey: "cap-seed-key", failureReason: null, closedById: null, createdAt: now, expiresAt: now, paidAt: now, creditedAt: now, closedAt: null });
    localStorage.setItem(k, JSON.stringify(s));
  }, KEY);
  await openWallet(page);
  await expect(page.getByTestId("tu-left")).toHaveText("$0.00");
  await page.getByRole("button", { name: "Top up $10.00" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You reached the daily top-up limit. Try again tomorrow." })).toBeVisible();
  await expect(status(page)).toHaveCount(0);
  await expect(page).toHaveURL(/account\/balance\/?$/);
});

test("bank transfer: Coming soon → admin sets details (audited) → customer sends → waiting → admin confirms → wallet credited once", async ({ page, isMobile }) => {
  // 1. Not set up yet: the customer sees "Coming soon".
  const email = await registerAndVerify(page, { name: "Bank Person" });
  await openWallet(page);
  await page.getByRole("tab", { name: /Bank transfer/ }).click();
  await expect(page.getByRole("tabpanel", { name: "Bank transfer" }).getByText("Bank transfer is coming soon.")).toBeVisible();
  await signOutDemo(page);

  // 2. Admin: half-filled details refused; full details saved + history.
  await signInDemoAdmin(page);
  await page.goto("admin/topups/");
  const bank = page.locator(".tu-bank");
  await expect(bank.locator("summary")).toContainText("Coming soon");
  await bank.getByLabel("Bank name").fill("Kasikorn Bank");
  await bank.getByRole("button", { name: "Save bank details" }).click();
  await expect(bank.getByText("Fill in bank name, account name and account number together")).toBeVisible();
  await bank.getByLabel("Account name").fill("CoreCart Co., Ltd.");
  await bank.getByLabel("Account number / IBAN").fill("123-4-56789-0");
  await bank.getByLabel("SWIFT / BIC (optional)").fill("kasith");
  await bank.getByRole("button", { name: "Save bank details" }).click();
  await expect(bank.getByText("SWIFT / BIC: 8 or 11 letters and digits.")).toBeVisible();
  await bank.getByLabel("SWIFT / BIC (optional)").fill("KASITHBK");
  await bank.getByRole("button", { name: "Save bank details" }).click();
  await expect(bank.getByText("Saved. Customers now see these bank details.")).toBeVisible();
  await expect(bank.getByText("customers can send any of the 51 currencies enabled in")).toBeVisible();
  await expect(bank.locator("summary")).toContainText("On");
  await expect(bank.locator(".adm-list li").first()).toContainText("Bank transfer turned on");
  await expect(bank.locator(".adm-list li").first()).toContainText("admin@corecart.demo");
  await noHorizontalScroll(page);
  await signOutDemo(page);

  // 3. Customer: details + own reference (same after reload), limits, "I have sent the transfer".
  await page.goto("login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/account/);
  await openWallet(page);
  await page.getByRole("tab", { name: /Bank transfer/ }).click();
  const panel = page.getByRole("tabpanel", { name: "Bank transfer" });
  const details = panel.getByRole("definition");
  await expect(details).toHaveText(["Kasikorn Bank", "CoreCart Co., Ltd.", "123-4-56789-0", "KASITHBK"]);
  const ref = (await panel.getByTestId("bank-ref").textContent())!;
  expect(ref).toMatch(/^CC-[A-HJ-NP-Z2-9]{6}$/);
  await page.reload();
  await page.getByRole("tab", { name: /Bank transfer/ }).click();
  await expect(panel.getByTestId("bank-ref")).toHaveText(ref);
  await expect(panel.getByRole("combobox")).toHaveValue("USD");
  // Every currency enabled in Admin → Currencies (user 2026-10-01): 51 by default (BGN + RUB are off), not only the chargeable ones.
  const codes = await panel.getByRole("combobox").locator("option").allTextContents();
  expect(codes).toHaveLength(51);
  for (const c of ["THB", "USD", "EUR", "JPY", "GBP"]) expect(codes).toContain(c);
  for (const c of ["BGN", "RUB"]) expect(codes).not.toContain(c);
  await expect(panel.getByText("Min limit $1.00 · Max limit $100.00 per top-up")).toBeVisible();
  await panel.getByLabel("Amount (USD)").fill("0.50");
  await expect(panel.getByRole("alert").filter({ hasText: "The minimum top-up is $1.00." })).toBeVisible();
  await panel.getByLabel("Amount (USD)").fill("50");
  await noHorizontalScroll(page);
  await panel.getByRole("button", { name: "I have sent the transfer" }).click();
  await expect(panel.getByRole("status").filter({ hasText: /Transfer BT-\d{8} \(\$50\.00 USD\) is waiting for the money to arrive/ })).toBeVisible();
  const number = /BT-\d{8}/.exec((await panel.getByRole("status").filter({ hasText: "BT-" }).textContent())!)![0];
  const row = page.getByRole("region", { name: "Top up history" }).locator("tbody tr", { hasText: number });
  await expect(row).toContainText("Bank transfer");
  await expect(row).toContainText("Waiting for transfer");
  await expect(page.getByTestId("wallet-balance")).toHaveText("$0.00");
  await row.getByRole("link", { name: number }).click();
  await expect(status(page)).toHaveText("Waiting for transfer");
  await expect(page.getByText("Waiting for your transfer.")).toBeVisible();
  await expect(page.getByTestId("tu-ref")).toHaveText(ref);
  await expect(page.locator(".tu-sim")).toHaveCount(0); // a bank transfer is never simulated
  await signOutDemo(page);

  // 4. Admin: find by reference, wrong amount refused, right amount → credited + audit.
  await signInDemoAdmin(page);
  await page.goto("admin/topups/");
  await page.getByRole("searchbox", { name: "Search" }).fill(ref);
  const rows = page.locator(".adm-table tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Waiting for transfer");
  await expect(rows.first()).toContainText("Bank transfer");
  await rows.first().getByRole("link", { name: number }).click();
  await page.waitForURL(/admin\/topup\/?\?id=/);
  await expect(page.getByTestId("adm-tu-status")).toHaveText("Waiting for transfer");
  await expect(page.getByTestId("adm-tu-ref")).toHaveText(ref);
  await expect(page.getByRole("button", { name: "Refund to card" })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm received…" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Confirm bank transfer received" });
  await dialog.getByLabel("Amount received (USD)").fill("49.99");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("The amount received must be $50.00 USD.", { exact: false })).toBeVisible();
  await dialog.getByLabel("Amount received (USD)").fill("50.00");
  await dialog.getByLabel(/Bank reference/).fill("KBANK-778899");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("adm-tu-status")).toHaveText("Credited");
  await expect(page.getByText("Bank transfer confirmed. The wallet was credited and the customer was emailed.")).toBeVisible();
  await expect(page.getByText("confirmed received by admin@corecart.demo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm received…" })).toHaveCount(0);
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: email }).first().click();
  await page.waitForURL(/admin\/user\/?\?id=/);
  await expect(page.locator(".adm-audit li").first()).toContainText(`Bank transfer confirmed: ${number} · $50.00 USD received · bank ref KBANK-778899`);
  await expect(page.getByRole("region", { name: "Balance" }).locator("tbody tr", { hasText: "Wallet top-up" })).toHaveCount(1);
  await signOutDemo(page);

  // 5. Customer: wallet credited once, history Credited.
  await page.goto("login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/account/);
  await openWallet(page);
  await expect(page.getByTestId("wallet-balance")).toHaveText(/^\$(49\.99|50\.00|50\.01)$/);
  await expect(page.getByRole("region", { name: "Top up history" }).locator("tbody tr", { hasText: number })).toContainText("Credited");
  await expect(page.locator(".bal-tx tbody tr", { hasText: number })).toHaveCount(1);
  if (isMobile) await expect(page.getByRole("tablist", { name: "Top-up method" })).toBeVisible();
});

test("bank transfer: at most 3 waiting at once; the customer reference is unique per customer", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/topups/");
  const bank = page.locator(".tu-bank");
  await bank.getByLabel("Bank name").fill("Bangkok Bank");
  await bank.getByLabel("Account name").fill("CoreCart Co., Ltd.");
  await bank.getByLabel("Account number / IBAN").fill("TH12 3456 7890");
  await bank.getByRole("button", { name: "Save bank details" }).click();
  await expect(bank.getByText("Saved. Customers now see these bank details.")).toBeVisible();
  await signOutDemo(page);
  const refs: string[] = [];
  for (const who of ["Ref One", "Ref Two"]) {
    await registerAndVerify(page, { name: who });
    await openWallet(page);
    await page.getByRole("tab", { name: /Bank transfer/ }).click();
    const panel = page.getByRole("tabpanel", { name: "Bank transfer" });
    refs.push((await panel.getByTestId("bank-ref").textContent())!);
    if (who === "Ref Two") {
      for (const a of ["10", "20", "30"]) {
        if (a === "30") await panel.getByRole("combobox").selectOption("EUR"); // enabled but not chargeable by card: fine for a bank transfer
        await panel.getByLabel(/^Amount \((USD|EUR)\)$/).fill(a);
        await panel.getByRole("button", { name: "I have sent the transfer" }).click();
        await expect(panel.getByRole("status").filter({ hasText: "is waiting for the money to arrive" })).toBeVisible();
      }
      await panel.getByLabel("Amount (EUR)").fill("40");
      await panel.getByRole("button", { name: "I have sent the transfer" }).click();
      await expect(panel.getByRole("alert").filter({ hasText: "You already have 3 bank transfers waiting." })).toBeVisible();
      const waiting = page.getByRole("region", { name: "Top up history" }).locator("tbody tr", { hasText: "Waiting for transfer" });
      await expect(waiting).toHaveCount(3);
      await expect(waiting.first()).toContainText("30.00 EUR");
    }
    await signOutDemo(page);
  }
  expect(refs[0]).not.toBe(refs[1]);
});

test("admin: Top-ups list, filters, detail with event log, cancel with reason (audited); user detail lists top-ups", async ({ page, isMobile }) => {
  const email = await registerAndVerify(page, { name: "Admin Topup Person" });
  await openWallet(page);
  await preset(page, "$15.00");
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(status(page)).toHaveText("Credited");
  await page.goto("account/balance/");
  const pending = await preset(page, "$10.00");
  await signOutDemo(page);

  await signInDemoAdmin(page);
  if (isMobile) await page.getByRole("combobox", { name: "Admin section" }).selectOption({ label: "Top-ups" });
  else await page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Top-ups" }).click();
  await page.waitForURL(/admin\/topups/);
  await page.getByRole("searchbox", { name: "Search" }).fill(email);
  const rows = page.locator(".adm-table tbody tr");
  await expect(rows).toHaveCount(2);
  await page.getByRole("combobox", { name: "Status" }).selectOption("pending");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(pending);
  await expect(rows.first()).toContainText("$10.00 USD");
  await expect(rows.first()).toContainText("Card");
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: pending }).click();
  await page.waitForURL(/admin\/topup\/?\?id=/);
  await expect(page.getByTestId("adm-tu-status")).toHaveText("Pending");
  await expect(page.getByRole("button", { name: "Refund to card" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Confirm received…" })).toHaveCount(0); // card top-ups are never confirmed by hand
  await page.getByRole("button", { name: "Cancel…" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Cancel top-up" });
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Enter a reason.")).toBeVisible();
  await dialog.getByLabel(/Reason/).fill("Customer asked to cancel");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("adm-tu-status")).toHaveText("Cancelled");
  await expect(page.getByText("Note: Customer asked to cancel (by admin@corecart.demo)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel…" })).toHaveCount(0);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: email }).first().click();
  await page.waitForURL(/admin\/user\/?\?id=/);
  const balance = page.getByRole("region", { name: "Balance" });
  await expect(balance.getByText("Top-ups (2)")).toBeVisible();
  await expect(balance.locator("tbody tr", { hasText: pending })).toContainText("Cancelled");
  await expect(balance.locator("tbody tr", { hasText: "Wallet top-up" })).toHaveCount(1);
  await expect(page.locator(".adm-audit li").first()).toContainText(`Top-up cancelled: ${pending} · Customer asked to cancel`);
});
