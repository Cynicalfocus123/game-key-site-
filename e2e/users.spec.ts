import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, signInDemoAdmin, uniqueEmail } from "./helpers";

// Future task S7: register as Customer or Seller; admin Add user (set-password link) + role change with confirm + history. Desktop and mobile.
const signOutDemo = (page: Page) => page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
async function openUser(page: Page, email: string) {
  await page.goto("admin/users/");
  await page.getByRole("searchbox", { name: "Search" }).fill(email);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".adm-table tbody tr")).toHaveCount(1);
  await page.locator(".adm-table tbody tr").first().getByRole("link").click();
  await expect(page.getByRole("heading", { name: "User details", level: 1 })).toBeVisible();
}

test("register as Seller; admin sees the seller role", async ({ page }) => {
  const email = uniqueEmail("seller");
  await page.goto("register/");
  const types = page.getByRole("group", { name: "Account type" });
  await expect(types.getByRole("radio", { name: /Customer/ })).toBeChecked(); // default
  await types.getByRole("radio", { name: /Seller/ }).check();
  await page.locator("input[name=name]").fill("Seller Person");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.locator("input[name=confirm]").fill(DEMO_PASSWORD);
  await page.getByRole("checkbox").first().check();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("link", { name: "Open verification link" }).click();
  await page.waitForURL(/verified=1/);
  await signOutDemo(page);

  await signInDemoAdmin(page);
  await page.goto("admin/users/");
  await page.getByRole("combobox", { name: "Role" }).selectOption({ label: "Seller" });
  await expect(page.locator(".adm-table tbody tr", { hasText: email })).toContainText("seller");
});

test("admin adds a user; set-password link signs them in; role change with confirm + history", async ({ page }) => {
  const email = uniqueEmail("added");
  await signInDemoAdmin(page);
  await page.goto("admin/users/");
  await page.getByRole("button", { name: "Add user" }).click();
  const form = page.getByRole("form", { name: "Add user" });
  await form.getByRole("button", { name: "Add user" }).click();
  await expect(form.getByText("Enter a name (up to 80 characters).")).toBeVisible();
  await form.getByLabel("Name").fill("Added Person");
  await form.getByLabel("Email").fill("admin@corecart.demo");
  await form.getByRole("button", { name: "Add user" }).click();
  await expect(form.getByText("An account with this email already exists.")).toBeVisible();
  await form.getByLabel("Email").fill(email.toUpperCase());
  await form.getByLabel("Role").selectOption({ label: "Admin" });
  await expect(form.getByText("Only add people you trust.", { exact: false })).toBeVisible();
  await form.getByLabel("Role").selectOption({ label: "Customer" });
  await form.getByRole("button", { name: "Add user" }).click();
  const done = page.getByRole("region", { name: "User added" });
  await expect(done).toContainText(`Account created for ${email}.`);
  const link = await done.getByRole("link", { name: "Open set-password link" }).getAttribute("href");
  await done.getByRole("link", { name: "Open user" }).click();
  await expect(page.locator(".adm-audit")).toContainText("Account created by admin (customer)");
  await expect(page.locator(".acct-tile", { hasText: "Email" })).toContainText("Not verified");

  // Role change: confirm step, then history line.
  await page.getByRole("combobox", { name: "Role" }).selectOption({ label: "Seller" });
  await page.getByRole("button", { name: "Change role" }).click();
  await expect(page.getByRole("alertdialog", { name: "Confirm role change" })).toContainText(`Change ${email} from Customer to Seller?`);
  await page.getByRole("alertdialog", { name: "Confirm role change" }).getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Role changed to Seller.")).toBeVisible();
  await expect(page.locator(".acct-tile", { hasText: "Role" }).locator("strong")).toHaveText("Seller");
  await expect(page.locator(".adm-audit li").first()).toContainText("Role changed: customer → seller");
  await expect(page.locator(".adm-audit li").first()).toContainText("admin@corecart.demo");
  await noHorizontalScroll(page);

  // Own account: no role control.
  await openUser(page, "admin@corecart.demo");
  await expect(page.getByText("This is your account.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change role" })).toHaveCount(0);

  // The added user sets a password from the link, then signs in (email counts as verified).
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/admin\/login/);
  await page.goto(link!.replace(/^\/game-key-site-\//, ""));
  await page.getByLabel(/^New password/).fill(DEMO_PASSWORD);
  await page.getByLabel("Confirm new password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForURL(/login\/?\?reset=1/);
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});
