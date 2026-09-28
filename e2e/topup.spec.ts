import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Future task T1: wallet top-up (demo store: "Demo: simulate payment" stands in for the card provider). Desktop and mobile.
// Prices pinned to USD so preset and limit texts are fixed.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "USD")); });

const signOutDemo = (page: Page) => page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
const status = (page: Page) => page.getByTestId("tu-status");
async function openTopUp(page: Page) {
  await page.goto("account/balance/");
  await page.getByRole("link", { name: "Top up", exact: true }).click();
  await page.waitForURL(/account\/balance\/top-up/);
  await expect(page.getByRole("radiogroup", { name: "Top-up amount" })).toBeVisible();
}
async function startDemo(page: Page, custom?: string) {
  if (custom) { await page.getByRole("radio", { name: "Custom" }).click(); await page.getByLabel("Custom amount (USD)").fill(custom); }
  await page.getByRole("button", { name: "Demo: simulate payment" }).click();
  await expect(status(page)).toHaveText("Pending");
}
const usd = (text: string | null) => Number((text ?? "").replace(/[^\d.]/g, ""));

test("top-up page: presets, limits, Pay disabled (coming soon), demo button, no sideways scroll", async ({ page }) => {
  await registerAndVerify(page, { name: "Topup Person" });
  await openTopUp(page);
  const presets = page.getByRole("radiogroup", { name: "Top-up amount" }).getByRole("radio");
  await expect(presets).toHaveText(["$5.00", "$10.00", "$25.00", "$50.00", "$100.00", "Custom"]);
  await expect(page.getByRole("radio", { name: "$25.00" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("tu-pay")).toHaveText("$25.00 USD");
  await expect(page.getByText("Minimum $5.00 · maximum $1,000.00 per top-up.")).toBeVisible();
  await expect(page.getByTestId("tu-left")).toHaveText(/^\$(1,999\.9\d|2,000\.0\d)$/); // $2,000 cap → THB → USD again (satang rounding)
  await expect(page.getByRole("button", { name: "Pay $25.00" })).toBeDisabled();
  await expect(page.getByText("Card payments coming soon.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Demo: simulate payment" })).toBeEnabled();
  await page.getByRole("radio", { name: "$100.00" }).click();
  await expect(page.getByTestId("tu-pay")).toHaveText("$100.00 USD");
  await noHorizontalScroll(page);
});

test("custom amount: under $5 and over $1,000 are refused, cents are fine", async ({ page }) => {
  await registerAndVerify(page, { name: "Custom Person" });
  await openTopUp(page);
  await page.getByRole("radio", { name: "Custom" }).click();
  const input = page.getByLabel("Custom amount (USD)");
  await input.fill("4.99");
  await expect(page.getByRole("alert").filter({ hasText: "The minimum top-up is $5.00." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Demo: simulate payment" })).toBeEnabled();
  await page.getByRole("button", { name: "Demo: simulate payment" }).click(); // refused before anything is created
  await expect(page.getByTestId("tu-status")).toHaveCount(0);
  await input.fill("1000.01");
  await expect(page.getByText("The maximum top-up is $1,000.00.")).toBeVisible();
  await input.fill("12.50");
  await expect(page.locator(".tu-custom").getByRole("alert")).toHaveCount(0); // scoped: Next's route announcer is role=alert too
  await expect(page.getByTestId("tu-pay")).toHaveText("$12.50 USD");
});

test("simulate paid → wallet up once; same event again → still once; history + recent top-ups", async ({ page }) => {
  await registerAndVerify(page, { name: "Paid Person" });
  await openTopUp(page);
  await startDemo(page); // $25 preset
  const number = (await page.getByRole("heading", { name: /Top-up TU-\d{8}/ }).textContent())!.replace("Top-up ", "");
  await expect(page.getByText("Waiting for the payment confirmation.")).toBeVisible();
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(status(page)).toHaveText("Credited");
  await expect(page.locator(".tu-sim").getByRole("status")).toContainText("wallet credited");
  const wallet = page.getByTestId("tu-wallet");
  await expect(wallet).toHaveText(/^\$(24\.99|25\.00|25\.01)$/); // $25 → THB → shown in USD again (satang rounding)
  const first = await wallet.textContent();
  await page.getByRole("button", { name: "Send the same event again" }).click();
  await expect(page.locator(".tu-sim").getByRole("status")).toContainText("ignored as a duplicate");
  await expect(wallet).toHaveText(first!);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "Back to balance" }).click();
  await expect(page.getByTestId("wallet-balance")).toHaveText(first!);
  const rows = page.locator(".bal-tx tbody tr", { hasText: "Wallet top-up" });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(number);
  const recent = page.getByRole("region", { name: "Recent top-ups" });
  await expect(recent.locator("tbody tr").first()).toContainText(number);
  await expect(recent.locator("tbody tr").first()).toContainText("Credited");
});

test("simulate failed → failed, nothing charged, wallet unchanged; starting another cancels the older pending one", async ({ page }) => {
  await registerAndVerify(page, { name: "Failed Person" });
  await openTopUp(page);
  await startDemo(page, "7");
  await page.getByRole("button", { name: "Simulate failed" }).click();
  await expect(status(page)).toHaveText("Failed");
  await expect(page.getByText("Card declined (simulated). Nothing was charged.")).toBeVisible();
  await page.getByRole("button", { name: "Top up again" }).click();
  await startDemo(page, "8");
  const firstPending = (await page.getByRole("heading", { name: /Top-up TU-/ }).textContent())!.replace("Top-up ", "");
  await page.goto("account/balance/top-up/");
  await startDemo(page, "9");
  await page.goto("account/balance/");
  await expect(page.getByTestId("wallet-balance")).toHaveText("$0.00");
  const recent = page.getByRole("region", { name: "Recent top-ups" }).locator("tbody tr");
  await expect(recent).toHaveCount(3);
  await expect(recent.nth(0)).toContainText("Pending");
  await expect(recent.filter({ hasText: firstPending })).toContainText("Cancelled");
  await expect(recent.nth(2)).toContainText("Failed");
});

test("pending top-up expires after 30 minutes", async ({ page }) => {
  await page.clock.install();
  await registerAndVerify(page, { name: "Expire Person" });
  await openTopUp(page);
  await startDemo(page);
  await expect(page.locator(".tu-lines > div", { hasText: "Expires in" })).toContainText(/(29|30):\d\d/);
  await page.clock.fastForward("31:00");
  await expect(status(page)).toHaveText("Expired");
  await expect(page.getByText("This top-up expired before it was paid. Nothing was charged.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Simulate paid" })).toHaveCount(0);
});

test("daily limit: $1,000 + $999 paid, then $5 is over the $2,000 day", async ({ page }) => {
  await registerAndVerify(page, { name: "Cap Person" });
  await openTopUp(page);
  for (const amount of ["1000", "999"]) {
    await startDemo(page, amount);
    await page.getByRole("button", { name: "Simulate paid" }).click();
    await expect(status(page)).toHaveText("Credited");
    await page.getByRole("button", { name: "Top up again" }).click();
  }
  await expect(page.getByTestId("tu-left")).toHaveText(/^\$(0\.9\d|1\.0\d)$/);
  await page.getByRole("radio", { name: "$5.00" }).click();
  await page.getByRole("button", { name: "Demo: simulate payment" }).click();
  await expect(page.getByText(/This goes over the daily top-up limit\. You can add up to \$(0\.9\d|1\.0\d) more today\./)).toBeVisible();
  await expect(page.getByTestId("tu-status")).toHaveCount(0);
});

test("admin: Top-ups list, filters, detail with event log, cancel with reason (audited); user detail lists top-ups", async ({ page, isMobile }) => {
  const email = await registerAndVerify(page, { name: "Admin Topup Person" });
  await openTopUp(page);
  await startDemo(page, "15");
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(status(page)).toHaveText("Credited");
  await page.getByRole("button", { name: "Top up again" }).click();
  await startDemo(page, "6");
  const pending = (await page.getByRole("heading", { name: /Top-up TU-/ }).textContent())!.replace("Top-up ", "");
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
  await expect(rows.first()).toContainText("$6.00 USD");
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: pending }).click();
  await page.waitForURL(/admin\/topup\/?\?id=/);
  await expect(page.getByTestId("adm-tu-status")).toHaveText("Pending");
  await expect(page.getByRole("button", { name: "Refund to card" })).toBeDisabled();
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

test("mobile: Pay bar sticks to the bottom of the screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Sticky Pay bar only exists under 768px; the desktop summary is covered by the first test.");
  await registerAndVerify(page, { name: "Sticky Person" });
  await openTopUp(page);
  const bar = page.locator(".tu-pay");
  await expect(bar).toHaveCSS("position", "sticky");
  await expect(bar.locator(".tu-pay-amount")).toHaveText("$25.00");
  expect(usd(await bar.locator(".tu-pay-amount").textContent())).toBe(25);
});
