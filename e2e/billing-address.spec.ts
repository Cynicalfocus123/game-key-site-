import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Task 5 (wireframe approved 2026-09-30): billing address under the card form + on Payment methods. Fields follow the country
// (lib/address-formats.ts), Thai labels English + Thai, a new complete address is always saved to the account. Desktop and mobile, no skips.
async function toPayment(page: Page) {
  await page.goto("product/?id=key-elden-ring-steam");
  await page.locator(".pdp-actions, .pdp-sticky").getByRole("button", { name: "Add to cart" }).first().click();
  await registerAndVerify(page);
  await page.goto("checkout/payment/");
  await expect(page.getByRole("heading", { name: "Payment", level: 1 })).toBeVisible();
  await page.getByRole("radio", { name: /Credit or debit card/ }).check();
}
const section = (page: Page) => page.getByRole("group", { name: "Billing address" });
const labels = (page: Page) => section(page).locator(".ba-grid .field > span").allInnerTexts();
const clean = (l: string[]) => l.map((x) => x.replace(/\s*\*$/, "").replace(" (optional)", "").trim());

test("payment page: Thai billing address (English + Thai labels), postcode error, saved to the account, summary line", async ({ page, isMobile }) => {
  await toPayment(page);
  const s = section(page);
  await expect(s).toBeVisible();
  await expect(page.locator(".pm-secure")).toBeVisible();
  await expect(s.getByLabel("Country")).toHaveValue("TH"); // no account country → the store's country
  expect(clean(await labels(page))).toEqual(["Country", "Address (house no., building, street) · ที่อยู่", "Sub-district · ตำบล / แขวง", "District · อำเภอ / เขต", "Province · จังหวัด", "Postcode · รหัสไปรษณีย์"]);
  await expect(s.locator("select[name=region] option")).toHaveCount(78); // "Choose…" + 77 provinces
  await expect(s.locator("select[name=region]")).toContainText("Bangkok · กรุงเทพมหานคร");
  // Required error after leaving an empty field.
  await s.locator("input[name=line1]").focus(); await s.locator("input[name=subdistrict]").focus();
  await expect(s.getByText("Enter address (house no., building, street).")).toBeVisible();
  await s.locator("input[name=line1]").fill("99/1 ถนนสุขุมวิท");
  await s.locator("input[name=subdistrict]").fill("Khlong Toei Nuea");
  await s.locator("input[name=district]").fill("Watthana");
  await s.locator("select[name=region]").selectOption("Bangkok");
  await s.locator("input[name=postcode]").fill("1011");
  await s.locator("input[name=postcode]").blur();
  await expect(s.getByText("Postcode is not valid (example: 10110).")).toBeVisible();
  await expect(s.locator("input[name=postcode]")).toHaveAttribute("aria-invalid", "true");
  await s.locator("input[name=postcode]").fill("10110");
  await expect(s.getByText("✓ Saved to your account")).toBeVisible();
  const summary = page.locator(isMobile ? ".pay-summary-mobile" : ".pay-summary");
  if (isMobile) await page.locator(".pay-summary-mobile summary").click();
  await expect(summary.locator(".billing-line")).toContainText("Bangkok 10110");
  await noHorizontalScroll(page);
  // Saved on the account: after a reload the form comes back filled.
  await page.reload();
  await page.getByRole("radio", { name: /Credit or debit card/ }).check();
  await expect(section(page).locator("input[name=line1]")).toHaveValue("99/1 ถนนสุขุมวิท");
  await expect(section(page).locator("input[name=postcode]")).toHaveValue("10110");
  await expect(section(page).locator("select[name=region]")).toHaveValue("Bangkok");
  // Other methods: no billing form (the provider collects it).
  await page.getByRole("radio", { name: /PayPal/ }).check();
  await expect(section(page)).toHaveCount(0);
});

test("country picker changes fields, order, labels and required marks (UA, US, GB, JP, DE, HK)", async ({ page }) => {
  await toPayment(page);
  const s = section(page); const country = s.getByLabel("Country");
  const cases: [string, string[]][] = [
    ["UA", ["Country", "Street", "House no.", "Flat", "City / town", "Oblast (region)", "Postcode"]],
    ["US", ["Country", "Address line 1", "Apt, suite, unit", "City", "State", "ZIP code"]],
    ["GB", ["Country", "Address line 1", "Address line 2", "Town / city", "Postcode", "County"]],
    ["JP", ["Country", "Postcode 〒", "Prefecture", "City / ward", "Town, chome, block, no.", "Building, room"]],
    ["DE", ["Country", "Street", "House no.", "Address line 2", "Postcode", "City"]],
    ["HK", ["Country", "Flat, floor, building", "Street", "District", "Area"]],
  ];
  for (const [code, want] of cases) {
    await country.selectOption(code);
    expect(clean(await labels(page)), code).toEqual(want);
    await noHorizontalScroll(page);
  }
  // Required marks: UA flat optional, house required; HK has no postcode field at all.
  await country.selectOption("UA");
  await expect(s.locator(".field", { hasText: "Flat" })).toContainText("(optional)");
  await expect(s.locator(".field", { hasText: "House no." }).locator(".ba-req")).toHaveCount(1);
  await country.selectOption("HK");
  await expect(s.locator("input[name=postcode]")).toHaveCount(0);
  // US: state list + ZIP rule.
  await country.selectOption("US");
  await expect(s.locator("select[name=region] option")).toHaveCount(52); // "Choose…" + 50 states + DC
  await s.locator("input[name=postcode]").fill("9066");
  await s.locator("input[name=postcode]").blur();
  await expect(s.getByText("ZIP code is not valid (example: 90660).")).toBeVisible();
  // Values typed in fields both layouts share are kept (city).
  await s.locator("input[name=city]").fill("Los Angeles");
  await country.selectOption("CA");
  await expect(s.locator("input[name=city]")).toHaveValue("Los Angeles");
});

test("Payment methods page: billing address section saves automatically and stays after reload", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/payment-methods/");
  const s = section(page);
  await s.getByLabel("Country").selectOption("GB");
  await s.locator("input[name=line1]").fill("10 Downing Street");
  await s.locator("input[name=city]").fill("London");
  await s.locator("input[name=postcode]").fill("sw1a 2aa");
  await expect(s.getByText("✓ Saved to your account")).toBeVisible();
  await page.reload();
  await expect(section(page).getByLabel("Country")).toHaveValue("GB");
  await expect(section(page).locator("input[name=postcode]")).toHaveValue("SW1A 2AA"); // saved in upper case
  await noHorizontalScroll(page);
});
