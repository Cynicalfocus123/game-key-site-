import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// Step 5A (F209): home page space theme (app/space.css, wireframe space-theme-home.png approved 2026-10-16). Desktop + mobile, no skips.
// The right picture per screen shape: desktop 16:9 (also laptops + phones sideways), tablet sideways 4:3, tablet upright 3:4, phone 9:19.5.
const SHOTS = "D:/dev/tmp/step5/shots";
const bgImage = (page: Page) => page.locator(".space-background").evaluate((el) => getComputedStyle(el).backgroundImage);
const pictureFor = async (page: Page, w: number, h: number) => { await page.setViewportSize({ width: w, height: h }); return bgImage(page); };

test("home: space picture fixed behind the page, right picture per screen shape, files load", async ({ page, isMobile }) => {
  const loaded: string[] = [];
  page.on("response", (r) => { if (/\/images\/space\/space-[a-z-]+\.(avif|webp)$/.test(r.url()) && r.ok()) loaded.push(r.url().split("/").pop()!); });
  await page.goto("");
  const bg = page.locator(".space-background");
  await expect(bg).toHaveCount(1);
  await expect(bg).toHaveAttribute("aria-hidden", "true");
  expect(await bg.evaluate((el) => { const s = getComputedStyle(el); return [s.position, s.pointerEvents, s.backgroundSize]; })).toEqual(["fixed", "none", "cover"]);
  // Phone upright (Pixel 7, 412 x 915) → phone picture; desktop project → desktop picture. AVIF first, WebP as the fallback.
  const first = await bgImage(page);
  expect(first).toContain(isMobile ? "space-phone" : "space-desktop");
  expect(first).toMatch(/avif/);
  await expect.poll(() => loaded.some((f) => f.startsWith(isMobile ? "space-phone" : "space-desktop"))).toBe(true);
  // Fixed: scrolling moves the shop, never the picture.
  const before = await bg.boundingBox(); await page.mouse.wheel(0, 1600); await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  expect(await bg.boundingBox()).toEqual(before);
  if (isMobile) {
    await page.screenshot({ path: `${SHOTS}/phone-upright.png` });
    expect(await pictureFor(page, 915, 412)).toContain("space-desktop"); // phone held sideways
    await page.screenshot({ path: `${SHOTS}/phone-sideways.png` });
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${SHOTS}/desktop-1440.png` });
    expect(await pictureFor(page, 1920, 1080)).toContain("space-desktop");
    await page.screenshot({ path: `${SHOTS}/desktop-1920.png` });
    expect(await pictureFor(page, 1536, 960)).toContain("space-desktop"); // 16:10 laptop
    expect(await pictureFor(page, 1024, 768)).toContain("space-tablet-landscape");
    await page.screenshot({ path: `${SHOTS}/tablet-sideways.png` });
    expect(await pictureFor(page, 768, 1024)).toContain("space-tablet-portrait");
    await page.screenshot({ path: `${SHOTS}/tablet-upright.png` });
  }
});

test("home: dark see-through header + footer, framed dark panels, content 1180 px, white text, no sideways scroll", async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  const rgba = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await rgba(".space-home header")).toMatch(/rgba\(9, 7, 26, 0\.8/);
  expect(await rgba(".space-home footer")).toMatch(/rgba\(6, 5, 18/);
  const panel = page.locator(".space-home .section").first();
  expect(await panel.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderTopLeftRadius]; })).toEqual(["rgba(14, 11, 38, 0.78)", isMobile ? "14px" : "16px"]);
  await expect(page.getByRole("heading", { name: "Today's deals" })).toHaveCSS("color", "rgb(244, 242, 255)");
  // Favourite ♡ on product cards: white heart on a dark round button (was white on white).
  const fav = page.locator(".space-home .fav-v-card").first();
  expect(await fav.evaluate((el) => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; })).toEqual(["rgb(255, 255, 255)", "rgba(14, 11, 38, 0.82)"]);
  if (!isMobile) expect(await page.locator(".space-home main").evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1180);
  // Popups stay light: search results keep dark text on white.
  await page.getByRole("combobox", { name: /search/i }).first().fill("elden");
  await expect(page.locator(".search-drop")).toBeVisible();
  expect(await rgba(".search-drop")).toBe("rgb(255, 255, 255)");
  await expect(page.locator(".search-drop .search-name").first()).toHaveCSS("color", "rgb(17, 24, 39)");
  // A search result can be clicked (the header dropdowns sit above the hero, not under it).
  await page.locator(".search-drop .search-row").first().click();
  await expect(page).toHaveURL(/product\/?\?id=/);
  await page.goBack();
  await noHorizontalScroll(page);
});

test("theme is only on the home page for now (step 5A): other pages keep their look", async ({ page }) => {
  for (const path of ["games/", "product/?id=key-elden-ring-steam", "cart/"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator(".space-background")).toHaveCount(0);
    await expect(page.locator(".space-home")).toHaveCount(0);
  }
});
