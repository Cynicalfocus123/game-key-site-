import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Task 6 (wireframe approved 2026-09-30): processing screen after Pay (?order= / ?topup=). Polls every 3 s: failed → "not completed" here,
// after 2 minutes "Still working — we will email you". F38 (2026-10-17): paid → the page stays and shows the happy astronaut cat +
// "Payment confirmed!" / "Top-up complete!" with buttons (was: jump straight to the order page / top-up result). Desktop and mobile, no skips.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "USD")); });
async function pendingTopUp(page: Page) {
  await page.goto("account/balance/");
  await page.getByRole("button", { name: "Top up $25.00" }).click(); // Wallet preset card (one click starts the top-up)
  await expect(page.getByTestId("tu-status")).toHaveText("Pending");
  return new URL(page.url()).searchParams.get("id")!;
}

test("top-up: spinner + steps while pending, then the top-up result once the provider confirms", async ({ page, context, isMobile }) => {
  await registerAndVerify(page);
  const id = await pendingTopUp(page);
  await page.goto(`checkout/processing/?topup=${id}`);
  const status = page.locator(".proc-stage").getByRole("status");
  await expect(status.getByRole("heading", { name: "This may take a while…" })).toBeVisible();
  await expect(status).toContainText("We are confirming your payment and adding it to your wallet.");
  await expect(page.getByText("Please don't close or refresh this page.")).toBeVisible();
  await expect(page.locator(".proc-ring")).toBeVisible();
  const steps = page.getByRole("list", { name: "Checkout steps" });
  await expect(steps.locator("[aria-current=step]")).toContainText("Wallet updated");
  // Phones: only the current step keeps its label.
  await expect(steps.locator(".proc-step").first().locator(".proc-lbl")).toBeVisible({ visible: !isMobile });
  await expect(page.locator(".site-header, header .header-main")).toHaveCount(0); // no store menu here
  await noHorizontalScroll(page);
  // The provider confirms (another tab = the webhook in the demo): this page moves on by itself.
  const other = await context.newPage();
  await other.goto(`account/balance/top-up/?id=${id}`);
  await other.getByRole("button", { name: "Simulate paid" }).click();
  await expect(other.getByTestId("tu-status")).toHaveText("Credited");
  const ok = page.locator(".proc-ok");
  await expect(ok.getByRole("heading", { name: "Top-up complete!" })).toBeVisible({ timeout: 15_000 });
  await expect(ok.getByRole("img", { name: /astronaut cat/ })).toBeVisible();
  await expect(ok.getByRole("link", { name: "My wallet" })).toHaveAttribute("href", /account\/balance\/?$/);
  await ok.getByRole("link", { name: "Top-up details" }).click();
  await page.waitForURL(new RegExp(`account/balance/top-up/?\\?id=${id}`));
  await expect(page.getByTestId("tu-status")).toHaveText("Credited");
});

test("failed top-up: 'Your payment was not completed', Try again + My wallet", async ({ page }) => {
  await registerAndVerify(page);
  const id = await pendingTopUp(page);
  await page.getByRole("button", { name: "Simulate failed" }).click();
  await expect(page.getByTestId("tu-status")).toHaveText("Failed");
  await page.goto(`checkout/processing/?topup=${id}`);
  const box = page.locator(".proc-stage").getByRole("alert");
  await expect(box.getByRole("heading", { name: "Your payment was not completed" })).toBeVisible();
  await expect(box).toContainText("You were not charged. Your wallet was not changed.");
  await expect(box.getByRole("img", { name: /red cross/ })).toBeVisible(); // worried cat (user 2026-10-17)
  await expect(box.getByRole("link", { name: "Try again" })).toHaveAttribute("href", /account\/balance\/?$/); // back to the Wallet to pick an amount
  await expect(box.getByRole("link", { name: "My wallet" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("order: a paid order shows the cat + Payment confirmed with buttons to the keys / order; unknown id = could not find", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/orders/");
  await page.locator(".orders-table > tbody > tr").first().getByRole("link", { name: /Details/ }).click();
  await page.waitForURL(/account\/orders\/view\/?\?id=/);
  const orderId = new URL(page.url()).searchParams.get("id")!;
  await page.goto(`checkout/processing/?order=${orderId}`);
  const ok = page.locator(".proc-ok");
  await expect(ok.getByRole("heading", { name: "Payment confirmed!" })).toBeVisible();
  await expect(ok.getByRole("img", { name: /astronaut cat/ })).toBeVisible();
  await expect(ok).toContainText("The transaction was successful.");
  await expect(page.locator(".space-home.space-proc[data-picture='galaxy']")).toHaveCount(1); // galaxy background
  await noHorizontalScroll(page);
  await ok.getByRole("link", { name: "View order" }).click();
  await page.waitForURL(/account\/orders\/view\/?\?id=/);
  await expect(page.getByRole("heading", { name: "Ordered products" })).toBeVisible();
  await page.goto("checkout/processing/?order=nope");
  await expect(page.getByRole("heading", { name: "We could not find this payment" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("still pending after 2 minutes: 'we will email you' + My orders link", async ({ page }) => {
  await registerAndVerify(page);
  // A pending (not yet paid) order, as the real checkout will make before the provider answers.
  const orderId = await page.evaluate(() => {
    const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k)!); const uid = s.sessionUserId; const o = { ...s.orders[uid][0], id: "proc-pending", number: "CC-PROCPEND", status: "pending", paidAt: null };
    s.orders[uid].unshift(o); localStorage.setItem(k, JSON.stringify(s)); return o.id;
  });
  await page.clock.install();
  await page.goto(`checkout/processing/?order=${orderId}`);
  await expect(page.getByText("Please don't close or refresh this page.")).toBeVisible();
  await expect(page.locator(".proc-stage").getByRole("status")).toContainText("getting your keys ready");
  await page.clock.runFor(125_000);
  await expect(page.getByText(/Still working — we will email you/)).toBeVisible();
  await expect(page.locator(".proc-stage").getByRole("status").getByRole("link", { name: "My orders" })).toHaveAttribute("href", /account\/orders/);
  await noHorizontalScroll(page);
});
