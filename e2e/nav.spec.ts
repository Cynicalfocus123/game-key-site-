import { expect, test } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// Task 6 (2026-09-28): store links open real listing pages (/games, /hardware, on-sale results). Desktop and mobile.
test("home: no dead # links; View all games, hero, footer and promo links open listings", async ({ page }) => {
  await page.goto("");
  const dead = await page.locator("main a[href='#'], footer a[href='#'], header a[href='#']").count();
  expect(dead).toBe(0);
  await page.getByRole("link", { name: /View all games/ }).click();
  await expect(page).toHaveURL(/\/games\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "All games" })).toBeVisible();
  await page.goto("");
  await page.getByRole("link", { name: /Shop components/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "PC hardware" })).toBeVisible();
  await page.goto("");
  await page.locator("footer").getByRole("link", { name: "Digital games" }).click();
  await expect(page).toHaveURL(/\/games\/?$/);
  await page.goto("");
  await page.getByRole("link", { name: /See all deals/ }).click();
  await expect(page).toHaveURL(/\/search\/?\?sale=On(\+|%20)sale/);
  await expect(page.getByText("Sale: On sale")).toBeVisible();
  await page.goto("");
  await page.locator(".quick-track").getByRole("link", { name: "Steam" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Steam games" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("header bar (desktop) and drawer links (both) open listings; Under ฿350 follows the currency", async ({ page, isMobile }) => {
  await page.addInitScript(() => localStorage.setItem("corecart-currency", "THB"));
  await page.goto("");
  if (!isMobile) {
    await page.locator("header nav").getByRole("link", { name: "Digital Games" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "All games" })).toBeVisible();
    await page.locator("header nav").getByRole("link", { name: "PC Parts" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "PC hardware" })).toBeVisible();
  }
  await page.getByRole("button", { name: isMobile ? "Open products menu" : /Products/ }).first().click();
  const drawer = page.getByRole("dialog", { name: "Product categories" });
  await drawer.getByRole("button", { name: "Digital Games" }).click();
  await expect(drawer.getByRole("link", { name: "Under ฿350.00" })).toBeVisible();
  await drawer.getByRole("link", { name: "Under ฿350.00" }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/games\/?\?max=350/);
  await expect(page.locator(".lst-grid .product")).not.toHaveCount(0);
  await page.getByRole("button", { name: isMobile ? "Open products menu" : /Products/ }).first().click();
  await page.getByRole("dialog", { name: "Product categories" }).getByRole("button", { name: "Digital Games" }).click();
  await page.getByRole("dialog", { name: "Product categories" }).getByRole("link", { name: "PlayStation" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "PlayStation games" })).toBeVisible();
});
