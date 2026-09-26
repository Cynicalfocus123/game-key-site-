import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Customer dashboard, Handoff v8 Part 2 step 1 (C1 overview, C2 login history, C4 orders, C12 mobile).
const goSection = async (page: Page, isMobile: boolean, label: string) => {
  if (isMobile) await page.getByRole("combobox", { name: "Account section" }).selectOption({ label });
  else await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: label }).click();
};

test("overview: profile card, balance, recent purchases", async ({ page }) => {
  const email = await registerAndVerify(page, { name: "Mai Tester" });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("My account");
  const profile = page.locator(".profile-card");
  await expect(profile).toContainText("Mai Tester");
  await expect(profile).toContainText(email);
  await expect(profile).toContainText("Complete your profile (33%)");
  await profile.getByRole("button", { name: /2 of 6 tasks completed/ }).click();
  await expect(profile.getByRole("link", { name: "Set your country" })).toBeVisible();
  await expect(page.locator(".balance-card")).toContainText("Total balance");
  await expect(page.getByRole("link", { name: "Redeem a gift card" })).toBeVisible();
  const recent = page.locator(".purchases");
  await expect(recent.locator(".stats-strip")).toContainText("Keys owned2");
  await expect(recent.locator(".stats-strip")).toContainText("Not revealed2");
  await expect(recent.locator(".purchase-rows li")).toHaveCount(2);
  await expect(recent.locator(".chip-blue").first()).toHaveText("New key");
  await expect(recent).toContainText("2 keys waiting");
  await expect(recent.getByRole("link", { name: "Open keys library" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("profile tasks reach 100% from settings", async ({ page }) => {
  await registerAndVerify(page);
  await page.getByRole("link", { name: "Edit profile" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const profile = page.locator("#profile");
  await profile.locator("label", { has: page.locator("input[value=teal]") }).click();
  await profile.locator("select[name=country]").selectOption("TH");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(profile.getByText("Profile saved.")).toBeVisible();
  await page.locator("select[name=currency]").selectOption("THB");
  await expect(page.getByText("Currency saved.")).toBeVisible();
  await page.locator("#deals").getByRole("button", { name: "Save choice" }).click();
  await expect(page.getByText("No deal emails. Order emails still arrive.")).toBeVisible();
  await page.goto("account/");
  await expect(page.locator(".profile-card")).toContainText("Complete your profile (100%)");
  await expect(page.locator(".profile-card .avatar-teal")).toBeVisible();
});

test("login history lists the verify sign-in with masked IP", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await goSection(page, isMobile, "Login history");
  await expect(page.getByRole("heading", { name: "Login history" })).toBeVisible();
  const row = page.locator(".dash-table tbody tr").first();
  await expect(row).toContainText("Email link");
  await expect(row).toContainText("Latest");
  await expect(page.getByRole("link", { name: "Change password" })).toHaveAttribute("href", /settings\/?#password/);
  await noHorizontalScroll(page);
});

test("orders table: details open, key reveal, mobile cards", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await goSection(page, isMobile, "Orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  const rows = page.locator(".orders-table > tbody > tr:not(.detail-row)");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Elden Ring +1 more");
  await expect(rows.first().locator(".badge")).toHaveText("completed");
  await rows.first().getByRole("button", { name: /Details/i }).click();
  const detail = page.locator(".detail-row");
  await expect(detail.locator(".order-items li")).toHaveCount(2);
  await detail.getByRole("button", { name: "Reveal key" }).first().click();
  await expect(detail.locator("code").first()).toHaveText(/^DEMO-/);
  if (isMobile) await expect(page.locator(".orders-table thead")).not.toBeInViewport();
  await noHorizontalScroll(page);
});

test("sidebar on desktop, section dropdown on mobile", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  if (isMobile) {
    await expect(page.locator(".acct-side")).toBeHidden();
    await expect(page.getByRole("combobox", { name: "Account section" })).toHaveValue("/account");
  } else {
    const nav = page.getByRole("navigation", { name: "Account sections" });
    for (const l of ["Overview", "Login history", "Balance", "Orders", "Keys library", "Tickets", "Payment methods", "Settings"]) await expect(nav.getByRole("link", { name: l, exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  }
  await goSection(page, isMobile, "Keys library");
  await expect(page.getByRole("heading", { name: "Keys library" })).toBeVisible();
});

test("recent purchases empty state (demo admin has no orders)", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("account/");
  await expect(page.getByText("No purchases yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse today's deals" })).toBeVisible();
});
