import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, signInDemoAdmin, uniqueEmail } from "./helpers";

// T2 master admin permissions (demo store = same rules as the server API). Desktop sidebar + mobile "Admin section" select.
const signOutDemo = (page: Page) => page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });

// Section names the admin can open: sidebar links (desktop) or select options (phones).
async function sections(page: Page, isMobile: boolean) {
  if (isMobile) {
    await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeHidden();
    return (await page.getByRole("combobox", { name: "Admin section" }).locator("option").allTextContents()).filter((t) => t !== "No access");
  }
  return page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link").allTextContents();
}

// Master adds an admin with the given sections on the Admins page; returns the set-password link.
async function addAdmin(page: Page, email: string, pick: string[]) {
  await page.goto("admin/admins/");
  await page.getByRole("button", { name: "Add admin" }).click();
  const form = page.getByRole("form", { name: "Add admin" });
  await form.getByLabel("Name").fill("Helper Admin");
  await form.getByLabel("Email").fill(email);
  await expect(form.getByLabel("Role")).toHaveValue("admin");
  const boxes = form.getByRole("group", { name: /Sections/ });
  await expect(boxes).toContainText("0 of 12");
  await boxes.getByRole("button", { name: "Select all" }).click();
  await expect(boxes).toContainText("12 of 12");
  await boxes.getByRole("button", { name: "Clear all" }).click();
  await expect(boxes).toContainText("0 of 12");
  for (const label of pick) await boxes.getByRole("checkbox", { name: label, exact: true }).check();
  await noHorizontalScroll(page);
  await form.getByRole("button", { name: "Add admin" }).click();
  const done = page.getByRole("region", { name: "User added" });
  await expect(done).toContainText(`Account created for ${email}.`);
  return (await done.getByRole("link", { name: "Open set-password link" }).getAttribute("href"))!;
}

