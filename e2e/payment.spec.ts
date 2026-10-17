import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Handoff v12 step 2d: payment page UI; step 6 (wireframe order-pay approved 2026-10-08): CoreCart wallet first + PayPal / card / Apple Pay /
// Google Pay with the existing logo images. Card fields stay disabled placeholders (the provider's form later). Demo = test mode (Simulate).
const gate = (page: Page) => page.getByRole("dialog").filter({ has: page.locator("#gate-title") });

async function toPayment(page: Page, isMobile: boolean) {
  await page.goto("product/?id=key-elden-ring-steam");
  await page.locator(".pdp-actions, .pdp-sticky").getByRole("button", { name: "Add to cart" }).first().click();
  await registerAndVerify(page);
  await page.goto("checkout/");
  await page.getByRole("link", { name: "Continue to payment" }).click();
  await expect(page.getByRole("heading", { name: "Payment", level: 1 })).toBeVisible();
  if (isMobile) await page.locator(".pay-summary-mobile summary").click();
}

test("payment page: wallet first + four methods with logos, card row expands, summary", async ({ page, isMobile }) => {
  await toPayment(page, isMobile);
  const radios = page.getByRole("radiogroup").getByRole("radio");
  await expect(radios).toHaveCount(5);
  await expect(page.locator(".pm-row").first()).toContainText("CoreCart wallet");
  for (const m of ["PayPal", "Credit or debit card", "Apple Pay", "Google Pay"]) await expect(page.locator(".pm-list")).toContainText(m);
  for (const gone of ["PromptPay", "TrueMoney", "Rabbit"]) await expect(page.locator(".pm-list")).not.toContainText(gone);
  for (const logo of ["PayPal", "Visa", "Mastercard", "Apple Pay", "Google Pay"]) await expect(page.locator(".pm-list").getByRole("img", { name: logo, exact: true })).toBeVisible();
  // New account, $0 in the wallet: "No available funds" + Top up, Pay off.
  await page.getByRole("radio", { name: /CoreCart wallet/ }).check();
  await expect(page.locator(".wl-box")).toContainText("No available funds in a wallet");
  await expect(page.locator(".wl-box").getByRole("link", { name: "Top up wallet" })).toBeVisible();
  const pay = page.locator(isMobile ? ".pay-sticky" : ".pay-aside-btn").getByRole("button", { name: /^Pay/ });
  await expect(pay).toBeDisabled();

  await page.getByRole("radio", { name: /Credit or debit card/ }).check();
  await expect(page.locator(".pm-row.is-on")).toContainText("Credit or debit card");
  const fields = page.locator(".pm-fields input");
  await expect(fields).toHaveCount(4);
  for (const f of await fields.all()) await expect(f).toBeDisabled();
  await expect(page.locator(".pm-fields input[name]")).toHaveCount(0); // never posts card data
  await expect(page.getByText("Your payment is secure")).toBeVisible();
  await expect(pay).toHaveText("Pay with Credit or debit card");
  await expect(pay).toBeEnabled(); // demo = test mode: the next screen simulates the provider
  await expect(page.getByText("Test mode: the next screen simulates the payment. No money is taken.")).toBeAttached();
  await page.getByRole("radio", { name: /PayPal/ }).check();
  await expect(page.locator(".pm-fields")).toHaveCount(0);
  await expect(page.getByText("You will continue to PayPal to confirm the payment.")).toBeVisible();

  const summary = page.locator(isMobile ? ".pay-summary-mobile" : ".pay-summary");
  await expect(summary).toContainText("Elden Ring");
  await expect(summary).toContainText("Digital product");
  await expect(summary).toContainText("Sub-total");
  await expect(summary).toContainText("Service fee");
  await expect(summary.locator(".pay-email")).toContainText("@example.com");
  await expect(summary.getByRole("link", { name: "here" })).toHaveAttribute("href", /help\/gift-card-fraud/);
  await summary.getByRole("button", { name: "Increase quantity of Elden Ring" }).click();
  await expect(summary.locator(".pay-items output")).toHaveText("2");
  await expect(page.getByRole("link", { name: /^Shopping cart/ })).toHaveAccessibleName("Shopping cart, 2 items");
  await noHorizontalScroll(page);
});

test("payment page: signed out opens the gate; fraud help page", async ({ page }) => {
  await page.goto("product/?id=key-elden-ring-steam");
  await page.locator(".pdp-actions, .pdp-sticky").getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto("checkout/payment/");
  await expect(gate(page).getByRole("heading", { name: "Almost there" })).toBeVisible();
  await page.goto("help/gift-card-fraud/");
  await expect(page.getByRole("heading", { name: "Stay safe from gift card fraud" })).toBeVisible();
});
