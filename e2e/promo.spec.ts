import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, signInDemoAdmin } from "./helpers";

// Handoff v12 step 3b: admin promo codes (list + create/edit with live Summary) and storefront use (eligible lines, min order, live re-check).
// The demo admin shops too: demo sessions are per browser, so admin + shopper share one account here. Prices pinned to THB.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { if (!localStorage.getItem("corecart-currency")) localStorage.setItem("corecart-currency", "THB"); }); });

const add = async (page: Page, name: string) => {
  await page.goto("");
  await page.getByRole("button", { name: `Add to cart: ${name}` }).first().click();
  if (await page.locator(".cart-sheet").isVisible()) await page.getByRole("dialog", { name: "Added to cart" }).getByRole("button", { name: "Continue shopping" }).click();
};
const applyCode = async (page: Page, code: string) => {
  const box = page.locator(".cart-summary");
  await expect(box.getByText("Have a coupon?")).toBeVisible();
  if (!(await box.getByLabel("Coupon code").isVisible())) await box.getByText("Have a coupon?").click();
  await box.getByLabel("Coupon code").fill(code);
  await box.getByRole("button", { name: "Apply" }).click();
};
async function createPromo(page: Page, fill: (page: Page) => Promise<void>) {
  await page.goto("admin/promo-codes/");
  await page.getByRole("link", { name: "Create promo code" }).click();
  await expect(page.getByRole("heading", { name: "Create promo code", level: 1 })).toBeVisible();
  await fill(page);
  await page.getByRole("button", { name: "Create promo code" }).click();
  await expect(page.getByText(/saved\.$/)).toBeVisible();
}
const menu = async (page: Page, code: string, action: string) => {
  await page.getByText(`Actions for ${code}`).or(page.getByLabel(`Actions for ${code}`)).first().click();
  await page.getByRole("button", { name: action, exact: true }).click();
};

test("category code: scope note, discount on eligible lines only, disabled / deleted code leaves open carts", async ({ page, context }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/promo-codes/");
  await expect(page.locator(".pc-table")).toContainText("WELCOME10");
  await createPromo(page, async (p) => {
    await p.getByLabel("Promo code").fill("games20");
    await p.getByLabel("Percentage off").fill("20");
    await p.getByLabel("Specific categories").check();
    await p.getByLabel("Digital games").check();
    await expect(p.locator(".pc-summary")).toContainText("GAMES20");
    await expect(p.locator(".pc-summary")).toContainText("20% off Digital games");
    await expect(p.locator(".pc-summary")).toContainText("No end date");
  });
  const row = page.locator(".pc-table tr", { hasText: "GAMES20" });
  await expect(row).toContainText("Digital games");
  await expect(row).toContainText("Active");
  await noHorizontalScroll(page);

  await add(page, "Samsung 990 PRO 2TB NVMe SSD");
  await page.goto("cart/");
  await applyCode(page, "GAMES20");
  await expect(page.getByText("GAMES20 applies to Digital games only.")).toBeVisible();
  await expect(page.locator(".coupon-line dd")).toHaveText("—");
  await add(page, "Elden Ring");
  await page.goto("cart/");
  await expect(page.locator(".coupon-line dt")).toContainText("Coupon GAMES20 (Digital games)");
  await expect(page.locator(".coupon-line dd")).toHaveText("−฿198.00"); // 20% of ฿990 only
  await page.goto("checkout/");
  await expect(page.locator(".coupon-line dd")).toHaveText("−฿198.00");
  await page.goto("cart/");

  const admin = await context.newPage();
  await admin.goto("admin/promo-codes/");
  await menu(admin, "GAMES20", "Disable");
  await expect(admin.locator(".pc-table tr", { hasText: "GAMES20" })).toContainText("Disabled");
  await page.bringToFront(); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Code GAMES20 is no longer valid.")).toBeVisible();
  await expect(page.locator(".coupon-line")).toHaveCount(0);
  await applyCode(page, "GAMES20");
  await expect(page.getByText("This code is not active.")).toBeVisible();

  await applyCode(page, "WELCOME10");
  await expect(page.locator(".coupon-line dt")).toContainText("Coupon WELCOME10");
  await menu(admin, "WELCOME10", "Delete");
  await expect(admin.getByRole("dialog", { name: "Delete WELCOME10?" })).toContainText("Carts using it lose the discount.");
  await admin.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(admin.getByText("WELCOME10 deleted.")).toBeVisible();
  await page.bringToFront(); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Code WELCOME10 is no longer valid.")).toBeVisible();
  await applyCode(page, "WELCOME10");
  await expect(page.getByText("This code was not found.")).toBeVisible();
});

