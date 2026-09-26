import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify } from "./helpers";

test("register, verify, account overview, sign out, sign in", async ({ page }) => {
  const email = await registerAndVerify(page, { name: "Anan Test" });
  await expect(page).toHaveURL(/\/account\/?\?verified=1/);
  await expect(page.getByText("Email verified. Your account is active.")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/game-key-site-\/$/);

  await page.goto("login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();

  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
});

test("register form validates before submit", async ({ page }) => {
  await page.goto("register/");
  await page.locator("input[name=name]").fill("Short Pass");
  await page.locator("input[name=email]").fill("short@example.com");
  await page.locator("input[name=password]").fill("123");
  await page.locator("input[name=confirm]").fill("123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();
});

test("account pages redirect to login when signed out", async ({ page }) => {
  await page.goto("account/orders/");
  await expect(page).toHaveURL(/login\/?\?next=/);
});
