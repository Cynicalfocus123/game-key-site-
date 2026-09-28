import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Handoff v12 step 2a: header order, currency button, checkout gate width, coloured cart/checkout text.
const addBtn = (page: Page, name: string) => page.getByRole("button", { name: `Add to cart: ${name}` }).first();
const gate = (page: Page) => page.getByRole("dialog").filter({ has: page.locator("#gate-title") });
const box = async (page: Page, sel: string) => (await page.locator(`.header-main ${sel}`).first().boundingBox())!;

test("header: ♡ · cart · profile in that order, visible at every width", async ({ page, isMobile }) => {
  test.skip(isMobile, "widths set by hand");
  for (const width of [390, 640, 768, 900, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("");
    const fav = await box(page, ".hdr-icon"); const cart = await box(page, ".cart"); const prof = await box(page, ".hdr-account");
    expect(fav.x, `width ${width}`).toBeLessThan(cart.x);
    expect(cart.x, `width ${width}`).toBeLessThan(prof.x);
    expect(prof.x - (cart.x + cart.width), `profile next to cart at ${width}`).toBeLessThan(40);
    expect(prof.x + prof.width, `inside viewport at ${width}`).toBeLessThanOrEqual(width);
    await expect(page.getByRole("banner").getByRole("link", { name: "Favorites" })).toHaveAttribute("href", /\/favorites\/?$/); // guests go to /favorites (step 5)
    if (width > 640) await expect(page.getByRole("banner").getByRole("link", { name: "Register" })).toBeVisible();
    else await expect(page.getByRole("banner").getByRole("link", { name: "Register" })).toBeHidden();
    await noHorizontalScroll(page);
  }
});

test("header: signed in shows Hello, name next to cart; Register popup on desktop", async ({ page, isMobile }) => {
  if (!isMobile) {
    await page.goto("");
    await page.getByRole("banner").getByRole("link", { name: "Register" }).click();
    await expect(gate(page).getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await registerAndVerify(page, { name: "Mali Test" });
  await page.goto("");
  const account = page.getByRole("banner").getByRole("link", { name: /Hello, Mali/ });
  await expect(account).toHaveAttribute("href", /account\/?$/);
  if (isMobile) await expect(account.locator(".hdr-profile-text")).toHaveCSS("position", "absolute");
  else await expect(account).toContainText("Hello, Mali");
});

test("currency button has no box", async ({ page, isMobile }) => {
  test.skip(isMobile, "currency button is in the drawer on mobile");
  await page.goto("");
  const btn = page.locator(".cur-toggle");
  await expect(btn).toHaveCSS("border-top-width", "0px");
  await btn.focus();
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  await expect(btn).toHaveCSS("outline-style", "solid");
});

test("checkout gate: choice view uses the full modal width", async ({ page, isMobile }) => {
  await page.goto("");
  await addBtn(page, "Elden Ring").click();
  await page.goto("cart/");
  await page.locator(".cart-summary").getByRole("button", { name: "Checkout" }).click();
  const g = gate(page);
  await expect(gate(page).getByRole("heading", { name: "Almost there" })).toBeVisible();
  const modal = (await g.boundingBox())!; const cols = page.locator(".gate-choice section");
  const a = (await cols.nth(0).boundingBox())!; const b = (await cols.nth(1).boundingBox())!;
  const signIn = (await gate(page).getByRole("button", { name: "Sign in" }).boundingBox())!;
  expect(signIn.height).toBeLessThan(50); // one line
  if (isMobile) { expect(b.y).toBeGreaterThan(a.y); return; }
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(b.x + b.width).toBeGreaterThan(modal.x + modal.width - 60);
  const foot = (await page.locator(".gate-foot").boundingBox())!;
  expect(foot.width).toBeGreaterThan(modal.width - 2);
  for (const width of [768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const view of ["Sign in", "Create account"]) {
      if (view === "Sign in") await gate(page).getByRole("button", { name: "Sign in" }).first().click();
      else await gate(page).getByRole("button", { name: "Continue", exact: true }).click();
      for (const btn of await gate(page).locator(".gate-main .btn").all()) expect((await btn.boundingBox())!.height, `${view} at ${width}`).toBeLessThan(50);
      await gate(page).getByRole("button", { name: "‹ Back" }).click();
    }
  }
});

const addQuiet = async (page: Page, name: string) => {
  await addBtn(page, name).click();
  const pop = page.getByRole("dialog", { name: "Added to cart" });
  if (await page.locator(".cart-sheet").isVisible()) await pop.getByRole("button", { name: "Continue shopping" }).click();
};

test("coloured cart + checkout text: region, max per order, coupon, charge notice", async ({ page }) => {
  await page.goto("");
  await addQuiet(page, "Elden Ring");
  await addQuiet(page, "Black Myth: Wukong");
  await page.goto("cart/");
  const ok = page.locator(".region").filter({ hasText: "Global — works in Thailand" });
  const bad = page.locator(".region").filter({ hasText: "ROW — does not work in Thailand" });
  await expect(ok).toHaveCSS("color", "rgb(22, 128, 60)");
  await expect(bad).toHaveCSS("color", "rgb(185, 28, 28)");
  const plus = page.getByRole("button", { name: "Increase quantity of Elden Ring" });
  for (let i = 0; i < 4; i++) await plus.click();
  await expect(page.getByText("Max 5 per order")).toHaveCSS("color", "rgb(180, 83, 9)");
  const summary = page.locator(".cart-summary");
  if (!(await summary.getByLabel("Coupon code").isVisible())) await summary.getByText("Have a coupon?").click();
  await summary.getByLabel("Coupon code").fill("WELCOME10");
  await summary.getByRole("button", { name: "Apply" }).click();
  await expect(summary.locator(".coupon-line dd")).toHaveCSS("color", "rgb(22, 128, 60)");
  await expect(summary.locator(".coupon-line dd")).toContainText("−");
  await expect(summary.locator(".charge-notice")).toHaveCount(0); // USD chargeable → no notice
  await registerAndVerify(page);
  await page.goto("checkout/");
  await expect(page.locator(".review .region").filter({ hasText: "does not work in Thailand" })).toBeVisible();
  await expect(page.locator(".review").getByText("Max 5 per order")).toBeVisible();
  await expect(page.locator(".cart-summary .coupon-line")).toContainText("WELCOME10");
});

test.describe("charge notice", () => {
  test.use({ locale: "en-US", timezoneId: "America/New_York" });
  test("amber box when the chosen currency is not chargeable", async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem("corecart-currency", "EUR"); } catch { /* */ } });
    await page.goto("");
    await addBtn(page, "Elden Ring").click();
    await page.goto("cart/");
    const n = page.locator(".cart-summary .charge-notice");
    await expect(n).toContainText("You will be charged");
    await expect(n).toHaveCSS("background-color", "rgb(255, 248, 230)");
    await expect(page.locator(".region").first()).toContainText("works in United States");
  });
});
