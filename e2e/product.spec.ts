import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signOutFromAccount } from "./helpers";

// Handoff v12 step 2c: product page (/product?id=) + favorites (guest localStorage, account list, merge on sign-in).
const gate = (page: Page) => page.getByRole("dialog").filter({ has: page.locator("#gate-title") });
const favLink = (page: Page) => page.getByRole("banner").getByRole("link", { name: /^Favorites/ });

test("cards link to the product page; game page shows facts, region, price, actions", async ({ page, isMobile }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Elden Ring", exact: true }).click();
  await expect(page).toHaveURL(/product\/?\?id=key-elden-ring-steam/);
  await expect(page.getByRole("heading", { name: "Elden Ring", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Digital games");
  const facts = page.locator(".pdp-facts");
  for (const f of ["Region", "Platform", "Digital key", "Refunds"]) await expect(facts).toContainText(f);
  await expect(facts).toContainText("Can be activated in Thailand");
  await expect(facts.getByRole("link", { name: "Activation guide" })).toHaveAttribute("href", /help\/activate\/steam/);
  await expect(page.locator(".pdp-region .region")).toContainText("Global — works in Thailand");
  await expect(page.getByText("Max 5 per order")).toBeVisible();
  await expect(page.getByRole("heading", { name: /System requirements/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeVisible();
  if (isMobile) await expect(page.locator(".pdp-sticky")).toBeVisible();
  else await expect(page.locator(".pdp-sticky")).toBeHidden();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /^Shopping cart/ })).toHaveAccessibleName("Shopping cart, 1 item");
  await noHorizontalScroll(page);
});

test("ROW key warns; hardware page shows stock, shipping, warranty; unknown id", async ({ page }) => {
  await page.goto("product/?id=key-black-myth-wukong-steam");
  await expect(page.locator(".pdp-facts")).toContainText("Cannot be activated in Thailand");
  await expect(page.locator(".pdp-warn")).toContainText("does not work in Thailand");
  await page.goto("product/?id=hw-msi-mag-27-qhd");
  const facts = page.locator(".pdp-facts");
  await expect(facts).toContainText("Only 3 left");
  await expect(facts).toContainText("Free shipping");
  await expect(facts).toContainText("3-year manufacturer warranty");
  await expect(page.getByRole("heading", { name: /System requirements/ })).toHaveCount(0);
  await page.goto("product/?id=nope");
  await expect(page.getByRole("heading", { name: "Product not found" })).toBeVisible();
});

test("Buy now: signed out opens the checkout gate with the item in the cart", async ({ page }) => {
  await page.goto("product/?id=key-baldurs-gate-3-steam");
  await page.getByRole("button", { name: "Buy now" }).click();
  await expect(gate(page).getByRole("heading", { name: "Almost there" })).toBeVisible();
  await expect(gate(page)).toContainText("1 item");
});

test("favorites: title ♡, card ♡, header count, guest list survives reload, merges on sign-in", async ({ page, isMobile }) => {
  await page.goto("product/?id=key-elden-ring-steam");
  const heart = page.locator(".pdp-title").getByRole("button", { name: "Save Elden Ring to favorites" });
  await heart.click();
  await expect(page.locator(".pdp-title").getByRole("button", { name: "Remove Elden Ring from favorites" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Saved to favorites" })).toBeVisible();
  await expect(favLink(page)).toHaveAccessibleName("Favorites, 1 saved");
  await page.goto("");
  await page.getByRole("button", { name: "Save Cyberpunk 2077 to favorites" }).click();
  await expect(favLink(page)).toHaveAccessibleName("Favorites, 2 saved");
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove Cyberpunk 2077 from favorites" })).toBeVisible();
  await expect(favLink(page)).toHaveAccessibleName("Favorites, 2 saved");

  // Guest favorites merge into the new account.
  await registerAndVerify(page);
  await page.goto("account/favorites/");
  await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible();
  await expect(page.locator(".fav-item")).toHaveCount(2);
  await expect(page.locator(".fav-item").first()).toContainText("Cyberpunk 2077");
  await page.getByRole("button", { name: "Remove Elden Ring from favorites" }).click();
  await expect(page.locator(".fav-item")).toHaveCount(1);
  await page.locator(".fav-item").getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByRole("link", { name: /^Shopping cart/ })).toHaveAccessibleName("Shopping cart, 1 item");
  await noHorizontalScroll(page);

  // Signed out: the account list stays with the account; guest list starts empty.
  await signOutFromAccount(page);
  await page.goto("");
  await expect(favLink(page)).toHaveAccessibleName("Favorites, 0 saved");
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Account sections" })).toHaveCount(0);
});

test("favorites: cart row ♡ is the same list; dashboard nav + empty state; other tab live", async ({ page, context, isMobile }) => {
  await registerAndVerify(page);
  if (isMobile) await expect(page.getByRole("combobox", { name: "Account section" }).locator("option", { hasText: "Favorites" })).toHaveCount(1);
  else await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Favorites" }).click();
  await page.goto("account/favorites/");
  await expect(page.getByText("No favorites yet")).toBeVisible();
  const other = await context.newPage();
  await other.goto("account/favorites/");
  await expect(other.getByText("No favorites yet")).toBeVisible();
  await page.goto("product/?id=hw-990-pro-2tb");
  await page.locator(".pdp-title").getByRole("button", { name: /Save .* to favorites/ }).click();
  await expect(other.locator(".fav-item")).toHaveCount(1);
  await page.locator(".pdp-actions, .pdp-sticky").getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto("cart/");
  await expect(page.locator(".cart-row").getByRole("button", { name: /Remove Samsung 990 PRO 2TB NVMe SSD from favorites/ })).toHaveAttribute("aria-pressed", "true");
  await page.locator(".cart-row").getByRole("button", { name: /Remove Samsung 990 PRO 2TB NVMe SSD from favorites/ }).click();
  await expect(other.getByText("No favorites yet")).toBeVisible();
});
