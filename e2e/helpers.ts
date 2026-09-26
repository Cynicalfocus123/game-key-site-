import { expect, type Page } from "@playwright/test";

// Demo mode only (GitHub Pages build): accounts live in the test browser's localStorage.
export const DEMO_PASSWORD = "demo-e2e-password-2026";
export const uniqueEmail = (tag: string) => `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

// Register through a sign-up form, then open the link from the demo inbox.
export async function registerAndVerify(page: Page, { name = "Test User", email = uniqueEmail("user") } = {}) {
  await page.goto("register/");
  await page.locator("input[name=name]").fill(name);
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.locator("input[name=confirm]").fill(DEMO_PASSWORD);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByRole("link", { name: "Open verification link" }).click();
  await page.waitForURL(/verified=1/);
  return email;
}

// Demo admin is built into the GitHub Pages demo (lib/client/demo-api.ts). There is no admin sign-up page.
export async function signInDemoAdmin(page: Page) {
  await page.goto("admin/login/");
  await page.getByRole("button", { name: "Fill demo admin" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/admin\/?$/);
}

// Dashboard sign out: sidebar button on desktop/tablet, section dropdown under 768px.
export async function signOutFromAccount(page: Page) {
  const picker = page.getByRole("combobox", { name: "Account section" });
  if (await picker.isVisible()) await picker.selectOption("signout");
  else await page.getByRole("button", { name: "Sign out" }).click();
}
