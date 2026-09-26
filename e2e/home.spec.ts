import { expect, test } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

test("homepage renders main sections", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle(/CoreCart/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shop by category" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today's deals" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Digital game deals" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("hero slider moves to next slide", async ({ page }) => {
  await page.goto("");
  const title = page.getByRole("heading", { level: 1 });
  const first = await title.textContent();
  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(title).not.toHaveText(first ?? "");
});

test("products drawer opens and closes with Escape", async ({ page, isMobile }) => {
  await page.goto("");
  await page.getByRole("button", { name: isMobile ? "Open products menu" : /Products/ }).first().click();
  const drawer = page.getByRole("dialog", { name: "Product categories" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});
