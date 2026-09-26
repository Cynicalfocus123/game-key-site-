import { expect, test, type Page } from "@playwright/test";
import { convertMinor, crossRate, formatMoney } from "../lib/currency/money";
import { registerAndVerify, signInDemoAdmin } from "./helpers";

// Fixed rates (units per 1 USD) so prices are predictable. Homepage first card = ฿26,990.00 (2,699,000 satang).
const rates = { THB: 32, USD: 1, JPY: 150, KWD: 0.3, EUR: 0.9, AED: 3.6725 };
async function fixRates(page: Page) {
  await page.route("**/rates.json", (r) => r.fulfill({ json: { source: "test", base: "USD", updatedAt: "2026-09-26T00:00:00.000Z", rates } }));
}
const firstPrice = (page: Page) => page.locator(".product [data-price]").first();

test.describe("conversion math", () => {
  test.skip(({ isMobile }) => isMobile, "pure math, run once");
  const thb = { code: "THB", decimals: 2, rate: "33.380213" };
  test("THB → USD, JPY (0 decimals), KWD (3 decimals)", () => {
    expect(convertMinor(99000, thb, { code: "USD", decimals: 2, rate: "1" })).toBe(2966); // ฿990 → $29.66
    expect(convertMinor(99000, thb, { code: "JPY", decimals: 0, rate: "157.539759" })).toBe(4672); // ¥4,672
    expect(convertMinor(99000, thb, { code: "KWD", decimals: 3, rate: "0.308492" })).toBe(9149); // KD 9.149
    expect(formatMoney(4672, { code: "JPY", decimals: 0, symbol: "¥" })).toBe("¥4,672");
    expect(formatMoney(9149, { code: "KWD", decimals: 3, symbol: "KD" })).toBe("KD 9.149");
    expect(formatMoney(123456789, { code: "THB", decimals: 2, symbol: "฿" })).toBe("฿1,234,567.89");
  });
  test("rounding: halves go up, rounding step, rate used", () => {
    const usd = { code: "USD", decimals: 2, rate: "1" };
    expect(convertMinor(50, { code: "THB", decimals: 2, rate: "100" }, usd)).toBe(1); // 0.005 → 0.01
    expect(convertMinor(49, { code: "THB", decimals: 2, rate: "100" }, usd)).toBe(0);
    expect(convertMinor(99000, thb, { code: "JPY", decimals: 0, rate: "157.539759", roundStep: 10 })).toBe(4670);
    expect(convertMinor(1234, usd, usd)).toBe(1234);
    expect(crossRate({ code: "THB", decimals: 2, rate: "32" }, usd)).toBe("0.03125");
  });
});

test.describe("currency selector", () => {
  test.use({ locale: "en-US", timezoneId: "America/New_York" }); // US visitor → USD first (this PC is in Bangkok)
  test.beforeEach(async ({ page }) => fixRates(page));

  test("desktop: switch to JPY in the header, prices update, choice survives reload", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop header only");
    await page.goto("");
    await expect(firstPrice(page)).toHaveText("$843.44");
    await page.getByRole("button", { name: /Settings\. Currency USD/ }).click();
    await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: /^Currency/ }).click();
    await page.getByPlaceholder("Search currency").fill("yen");
    await page.getByRole("button", { name: /^JPY/ }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
    await expect(firstPrice(page)).toHaveText("¥126,516");
    await expect(page.locator(".topbar [data-price]")).toHaveText("¥5,625");
    await page.reload();
    await expect(firstPrice(page)).toHaveText("¥126,516");
    await page.getByRole("button", { name: /Settings\. Currency JPY/ }).click();
    await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: /^Currency/ }).click();
    await expect(page.getByRole("button", { name: /^JPY/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Payment in JPY is not available yet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
  });

  test("mobile: drawer row opens full list, THB picked, survives reload", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile drawer only");
    await page.goto("");
    await page.getByRole("button", { name: "Open products menu" }).click();
    await page.getByRole("button", { name: /^Currency USD/ }).click();
    const sheet = page.getByRole("dialog", { name: "Choose currency" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /^THB/ }).click();
    await expect(sheet).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(firstPrice(page)).toHaveText("฿26,990.00");
    await page.reload();
    await expect(firstPrice(page)).toHaveText("฿26,990.00");
  });

  test("account orders show charged USD plus converted reference", async ({ page }) => {
    await registerAndVerify(page);
    await page.evaluate(() => localStorage.setItem("corecart-currency", "EUR"));
    await page.goto("account/orders/");
    const total = page.locator(".order-total").first();
    await expect(total).toContainText("$");
    await expect(total).toContainText("≈ €");
  });
});

test.describe("auto-pick by country", () => {
  test.use({ locale: "th-TH", timezoneId: "Asia/Bangkok" });
  test("Bangkok visitor sees THB first", async ({ page }) => {
    await fixRates(page);
    await page.goto("");
    await expect(firstPrice(page)).toHaveText("฿26,990.00");
  });
});

test("admin: currencies table, disabling JPY hides it from the selector", async ({ page, isMobile }) => {
  test.skip(isMobile, "admin table checked on desktop");
  await fixRates(page);
  await signInDemoAdmin(page);
  await page.goto("admin/currencies/");
  await expect(page.locator(".adm-cur-table tbody tr")).toHaveCount(53);
  await page.getByRole("switch", { name: "JPY enabled" }).click();
  await expect(page.getByText("JPY saved.")).toBeVisible();
  await expect(page.getByRole("switch", { name: "JPY enabled" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: "USD enabled" })).toBeDisabled();
  await page.goto("");
  await page.getByRole("button", { name: /Settings\. Currency/ }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: /^Currency/ }).click();
  await expect(page.getByRole("button", { name: /^EUR/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^JPY/ })).toHaveCount(0);
});
