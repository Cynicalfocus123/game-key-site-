import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signOutFromAccount, uniqueEmail } from "./helpers";

// Demo mode: guest cart in localStorage, account cart in the demo store. Product ids from lib/catalog.ts.
const addBtn = (page: Page, name: string) => page.getByRole("button", { name: `Add to cart: ${name}` }).first();
const cartLink = (page: Page) => page.getByRole("link", { name: /^Shopping cart/ });
const gate = (page: Page) => page.getByRole("dialog").filter({ has: page.locator("#gate-title") });

async function addAndDismiss(page: Page, name: string, isMobile: boolean) {
  await addBtn(page, name).click();
  const pop = page.getByRole("dialog", { name: "Added to cart" });
  await expect(pop).toBeVisible();
  if (isMobile) await pop.getByRole("button", { name: "Continue shopping" }).click();
  else await pop.getByRole("button", { name: "Close cart popup" }).click();
  await expect(pop).toBeHidden();
}

test("add to cart: button state, popup, live count, exact items survive reload", async ({ page, isMobile }) => {
  await page.goto("");
  await expect(cartLink(page)).toHaveAccessibleName("Shopping cart, 0 items");
  await addBtn(page, "Elden Ring").click();
  await expect(page.getByRole("button", { name: "Added: Elden Ring" })).toHaveText("Added ✓");
  const pop = page.getByRole("dialog", { name: "Added to cart" });
  if (isMobile) {
    await expect(pop.getByText("You have 1 item in your cart")).toBeVisible();
    await pop.getByRole("button", { name: "Continue shopping" }).click();
  } else {
    await expect(pop.getByText("Steam · Global · ×1")).toBeVisible();
    await expect(pop.getByText("Subtotal (1 item)")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await expect(pop).toBeHidden();
  await expect(page.getByRole("button", { name: "Add to cart: Elden Ring" })).toBeVisible(); // back after 1.5 s
  await addAndDismiss(page, "Cyberpunk 2077", isMobile);
  await expect(cartLink(page)).toHaveAccessibleName("Shopping cart, 2 items");
  await page.reload();
  await expect(cartLink(page)).toHaveAccessibleName("Shopping cart, 2 items");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("corecart-cart-v1") || "[]"));
  expect(stored).toEqual([
    { productId: "key-cyberpunk-2077-steam", qty: 1, title: "Cyberpunk 2077", platform: "Steam", region: "Global", thb: 62900 },
    { productId: "key-elden-ring-steam", qty: 1, title: "Elden Ring", platform: "Steam", region: "Global", thb: 99000 },
  ]);
  await cartLink(page).click();
  if (!isMobile) await page.getByRole("dialog", { name: "Your cart" }).getByRole("link", { name: "View cart" }).click();
  await expect(page.getByRole("heading", { name: "Your cart (2)" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("desktop popup: hover reopens, 3 rows + 'and N more', count in other tab", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "desktop popup only");
  await page.goto("");
  for (const g of ["Cyberpunk 2077", "Elden Ring", "Baldur's Gate 3", "Black Myth: Wukong"]) await addAndDismiss(page, g, false);
  await cartLink(page).hover();
  const pop = page.getByRole("dialog", { name: "Your cart" });
  await expect(pop.locator(".cart-pop-rows li")).toHaveCount(3);
  await expect(pop.getByText("and 1 more")).toBeVisible();
  await pop.getByRole("button", { name: "Remove Black Myth: Wukong" }).click();
  await expect(pop.getByText("Subtotal (3 items)")).toBeVisible();
  const other = await context.newPage();
  await other.goto("");
  await expect(cartLink(other)).toHaveAccessibleName("Shopping cart, 3 items");
  await page.bringToFront();
  await addBtn(page, "Black Myth: Wukong").click();
  await expect(cartLink(other)).toHaveAccessibleName("Shopping cart, 4 items");
});

test("cart page: qty limit, coupon, remove, empty state", async ({ page, isMobile }) => {
  await page.goto("");
  await addAndDismiss(page, "Elden Ring", isMobile);
  await page.goto("cart/");
  await expect(page.getByText("Steam · Windows · Instant key")).toBeVisible();
  await expect(page.getByText("Global — works in Thailand")).toBeVisible();
  const plus = page.getByRole("button", { name: "Increase quantity of Elden Ring" });
  for (let i = 0; i < 4; i++) await plus.click();
  await expect(page.getByRole("group", { name: "Quantity of Elden Ring" }).locator("output")).toHaveText("5");
  await expect(page.getByText("Limit 5 keys per order")).toBeVisible();
  await expect(plus).toBeDisabled();
  await page.goto("");
  await expect(page.getByRole("button", { name: "Limit reached: Elden Ring" })).toBeDisabled();
  await page.goto("cart/");
  if (isMobile) await page.getByText("Have a coupon?").click();
  await page.getByLabel("Coupon code").fill("NOPE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("This coupon code is not valid.")).toBeVisible();
  await page.getByLabel("Coupon code").fill("welcome10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Coupon WELCOME10")).toBeVisible();
  const [sub, disc, total] = await Promise.all([".cart-summary dl div:first-child [data-price]", ".coupon-line [data-price]", ".cart-total [data-price]"].map((s) => page.locator(s).innerText()));
  const num = (t: string) => Number(t.replace(/[^\d.]/g, ""));
  expect(num(disc)).toBeCloseTo(num(sub) / 10, 1);
  expect(num(total)).toBeCloseTo(num(sub) - num(disc), 1);
  if (isMobile) await expect(page.locator(".cart-sticky")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Remove Elden Ring" }).click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  await expect(page.getByText("to see your saved cart")).toBeVisible();
});

test("checkout gate: signed out every time, register → verify → checkout with the same items", async ({ page, isMobile }) => {
  await page.goto("");
  await addAndDismiss(page, "Elden Ring", isMobile);
  await addAndDismiss(page, "Cyberpunk 2077", isMobile);
  await page.goto("cart/");
  await page.getByRole("button", { name: "Checkout" }).first().click();
  await expect(gate(page).getByRole("heading", { name: "Almost there" })).toBeVisible();
  await expect(gate(page).getByText(/2 items · .+ stay in your cart/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gate(page)).toBeHidden();
  await page.goto("checkout/");
  await expect(gate(page).getByRole("heading", { name: "Almost there" })).toBeVisible();
  await gate(page).getByRole("button", { name: "Continue" }).click();
  await expect(gate(page).getByRole("heading", { name: "Create your account to check out" })).toBeVisible();
  await expect(gate(page).locator(".gate-panel")).toHaveCount(isMobile ? 0 : 1);
  await expect(gate(page).locator("input[name=deals]")).not.toBeChecked();
  await gate(page).locator("input[name=email]").fill("bad");
  await gate(page).getByRole("button", { name: "Create account" }).click();
  await expect(gate(page).getByText("Enter a valid email address.")).toBeVisible();
  const email = uniqueEmail("gate");
  await gate(page).locator("input[name=email]").fill(email);
  await gate(page).locator("input[name=password]").fill(DEMO_PASSWORD);
  await gate(page).getByRole("button", { name: "Show password" }).click();
  await expect(gate(page).locator("input[name=password]")).toHaveAttribute("type", "text");
  await gate(page).getByRole("button", { name: "Create account" }).click();
  await expect(gate(page).getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(gate(page).getByText(email)).toBeVisible();
  await gate(page).getByRole("link", { name: "Open verification link" }).click();
  await page.waitForURL(/checkout\/?\?verified=1/);
  await expect(page.getByRole("heading", { name: "Review your order" })).toBeVisible();
  await expect(page.locator(".review .cart-row")).toHaveCount(2);
  await expect(page.getByText("Payment is coming in the next step.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("corecart-cart-v1"))).toBeNull(); // merged into the account cart
  await page.goto("cart/");
  await page.getByRole("button", { name: "Checkout" }).first().click(); // signed in: no gate
  await page.waitForURL(/checkout\/?$/);
  await expect(gate(page)).toBeHidden();
  await noHorizontalScroll(page);
});

test("checkout gate sign in: wrong password, then guest cart merges with account cart", async ({ page, isMobile }) => {
  const email = await registerAndVerify(page);
  await page.goto("");
  await addAndDismiss(page, "Cyberpunk 2077", isMobile); // account cart
  await addAndDismiss(page, "Elden Ring", isMobile);
  await page.goto("account/");
  await signOutFromAccount(page);
  await expect(cartLink(page)).toHaveAccessibleName("Shopping cart, 0 items");
  await addAndDismiss(page, "Elden Ring", isMobile); // guest: same item, higher qty wins
  await expect(page.getByRole("button", { name: "Add to cart: Elden Ring" })).toBeVisible();
  await addAndDismiss(page, "Elden Ring", isMobile);
  await addAndDismiss(page, "Baldur's Gate 3", isMobile);
  await page.goto("cart/");
  await page.getByRole("button", { name: "Checkout" }).first().click();
  await gate(page).getByRole("button", { name: "Sign in" }).click();
  await expect(gate(page).getByRole("heading", { name: "Sign in to check out" })).toBeVisible();
  if (!isMobile) await expect(gate(page).locator(".gate-panel")).toContainText("New to CoreCart?");
  else await expect(gate(page).locator(".gate-bar")).toContainText("New to CoreCart?");
  await gate(page).locator("input[name=email]").fill(email);
  await gate(page).locator("input[name=password]").fill("wrong-password-123");
  await gate(page).getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(gate(page).getByText("Wrong email or password.")).toBeVisible();
  await gate(page).locator("input[name=password]").fill(DEMO_PASSWORD);
  await gate(page).getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/checkout\/?$/);
  await expect(page.locator(".review .cart-row")).toHaveCount(3);
  await expect(page.locator(".review .cart-row").filter({ hasText: "Elden Ring" })).toContainText("×2");
  await expect(cartLink(page)).toHaveAccessibleName("Shopping cart, 4 items");
});

test("header Sign in: popup on desktop, /login page on mobile", async ({ page, isMobile }) => {
  await page.goto("");
  if (isMobile) {
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/login\/?$/);
    return;
  }
  await page.getByRole("link", { name: /Hello, sign in/ }).click();
  await expect(gate(page).getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await gate(page).getByRole("button", { name: "Create account" }).click();
  await expect(gate(page).getByRole("heading", { name: "Create your account" })).toBeVisible();
  await gate(page).getByRole("button", { name: "Close" }).first().click();
  await expect(gate(page)).toBeHidden();
  await expect(page).toHaveURL(/game-key-site-\/$/);
});
