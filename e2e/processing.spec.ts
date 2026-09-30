import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Task 6 (wireframe approved 2026-09-30): processing screen after Pay (?order= / ?topup=). Polls every 3 s: paid → order page / top-up result,
// failed → "not completed" here, after 2 minutes "Still working — we will email you". Desktop and mobile, no skips.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "USD")); });
async function pendingTopUp(page: Page) {
  await page.goto("account/balance/top-up/");
  await page.getByRole("button", { name: "Demo: simulate payment" }).click();
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
  await page.waitForURL(new RegExp(`account/balance/top-up/?\\?id=${id}`), { timeout: 15_000 });
  await expect(page.getByTestId("tu-status")).toHaveText("Credited");
});

test("failed top-up: 'Your payment was not completed', Try again + My balance", async ({ page }) => {
  await registerAndVerify(page);
  const id = await pendingTopUp(page);
  await page.getByRole("button", { name: "Simulate failed" }).click();
  await expect(page.getByTestId("tu-status")).toHaveText("Failed");
  await page.goto(`checkout/processing/?topup=${id}`);
  const box = page.locator(".proc-stage").getByRole("alert");
  await expect(box.getByRole("heading", { name: "Your payment was not completed" })).toBeVisible();
  await expect(box).toContainText("You were not charged. Your wallet was not changed.");
  await expect(box.getByRole("link", { name: "Try again" })).toHaveAttribute("href", /account\/balance\/top-up/);
  await expect(box.getByRole("link", { name: "My balance" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("order: a paid order opens the order page; unknown id = could not find", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/orders/");
  await page.locator(".orders-table > tbody > tr").first().getByRole("link", { name: /Details/ }).click();
  await page.waitForURL(/account\/orders\/view\/?\?id=/);
  const orderId = new URL(page.url()).searchParams.get("id")!;
  await page.goto(`checkout/processing/?order=${orderId}`);
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
