import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Handoff v12 step 3: balance page (C3), gift card redeem, overview numbers, admin gift cards. Prices pinned to THB.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "THB")); });

async function createCards(page: Page, amount: string, count: number, note = "") {
  await page.goto("admin/gift-cards/");
  await expect(page.getByRole("heading", { name: "Gift cards", exact: true })).toBeVisible();
  await page.locator("input[name=amount]").fill(amount);
  await page.locator("input[name=count]").fill(String(count));
  if (note) await page.locator("input[name=note]").fill(note);
  await page.getByRole("button", { name: "Create gift cards" }).click();
  await expect(page.getByText("Copy the codes now.")).toBeVisible();
  const codes = await page.locator(".gc-codes code").allTextContents();
  expect(codes).toHaveLength(count);
  for (const c of codes) expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  return codes;
}
const redeem = async (page: Page, code: string) => {
  await page.getByLabel("Gift card code").fill(code);
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
};

test("admin creates gift cards, customer redeems, balances + transactions update, admin sees redeemed / disabled", async ({ page }) => {
  await signInDemoAdmin(page);
  const [code, spare] = await createCards(page, "250", 2, "E2E batch");
  const [active, disabled] = [code, spare];
  await page.locator(".gc-table tr", { hasText: disabled.slice(-4) }).getByRole("button", { name: "Disable" }).click();
  await expect(page.locator(".gc-table tr", { hasText: disabled.slice(-4) })).toContainText("Disabled");
  await expect(page.locator(".gc-table tr", { hasText: "E2E batch" })).toHaveCount(2);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/admin\/login/);

  const email = await registerAndVerify(page);
  await expect(page.getByTestId("total-balance")).toHaveText("฿0.00");
  await page.getByRole("link", { name: "Redeem a gift card" }).click();
  await expect(page).toHaveURL(/account\/balance\/?#redeem/);
  await expect(page.getByLabel("Gift card code")).toBeFocused();
  await expect(page.getByText("No transactions yet.")).toBeVisible();

  await redeem(page, active.toLowerCase().replace(/-/g, " "));
  await expect(page.getByText("฿250.00 added to your gift card balance.")).toBeVisible();
  await expect(page.getByTestId("gift-balance")).toHaveText("฿250.00");
  await expect(page.getByTestId("wallet-balance")).toHaveText("฿0.00");
  const row = page.locator(".bal-table tbody tr").first();
  await expect(row).toContainText("Gift card redeemed");
  await expect(row).toContainText(`••••-••••-••••-${active.slice(-4)}`);
  await expect(row).toContainText("+฿250.00");

  await redeem(page, active);
  await expect(page.getByText("This gift card was already redeemed.")).toBeVisible();
  await redeem(page, disabled);
  await expect(page.getByText("This gift card is disabled.", { exact: false })).toBeVisible();
  await noHorizontalScroll(page);

  await page.goto("account/");
  await expect(page.getByTestId("total-balance")).toHaveText("฿250.00");
  await expect(page.getByTestId("overview-gift")).toHaveText("฿250.00");

  await signInDemoAdmin(page);
  await page.goto("admin/gift-cards/");
  const redeemed = page.locator(".gc-table tr", { hasText: email });
  await expect(redeemed).toContainText("Redeemed");
  await expect(redeemed.getByRole("button")).toHaveCount(0);
  await page.getByLabel("Status").selectOption({ label: "Redeemed (1)" });
  await expect(page.locator(".gc-table tbody tr")).toHaveCount(1);
  await noHorizontalScroll(page);
});

test("redeem: demo code, bad format, not found, rate limit", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/balance/");
  await expect(page.getByRole("button", { name: "Redeem", exact: true })).toBeDisabled();
  await redeem(page, "CCDM-GIFT-2026-0500");
  await expect(page.getByText("฿500.00 added to your gift card balance.")).toBeVisible();
  await expect(page.getByTestId("gift-balance")).toHaveText("฿500.00");
  for (let i = 0; i < 4; i++) {
    await redeem(page, `ZZZZ-ZZZZ-ZZZZ-ZZZ${i}`);
    await expect(page.getByText("This gift card code was not found.", { exact: false })).toBeVisible();
  }
  await redeem(page, "ZZZZ-ZZZZ-ZZZZ-ZZZ9");
  await expect(page.getByText("Too many attempts. Wait 10 minutes and try again.")).toBeVisible();
  await page.reload();
  await expect(page.locator(".bal-table tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("gift-balance")).toHaveText("฿500.00");
});