test("fixed code: minimum order, currency switch, expiry through edit", async ({ page }) => {
  await signInDemoAdmin(page);
  await createPromo(page, async (p) => {
    await p.getByLabel("Promo code").fill("FIX200");
    await p.getByRole("radio", { name: "Fixed amount" }).click();
    await p.getByLabel("Amount off (THB)").fill("200");
    await p.getByLabel("Minimum order amount", { exact: true }).check();
    await p.getByLabel("Minimum order amount (THB)").fill("1000");
    await p.getByLabel("Limit the total number of uses").check();
    await p.getByLabel("Total uses").fill("100");
    await p.getByLabel("One use per customer").check();
    await expect(p.locator(".pc-summary")).toContainText("฿200.00 off all products");
    for (const t of ["Min order ฿1,000.00", "100 uses total", "1 per customer"]) await expect(p.locator(".pc-summary")).toContainText(t);
  });
  await expect(page.locator(".pc-table tr", { hasText: "FIX200" })).toContainText("0 / 100");

  await add(page, "Cyberpunk 2077");
  await page.goto("cart/");
  await applyCode(page, "fix200");
  await expect(page.getByText("Minimum order ฿1,000.00 for this code.")).toBeVisible();
  await add(page, "Elden Ring");
  await page.goto("cart/");
  await applyCode(page, "FIX200");
  await expect(page.locator(".coupon-line dd")).toHaveText("−฿200.00");
  await expect(page.locator(".cart-total [data-price]")).toHaveText("฿1,419.00");
  await page.evaluate(() => { // account currency wins over the browser choice
    const s = JSON.parse(localStorage.getItem("corecart-demo-v1")!); s.users.find((u: { id: string }) => u.id === "demo-admin").currency = "USD";
    localStorage.setItem("corecart-demo-v1", JSON.stringify(s)); localStorage.setItem("corecart-currency", "USD");
  });
  await page.reload();
  await expect(page.locator(".coupon-line dd")).toContainText("−$");
  await page.getByRole("button", { name: "Remove Elden Ring" }).click();
  await expect(page.getByText(/Add .* more to use FIX200\./)).toBeVisible();
  await expect(page.locator(".coupon-line dd")).toHaveText("—");

  await page.goto("admin/promo-codes/");
  await page.getByRole("link", { name: "FIX200" }).click();
  await expect(page.getByRole("heading", { name: "Edit promo code" })).toBeVisible();
  await page.locator("input[name=startsAt]").fill("2026-01-01T00:00");
  await page.getByLabel("Set end date").check();
  await page.locator("input[name=endsAt]").fill("2026-01-02T00:00");
  await expect(page.locator(".pc-summary")).toContainText("Ends 2 Jan 2026");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".pc-table tr", { hasText: "FIX200" })).toContainText("Expired");
  await page.goto("cart/");
  await expect(page.getByText("Code FIX200 is no longer valid.")).toBeVisible();
});

test("editor validation: required fields, percent range, taken code, end before start, duplicate", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/promo-codes/edit/");
  await page.getByRole("button", { name: "Create promo code" }).click();
  await expect(page.getByText("Use 3–32 letters, numbers or dashes.")).toBeVisible();
  await expect(page.getByText("Enter a percentage from 1 to 100.")).toBeVisible();
  await page.getByLabel("Promo code").fill("WELCOME10");
  await page.getByLabel("Percentage off").fill("150");
  await expect(page.getByText("Enter a percentage from 1 to 100.")).toBeVisible();
  await page.getByLabel("Percentage off").fill("15");
  await page.getByLabel("Set end date").check();
  await page.locator("input[name=endsAt]").fill("2020-01-01T00:00");
  await expect(page.getByText("End date must be after the start date.")).toBeVisible();
  await page.getByLabel("Set end date").uncheck();
  await page.getByRole("button", { name: "Create promo code" }).click();
  await expect(page.getByText("This code is already taken.")).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByLabel("Promo code")).toHaveValue(/^SAVE-[A-Z0-9]{6}$/);
  await page.getByRole("button", { name: "Create promo code" }).click();
  await expect(page.getByText(/^SAVE-[A-Z0-9]{6} saved\.$/)).toBeVisible();
  await menu(page, "WELCOME10", "Duplicate");
  await expect(page.getByLabel("Promo code")).toHaveValue("WELCOME10-COPY");
  await page.getByRole("button", { name: "Create promo code" }).click();
  await expect(page.getByText("WELCOME10-COPY saved.")).toBeVisible();
  await noHorizontalScroll(page);
});
