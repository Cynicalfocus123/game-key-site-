import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// Step 5: sign in, register, forgot password, terms, privacy on the galaxy picture (user 2026-10-24). Real pages, not the checkout popup.
// Desktop + mobile, no skips.
const SHOTS = "D:/dev/tmp/step5/shots";
const bgImage = (page: Page) => page.locator(".space-background").evaluate((el) => getComputedStyle(el).backgroundImage);
const bgColor = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);

async function onGalaxy(page: Page, path: string, isMobile: boolean) {
  await page.goto(path);
  await expect(page.locator(".space-home.space-auth[data-picture='galaxy'] .space-background")).toHaveCount(1);
  expect(await bgImage(page)).toContain(isMobile ? "galaxy-phone" : "galaxy-desktop");
  await expect(page.locator(".auth-card h1")).toHaveCSS("color", "rgb(255, 255, 255)");
}

test("sign in + register pages: galaxy picture, dark glass card, dark inputs, forms still work", async ({ page, isMobile }) => {
  await onGalaxy(page, "login/", isMobile);
  expect(await bgColor(page, ".auth-card")).toBe("rgba(14, 11, 38, 0.86)");
  const email = page.getByLabel("Email");
  expect(await email.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(255, 255, 255, 0.07)");
  await email.fill("someone@example.com");
  await expect(email).toHaveValue("someone@example.com");
  await expect(email).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("button", { name: /Google/ })).toHaveCSS("background-color", "rgb(255, 255, 255)"); // brand button stays white
  await expect(page.getByRole("button", { name: /Google/ })).toHaveCSS("color", "rgb(31, 41, 55)"); // dark text on the white button
  if (!isMobile) expect((await page.locator(".auth-card").boundingBox())!.width).toBeLessThanOrEqual(520); // narrow card, not full width
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/login-${isMobile ? "phone" : "desktop"}.png` });

  await onGalaxy(page, "register/", isMobile);
  await expect(page.getByRole("heading", { level: 1, name: "Create your account" })).toBeVisible();
  expect(await bgColor(page, ".auth-card")).toBe("rgba(14, 11, 38, 0.86)");
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/register-${isMobile ? "phone" : "desktop"}.png` });
});

test("forgot password: galaxy picture + Sims astronaut cat above the title, picture loads", async ({ page, isMobile }) => {
  await onGalaxy(page, "forgot-password/", isMobile);
  const cat = page.locator(".auth-card .auth-cat");
  await expect(cat).toBeVisible();
  await expect.poll(() => cat.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await cat.evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(/cat-home\.(avif|webp)$/);
  const catBox = (await cat.boundingBox())!; const titleBox = (await page.locator(".auth-card h1").boundingBox())!;
  expect(catBox.y + catBox.height).toBeLessThanOrEqual(titleBox.y + 1);
  await page.getByLabel("Email").fill("someone@example.com");
  await expect(page.getByLabel("Email")).toHaveValue("someone@example.com");
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/forgot-${isMobile ? "phone" : "desktop"}.png` });
});

test("terms + privacy: galaxy picture, see-through blurred text panel so the galaxy shows behind the text", async ({ page, isMobile }) => {
  for (const [path, title] of [["terms/", "Terms of Service"], ["privacy/", "Privacy Policy"]]) {
    await onGalaxy(page, path, isMobile);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const panel = page.locator(".auth-card.legal");
    expect(await panel.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(14, 11, 38, 0.5)");
    expect(await panel.evaluate((el) => getComputedStyle(el).backdropFilter || getComputedStyle(el).getPropertyValue("-webkit-backdrop-filter"))).toContain("blur(6px)");
    await expect(panel.locator("p").first()).toHaveCSS("color", "rgb(214, 210, 240)");
    if (!isMobile) expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(820);
    await noHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/${path.replace("/", "")}-${isMobile ? "phone" : "desktop"}.png` });
  }
});
