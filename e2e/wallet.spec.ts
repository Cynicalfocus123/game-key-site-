import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Future task S8: admin wallet (user detail balances + ledger + Adjust balance, Users Balance column, overview Balance owed).
// Desktop and mobile. Prices pinned to THB.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "THB")); });

async function adjust(page: Page, dir: "Credit (add)" | "Debit (take away)", amount: string, reason: string) {
  await page.getByRole("button", { name: "Adjust balance" }).click();
  await page.getByRole("radio", { name: dir }).check();
  await page.getByLabel("Amount (THB)").fill(amount);
  await page.getByLabel("Reason (the customer sees this)").fill(reason);
  await page.getByRole("button", { name: "Review" }).click();
}

test("admin credits and debits a customer; ledger, list, overview and the customer's page follow", async ({ page }) => {
  const email = await registerAndVerify(page, { name: "Wallet Person" });
  await page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
  await signInDemoAdmin(page);
  const owedTile = page.locator(".acct-tile", { hasText: "Balance owed" }).locator("strong");
  await expect(owedTile).toHaveText("฿0.00");

  await page.goto("admin/users/");
  await page.getByRole("searchbox", { name: "Search" }).fill(email);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".adm-table tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "Wallet Person" }).click();
  const panel = page.getByRole("region", { name: "Balance" });
  await expect(panel.getByText("No transactions yet.")).toBeVisible();

  // Credit ฿250 → confirm step → saved row.
  await adjust(page, "Credit (add)", "250", "Goodwill for late key");
  const confirm = page.getByRole("alertdialog", { name: "Confirm adjustment" });
  await expect(confirm).toContainText(`Add ฿250.00 to the wallet of ${email}? New balance: ฿250.00.`);
  await confirm.getByRole("button", { name: "Confirm" }).click();
  await expect(panel.locator(".acct-tile", { hasText: "Wallet" }).first().locator("strong")).toHaveText("฿250.00");
  const first = panel.locator("tbody tr").first();
  await expect(first).toContainText("Adjustment by CoreCart");
  await expect(first).toContainText("Goodwill for late key");
  await expect(first).toContainText("+฿250.00");
  await expect(first).toContainText("admin@corecart.demo");

  // Debit more than the balance → refused before saving; Back keeps the form.
  await adjust(page, "Debit (take away)", "300", "Too much");
  await expect(page.getByText("A debit cannot take the balance below ฿0.")).toBeVisible();
  await page.getByLabel("Amount (THB)").fill("50.5");
  await page.getByLabel("Reason (the customer sees this)").fill("Refund for order CC-12345678 reversed");
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("alertdialog", { name: "Confirm adjustment" }).getByRole("button", { name: "Confirm" }).click();
  await expect(panel.locator(".acct-tile", { hasText: "Total owed" }).locator("strong")).toHaveText("฿199.50");
  await expect(panel.locator("tbody tr").first()).toContainText("−฿50.50");
  await expect(panel.locator("tbody tr")).toHaveCount(2);
  // Empty reason is refused.
  await adjust(page, "Credit (add)", "10", "");
  await expect(page.getByText("Enter a reason.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await noHorizontalScroll(page);

  // Users list: Balance column + sort by balance.
  await page.goto("admin/users/");
  await page.getByRole("combobox", { name: "Sort" }).selectOption({ label: "Balance (highest)" });
  await expect(page.locator(".adm-table tbody tr").first()).toContainText(email);
  await expect(page.locator(".adm-table tbody tr").first()).toContainText("฿199.50");
  await page.goto("admin/");
  await expect(owedTile).toHaveText("฿199.50");

  // Customer sees both lines with the reasons.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/admin\/login/);
  await page.goto("login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.goto("account/balance/");
  await expect(page.getByTestId("wallet-balance")).toHaveText("฿199.50");
  const rows = page.locator(".bal-table tbody tr");
  await expect(rows.first()).toContainText("Refund for order CC-12345678 reversed");
  await expect(rows.nth(1)).toContainText("Goodwill for late key");
  await expect(page.locator(".bal-table")).not.toContainText("admin@corecart.demo"); // admin identity stays internal
});
