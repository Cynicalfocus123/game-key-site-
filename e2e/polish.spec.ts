import { expect, test } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// Step 5 polish (2026-09-28): guest favorites page, trust lines per product kind, Google consent line. Desktop and mobile.
test("guest ♡ opens /favorites (no sign-in wall) with the saved items", async ({ page }) => {
  await page.goto("product/?id=key-elden-ring-steam");
  await page.getByRole("button", { name: "Save Elden Ring to favorites" }).first().click();
  await page.getByRole("link", { name: /^Favorites, 1 saved/ }).click();
  await expect(page).toHaveURL(/\/favorites\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Favorites" })).toBeVisible();
  await expect(page.getByText("Saved in this browser.", { exact: false })).toBeVisible();
  await expect(page.locator(".fav-title")).toHaveText(["Elden Ring"]);
  await noHorizontalScroll(page);
});

test("trust list: keys say instant key delivery, hardware says free shipping", async ({ page }) => {
  await page.goto("product/?id=hw-990-pro-2tb");
  await expect(page.locator(".trust")).toContainText("Free shipping in Thailand");
  await expect(page.locator(".trust")).not.toContainText("Instant key delivery");
  await page.goto("product/?id=key-elden-ring-steam");
  await expect(page.locator(".trust")).toContainText("Instant key delivery");
  await expect(page.locator(".trust")).not.toContainText("Free shipping");
});

test("register shows the Google consent line", async ({ page }) => {
  await page.goto("register/");
  await expect(page.locator(".google-terms")).toContainText("By continuing with Google you agree to the Terms and Privacy Policy.");
});
