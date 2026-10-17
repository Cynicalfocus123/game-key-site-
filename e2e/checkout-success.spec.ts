import { expect, test } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// F38 (user 2026-10-02 / 2026-10-17): after a purchase the processing screen shows the happy astronaut cat + "Payment confirmed!",
// then the buyer goes on to the key. Wallet purchase (step 6 checkout, demo store = same rules as the server). Desktop + mobile, no skips.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "THB")); });

test("pay with wallet → cat + Payment confirmed → Get your key opens the reveal page; wallet debited", async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await registerAndVerify(page);
  await page.evaluate(() => { // ฿3,000 in the wallet (a top-up)
    const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k)!); const uid = s.sessionUserId;
    (s.ledger[uid] ??= []).push({ id: "seed-topup", createdAt: new Date().toISOString(), bucket: "wallet", type: "top_up", ref: "TU-SEED", amountMinor: 300000 });
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto("product/?id=key-elden-ring-steam");
  await page.locator(isMobile ? ".pdp-sticky" : ".pdp-actions").getByRole("button", { name: "Add to cart" }).click();
  await page.goto("checkout/payment/");
  await page.getByRole("radio", { name: /CoreCart wallet/ }).check();
  await expect(page.locator(".wl-box")).toContainText("Balance after paying");
  await page.locator(isMobile ? ".pay-sticky" : ".pay-aside-btn").getByRole("button", { name: "Pay with wallet" }).click();
  await page.waitForURL(/checkout\/processing\/?\?order=/);
  const ok = page.locator(".proc-ok");
  await expect(ok.getByRole("heading", { name: "Payment confirmed!" })).toBeVisible();
  await expect(ok.getByRole("img", { name: /astronaut cat/ })).toBeVisible();
  await expect(ok).toContainText("your keys are in your Keys library");
  await noHorizontalScroll(page);
  await expect(page.getByRole("list", { name: "Checkout steps" }).locator(".proc-step.is-done")).toHaveCount(3); // all 3 steps ticked
  await page.waitForTimeout(600); // cat fade-in done
  await page.screenshot({ path: `D:/dev/tmp/step5/shots/success-${isMobile ? "phone" : "desktop"}.png` });
  await ok.getByRole("link", { name: "Get your key" }).click();
  await page.waitForURL(/account\/keys\/get\/?\?item=/);
  await expect(page.getByRole("heading", { name: "Manual activation" })).toBeVisible();
  await page.goto("account/balance/");
  await expect(page.locator("body")).toContainText("Purchase"); // the wallet ledger row
});

test("hardware paid with wallet → cat + 'waiting for delivery confirmation' + email line, View order", async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  const email = await registerAndVerify(page);
  await page.evaluate(() => { // ฿10,000 in the wallet
    const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k)!); const uid = s.sessionUserId;
    (s.ledger[uid] ??= []).push({ id: "seed-topup", createdAt: new Date().toISOString(), bucket: "wallet", type: "top_up", ref: "TU-SEED", amountMinor: 1000000 });
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto("product/?id=hw-990-pro-2tb");
  await page.locator(isMobile ? ".pdp-sticky" : ".pdp-actions").getByRole("button", { name: "Add to cart" }).click();
  await page.goto("checkout/payment/");
  await page.getByRole("radio", { name: /CoreCart wallet/ }).check();
  await page.locator(isMobile ? ".pay-sticky" : ".pay-aside-btn").getByRole("button", { name: "Pay with wallet" }).click();
  const ok = page.locator(".proc-ok");
  await expect(ok.getByRole("heading", { name: "Payment confirmed!" })).toBeVisible();
  await expect(ok).toContainText("waiting for delivery confirmation");
  await expect(ok).toContainText(`We will notify you via email ${email}`);
  await expect(ok.getByRole("link", { name: "View order" })).toBeVisible();
  await noHorizontalScroll(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `D:/dev/tmp/step5/shots/success-hw-${isMobile ? "phone" : "desktop"}.png` });
});
