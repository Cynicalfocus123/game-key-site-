import { expect, test } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

test("signed-out visitor is sent to admin sign in", async ({ page }) => {
  await page.goto("admin/users/");
  await expect(page).toHaveURL(/admin\/login\/?\?next=/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
});

test("customer account has no admin access", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("admin/");
  await expect(page.getByRole("heading", { name: "No admin access" })).toBeVisible();
});

test("admin registers, sees overview, filters users, opens detail", async ({ page }) => {
  const email = await registerAndVerify(page, { admin: true, name: "Owner Admin" });
  await expect(page).toHaveURL(/admin\/?\?verified=1/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Email verified. Admin access is active.")).toBeVisible();
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

  await page.getByRole("link", { name: "Owner Admin" }).click();
  await expect(page.getByRole("heading", { name: "User details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign-in history/ })).toBeVisible();
  await expect(page.getByText("Email link")).toBeVisible();
});
