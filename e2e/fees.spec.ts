import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Task 7 (wireframe approved 2026-09-30, user answers 2026-09-30): one admin-set service fee for all products + sales tax added on top
// (default rate + per billing country). Both start off. Lines in cart, checkout, payment, order page, receipt and order email. Desktop + mobile.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "THB")); });
const ON = { feeEnabled: true, feePercentBp: 250, feeFixedMinor: 1000, feeMinMinor: 0, taxEnabled: true, taxDefaultBp: 0, taxRates: [{ country: "TH", rateBp: 700 }] };
async function seedFees(page: Page, fees: object) {
  await page.goto("");
  await page.evaluate((fees) => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}"); s.fees = fees; localStorage.setItem(k, JSON.stringify(s)); }, fees);
}
const baht = (t: string | null) => Number((t ?? "").replace(/[^\d.]/g, ""));
async function addElden(page: Page) {
  await page.goto("product/?id=key-elden-ring-steam");
  await page.locator(".pdp-actions, .pdp-sticky").getByRole("button", { name: "Add to cart" }).first().click();
}

test("admin Fees & tax: off by default, edit fee + tax, live example, validation, save + history, kept after reload", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/fees/");
  await expect(page.getByRole("heading", { name: "Fees & tax", level: 1 })).toBeVisible();
  const feeSwitch = page.getByRole("switch", { name: "Service fee" }), taxSwitch = page.getByRole("switch", { name: "Sales tax" });
  await expect(feeSwitch).toHaveAttribute("aria-checked", "false");
  await expect(taxSwitch).toHaveAttribute("aria-checked", "false");
  await feeSwitch.click();
  await page.getByLabel("Percent of the order (%)").fill("2.5");
  await page.getByLabel("Fixed amount (฿)").fill("10");
  await taxSwitch.click();
  await page.getByRole("button", { name: "+ Add country rate" }).click();
  await expect(page.getByLabel("Country 1")).toHaveValue("TH");
  await page.getByLabel("Rate for Thailand (%)").fill("7");
  // Example: ฿1,000 → fee 2.5% + ฿10 = ฿35.00; tax 7% of ฿1,035 = ฿72.45; total ฿1,107.45.
  const ex = page.getByTestId("fees-example");
  await expect(ex).toContainText("฿35.00"); await expect(ex).toContainText("฿72.45"); await expect(ex).toContainText("฿1,107.45");
  await page.getByLabel("Percent of the order (%)").fill("abc");
  await expect(page.getByText("Numbers only, up to 2 decimals")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.getByLabel("Percent of the order (%)").fill("2.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. New orders use these settings")).toBeVisible();
  const hist = page.locator(".pp-history li").first();
  await expect(hist).toContainText("Service fee turned on"); await expect(hist).toContainText("Sales tax turned on"); await expect(hist).toContainText("Tax TH 7% added");
  await noHorizontalScroll(page);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Service fee" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Percent of the order (%)")).toHaveValue("2.5");
  await expect(page.getByLabel("Rate for Thailand (%)")).toHaveValue("7");
});

test("fee + tax off (default): no fee line in the cart, 'Service fee ฿0.00' on the payment page, no tax line", async ({ page, isMobile }) => {
  await addElden(page);
  await page.goto("cart/");
  const sum = page.locator(".cart-summary");
  await expect(sum).not.toContainText("Service fee");
  await expect(sum).not.toContainText("Sales tax");
  await registerAndVerify(page);
  await page.goto("checkout/payment/");
  if (isMobile) await page.locator(".pay-summary-mobile summary").click();
  const pay = page.locator(isMobile ? ".pay-summary-mobile" : ".pay-summary");
  await expect(pay.locator(".fee-line")).toContainText("฿0.00");
  await expect(pay.locator(".tax-line")).toHaveCount(0);
});

