import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Customer dashboard on the galaxy background (user 2026-10-18; AccountShell → SpacePage .space-acct, CSS app/space.css).
// Desktop + mobile, no skips. Every /account page: galaxy picture, one dark framed panel, light headings, no white card or table left.
const PAGES = ["account/", "account/login-history/", "account/balance/", "account/orders/", "account/keys/", "account/favorites/", "account/tickets/", "account/payment-methods/", "account/settings/"];
const bgImage = (page: Page) => page.locator(".space-background").evaluate((el) => getComputedStyle(el).backgroundImage);
// Large light boxes inside the dashboard panel (the receipt paper and payment logo tiles are meant to stay white).
const whiteBoxes = (page: Page) => page.evaluate(() => [...document.querySelectorAll(".acct-main *")].filter((el) => {
  const r = el.getBoundingClientRect(); if (r.width < 60 || r.height < 24 || el.closest(".receipt-doc, .wal-logos, .pay-logos, .pay-strip")) return false;
  const m = getComputedStyle(el).backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
  return !!m && +m[1] > 200 && +m[2] > 200 && +m[3] > 200 && (m[4] === undefined || +m[4] > 0.5);
}).map((el) => `${el.tagName}.${el.className}`));

test("dashboard: every account page on the galaxy picture, dark framed panel, no white boxes, no sideways scroll", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  await registerAndVerify(page, { name: "Galaxy Buyer" });
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator(".space-home.space-acct .space-background")).toHaveCount(1);
    await expect(page.locator(".acct-content h1")).toBeVisible();
    await expect(page.getByText("Loading your account…")).toHaveCount(0);
    expect(await bgImage(page)).toContain(isMobile ? "galaxy-phone" : "galaxy-desktop");
    const panel = await page.locator(".acct-main").evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderTopLeftRadius]; });
    expect(panel).toEqual(["rgba(14, 11, 38, 0.86)", isMobile ? "14px" : "18px"]);
    await expect(page.locator(".acct-content h1")).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await whiteBoxes(page), path).toEqual([]);
    await noHorizontalScroll(page);
  }
});

test("dashboard overview: dark glass cards, violet active link, balance green, menu still works", async ({ page, isMobile }) => {
  await registerAndVerify(page, { name: "Galaxy Buyer" });
  await page.goto("account/");
  const card = page.locator(".dash-card").first();
  expect(await card.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderTopLeftRadius]; })).toEqual(["rgba(255, 255, 255, 0.04)", "14px"]);
  await expect(page.locator(".balance-amount").first()).toHaveCSS("color", "rgb(61, 220, 132)");
  if (isMobile) {
    await page.locator(".acct-picker select").selectOption("/account/settings");
  } else {
    await expect(page.locator(".acct-nav a[aria-current=page]")).toHaveCSS("color", "rgb(196, 181, 255)");
    await page.locator(".acct-nav").getByRole("link", { name: "Settings" }).click();
  }
  await expect(page).toHaveURL(/account\/settings/);
  await expect(page.locator("input[name=name], .field input").first()).toHaveCSS("background-color", "rgba(255, 255, 255, 0.07)");
});