async function setPasswordAndSignIn(page: Page, link: string, email: string) {
  await signOutDemo(page);
  await page.goto(link.replace(/^\/game-key-site-\//, ""));
  await page.getByLabel(/^New password/).fill(DEMO_PASSWORD);
  await page.getByLabel("Confirm new password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForURL(/login\/?\?reset=1/);
  await page.goto("admin/login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("demo admin is the master admin: every section + Admins page", async ({ page, isMobile }) => {
  await signInDemoAdmin(page);
  const list = await sections(page, isMobile);
  expect(list).toEqual(["Overview", "Admins", "Users", "Top-ups", "Products", "Currencies", "Gift cards", "Promo codes", "Returns", "Tickets", "Filters", "Menu & categories", "Seller applications", "Emails"]);
  await expect(page.locator(".acct-tile", { hasText: "Balance owed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Newest registrations" })).toBeVisible();
  await page.goto("admin/admins/");
  const me = page.getByRole("region", { name: "Admin admin@corecart.demo" });
  await expect(me).toContainText("master admin");
  await expect(me).toContainText("Master admin: every section, always.");
  await expect(me.getByRole("checkbox")).toHaveCount(0);
  await expect(me.getByRole("button", { name: "Remove admin" })).toHaveCount(0); // not on yourself
  await noHorizontalScroll(page);
});

test("admin with 2 sections: hidden sidebar, No access page, no admin roles; master changes sections (audited) and removes the admin", async ({ page, isMobile }) => {
  const email = uniqueEmail("helper");
  await signInDemoAdmin(page);
  const link = await addAdmin(page, email, ["Tickets", "Promo codes"]);
  await setPasswordAndSignIn(page, link, email);

  // Only Overview + the 2 sections (+ Emails: sample previews, every admin). Overview hides user list (Users) and balance owed (Wallet).
  expect(await sections(page, isMobile)).toEqual(["Overview", "Promo codes", "Tickets", "Emails"]);
  await expect(page.locator(".acct-tile", { hasText: "Balance owed" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Newest registrations" })).toHaveCount(0);
  await page.goto("admin/promo-codes/");
  await expect(page.getByRole("heading", { name: "No access" })).toHaveCount(0);
  await expect(page.getByText("WELCOME10").first()).toBeVisible();
  for (const path of ["admin/users/", "admin/topups/", "admin/products/", "admin/currencies/", "admin/categories/"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
    await expect(page.getByText("Ask the master admin", { exact: false })).toBeVisible();
  }
  await page.goto("admin/admins/");
  await expect(page.getByText("Only the master admin can manage admins.")).toBeVisible();
  await noHorizontalScroll(page);

  // Master gives Users: the helper can add users but never admins, and cannot change an admin's role.
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/admins/");
  const card = page.getByRole("region", { name: `Admin ${email}` });
  const boxes = card.getByRole("group", { name: /Sections for/ });
  await expect(boxes).toContainText("2 of 12");
  await boxes.getByRole("checkbox", { name: "Users", exact: true }).check();
  await card.getByRole("button", { name: "Save sections" }).click();
  await expect(page.locator(".adm-audit li").first()).toContainText(`${email} · Admin sections changed: Promo codes, Tickets → Users, Promo codes, Tickets`);
  await expect(page.locator(".adm-audit li").first()).toContainText("admin@corecart.demo");
  await expect(page.getByRole("region", { name: `Admin ${email}` }).getByRole("group", { name: /Sections for/ })).toContainText("3 of 12");

  await signOutDemo(page);
  await page.goto("admin/login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  expect(await sections(page, isMobile)).toEqual(["Overview", "Users", "Promo codes", "Tickets", "Emails"]);
  await page.goto("admin/users/");
  await page.getByRole("button", { name: "Add user" }).click();
  const roles = await page.getByRole("form", { name: "Add user" }).getByLabel("Role").locator("option").allTextContents();
  expect(roles).toEqual(["Customer", "Seller"]);
  await page.getByRole("button", { name: "Cancel" }).click();
  // The master's user page: role locked, no Adjust balance (no Wallet section).
  await page.getByRole("searchbox", { name: "Search" }).fill("admin@corecart.demo");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.locator(".adm-table tbody tr").first().getByRole("link").click();
  await expect(page.getByText("Only the master admin can change or remove an admin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust balance" })).toHaveCount(0);

  // Master removes the admin (confirm) → customer: no admin access at all.
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/admins/");
  const card2 = page.getByRole("region", { name: `Admin ${email}` });
  await card2.getByRole("button", { name: "Remove admin" }).click();
  await page.getByRole("alertdialog", { name: "Confirm remove admin" }).getByRole("button", { name: "Remove admin" }).click();
  await expect(page.getByRole("region", { name: `Admin ${email}` })).toHaveCount(0);
  await expect(page.locator(".adm-audit li").first()).toContainText(`${email} · Role changed: admin → customer`);
  await signOutDemo(page);
  await page.goto("admin/login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("This account has no admin access.")).toBeVisible();
});

test("user page role change to admin starts with no sections; only a master sees admin roles", async ({ page }) => {
  const email = uniqueEmail("promote");
  await signInDemoAdmin(page);
  await page.goto("admin/users/");
  await page.getByRole("button", { name: "Add user" }).click();
  const form = page.getByRole("form", { name: "Add user" });
  expect(await form.getByLabel("Role").locator("option").allTextContents()).toEqual(["Customer", "Seller", "Admin", "Master admin"]);
  await form.getByLabel("Name").fill("Promote Me");
  await form.getByLabel("Email").fill(email);
  await form.getByRole("button", { name: "Add user" }).click();
  await page.getByRole("region", { name: "User added" }).getByRole("link", { name: "Open user" }).click();
  await page.getByRole("combobox", { name: "Role" }).selectOption({ label: "Admin" });
  await page.getByRole("button", { name: "Change role" }).click();
  await expect(page.getByRole("alertdialog", { name: "Confirm role change" })).toContainText("A new admin starts with no sections");
  await page.getByRole("alertdialog", { name: "Confirm role change" }).getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator(".adm-audit li").first()).toContainText("Role changed: customer → admin (sections: none)");
  await page.goto("admin/admins/");
  await expect(page.getByRole("region", { name: `Admin ${email}` }).getByRole("group", { name: /Sections for/ })).toContainText("0 of 12");
});