test("fee + tax on: cart 'Calculated at payment' + Estimated total; payment page adds 7% Thai tax from the billing address; totals add up", async ({ page, isMobile }) => {
  await seedFees(page, ON);
  await addElden(page);
  await page.goto("cart/");
  const sum = page.locator(".cart-summary");
  await expect(sum.locator(".fee-line")).toContainText("Service fee");
  await expect(sum.locator(".tax-line")).toContainText("Calculated at payment");
  await expect(page.locator(".cart-total")).toContainText("Estimated total");
  const sub = baht(await sum.locator("dl > div").first().locator("dd").textContent()); const fee = baht(await sum.locator(".fee-line dd").textContent());
  expect(fee).toBeCloseTo(Math.round(sub * 2.5) / 100 + 10, 2);
  expect(baht(await page.locator(".cart-total strong").textContent())).toBeCloseTo(sub + fee, 2);
  await noHorizontalScroll(page);

  await registerAndVerify(page);
  await page.goto("checkout/payment/");
  await page.getByRole("radio", { name: /Credit or debit card/ }).check();
  const ba = page.getByRole("group", { name: "Billing address" });
  await ba.locator("input[name=line1]").fill("1 Silom Road"); await ba.locator("input[name=subdistrict]").fill("Silom"); await ba.locator("input[name=district]").fill("Bang Rak");
  await ba.locator("select[name=region]").selectOption("Bangkok"); await ba.locator("input[name=postcode]").fill("10500");
  if (isMobile) await page.locator(".pay-summary-mobile summary").click();
  const pay = page.locator(isMobile ? ".pay-summary-mobile" : ".pay-summary");
  await expect(pay.locator(".tax-line")).toContainText("Sales tax 7%");
  await expect(pay.locator(".billing-line")).toContainText("Bangkok 10500");
  const tax = baht(await pay.locator(".tax-line dd").textContent());
  expect(tax).toBeCloseTo(Math.round((sub + fee) * 7) / 100, 2);
  expect(baht(await pay.locator(".pay-total strong").textContent())).toBeCloseTo(sub + fee + tax, 2);
  // Another billing country without its own rate → default 0%.
  await ba.getByLabel("Country").selectOption("GB");
  await expect(pay.locator(".tax-line")).toContainText("Sales tax 0%");
  await noHorizontalScroll(page);
});

test("paid order keeps fee, tax and billing: order page, receipt and order email", async ({ page }) => {
  await seedFees(page, ON);
  const email = await registerAndVerify(page);
  await page.goto("account/payment-methods/");
  const ba = page.getByRole("group", { name: "Billing address" });
  await ba.locator("input[name=line1]").fill("1 Silom Road"); await ba.locator("input[name=subdistrict]").fill("Silom"); await ba.locator("input[name=district]").fill("Bang Rak");
  await ba.locator("select[name=region]").selectOption("Bangkok"); await ba.locator("input[name=postcode]").fill("10500");
  await expect(ba.getByText("✓ Saved to your account")).toBeVisible();
  await page.goto("account/orders/");
  await page.getByRole("button", { name: "Add sample order (test only)" }).click();
  await expect(page.locator(".orders-table > tbody > tr")).toHaveCount(3);
  const order = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("corecart-demo-v1")!); return s.orders[s.sessionUserId][0]; });
  expect(order.serviceFeeMinor).toBeGreaterThan(0); expect(order.taxMinor).toBeGreaterThan(0); expect(order.taxRateBp).toBe(700); expect(order.billing.postcode).toBe("10500");
  expect(order.totalCents).toBe(order.subtotalMinor + order.serviceFeeMinor + order.taxMinor);
  await page.goto(`account/orders/view/?id=${order.id}`);
  const sum = page.locator(".ord-sum");
  await expect(sum).toContainText("Service fee"); await expect(sum).toContainText("Sales tax (7%, TH)"); await expect(sum).toContainText("Bangkok 10500, TH");
  await noHorizontalScroll(page);
  await page.goto(`account/orders/receipt/?id=${order.id}`);
  await expect(page.locator("main")).toContainText("Sales tax (7%, TH)");
  const mail = await page.evaluate((to) => { const s = JSON.parse(localStorage.getItem("corecart-demo-v1")!); return (s.outbox ?? []).filter((m: { to: string; template: string }) => m.to === to && m.template === "orderConfirmed").pop(); }, email);
  expect(mail.html).toContain("Service fee:"); expect(mail.html).toContain("Sales tax (7%, TH):"); expect(mail.html).toContain("Bangkok 10500, TH");
});
