import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

test("signed-out visitor is sent to admin sign in", async ({ page }) => {
  await page.goto("admin/users/");
  await expect(page).toHaveURL(/admin\/login\/?\?next=/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
});

test("no admin sign-up or Google on admin pages; old register address forwards to sign in", async ({ page }) => {
  await page.goto("admin/register/");
  await expect(page).toHaveURL(/admin\/login\/?$/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Create admin account/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
});

test("customer account has no admin access", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("admin/");
  await expect(page.getByRole("heading", { name: "No admin access" })).toBeVisible();
});

test("customer cannot sign in on the admin sign-in page", async ({ page }) => {
  const email = await registerAndVerify(page);
  await page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
  await page.goto("admin/login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("This account has no admin access.")).toBeVisible();
});

test("demo admin signs in, sees overview, filters users, opens detail", async ({ page }) => {
  const email = "admin@corecart.demo";
  await signInDemoAdmin(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const total = page.locator(".acct-tile", { hasText: "Total users" }).locator("strong");
  await expect(total).toHaveText("37");
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "Users", exact: true }).click();
  await expect(page.getByText(/of 37 users/)).toBeVisible();
  await page.getByLabel("Method").selectOption("google");
  await expect(page.getByText(/of 12 users/)).toBeVisible();
  await page.getByLabel("Method").selectOption("");
  await page.getByLabel("Search").fill(email);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("1–1 of 1 user")).toBeVisible();

  await page.getByRole("link", { name: "Demo Admin" }).click();
  await expect(page.getByRole("heading", { name: "User details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign-in history/ })).toBeVisible();
  await expect(page.locator(".adm-table .badge-email").first()).toBeVisible();
});
