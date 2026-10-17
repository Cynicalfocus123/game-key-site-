import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// 404 page (2026-10-17, app/not-found.tsx): lost astronaut cat with "404" on its blank sign, galaxy background. Desktop + mobile, no skips.
// The desktop project also checks laptop, tablet sideways and tablet upright; the mobile project checks a phone upright and sideways.
const SHOTS = "D:/dev/tmp/step5/shots";
const bgImage = (page: Page) => page.locator(".space-background").evaluate((el) => getComputedStyle(el).backgroundImage);

// "404" must sit on the cardboard sign (measured on cat-lost: x 17-70%, y 63.6-82.3% of the picture) at every screen size.
async function signFits(page: Page) {
  const img = await page.locator(".nf-cat img").boundingBox();
  const text = await page.locator(".nf-sign").evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  expect(img && img.width).toBeGreaterThan(150);
  const box = { left: img!.x + img!.width * 0.17, top: img!.y + img!.height * 0.636, right: img!.x + img!.width * 0.70, bottom: img!.y + img!.height * 0.823 };
  expect(text.x).toBeGreaterThanOrEqual(box.left - 1);
  expect(text.x + text.width).toBeLessThanOrEqual(box.right + 1);
  expect(text.y).toBeGreaterThanOrEqual(box.top - 1);
  expect(text.y + text.height).toBeLessThanOrEqual(box.bottom + 1);
  expect(text.width).toBeGreaterThan((box.right - box.left) * 0.35); // big enough to read, not a tiny label
}

test("404: unknown page shows the lost cat with 404 on its sign, galaxy background, header + footer", async ({ page, isMobile }) => {
  const res = await page.goto("this-page-does-not-exist/");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.locator(".space-home.space-404 .space-background")).toHaveCount(1);
  expect(await bgImage(page)).toContain(isMobile ? "galaxy-phone" : "galaxy-desktop");
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  const cat = page.getByRole("img", { name: "CoreCart astronaut cat holding a sign" });
  await expect(cat).toBeVisible();
  await expect.poll(() => cat.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(480);
  expect(await cat.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(/cat-lost\.avif$/);
  await expect(page.locator(".nf-sign")).toHaveText("404");
  await expect(page.locator(".nf-sign")).toHaveAttribute("aria-hidden", "true"); // the heading says it; screen readers skip the sign
  await signFits(page);
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/404-${isMobile ? "phone" : "desktop"}.png`, fullPage: true });
});

test("404: sign text stays on the sign and nothing scrolls sideways at every screen shape", async ({ page, isMobile }) => {
  const sizes: [string, number, number][] = isMobile
    ? [["phone-small", 360, 740], ["phone-upright", 412, 915], ["phone-sideways", 915, 412]]
    : [["desktop-1920", 1920, 1080], ["laptop", 1366, 768], ["tablet-sideways", 1024, 768], ["tablet-upright", 768, 1024]];
  await page.goto("no-such-page/");
  for (const [name, w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await signFits(page);
    await noHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/404-${name}.png` });
  }
});

test("404: buttons lead back to the store and the games list", async ({ page }) => {
  await page.goto("missing/page/");
  await page.getByRole("link", { name: "Back to the store" }).click();
  await expect(page).toHaveURL(/\/game-key-site-\/$/);
  await page.goto("missing/page/");
  await page.getByRole("link", { name: "Browse games" }).click();
  await expect(page).toHaveURL(/\/games\/?$/);
});
