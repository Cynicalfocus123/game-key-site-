import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Admin tickets (Handoff v8 C11, step 4b) + the customer side it drives (Answered, unread badge, reply → Open). Desktop and mobile.
const signOutDemo = (page: Page) => page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
async function signInCustomer(page: Page, email: string) {
  await page.goto("login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("admin list + filters, reply → customer sees Answered + unread; customer reply → Open; status select", async ({ page, isMobile }) => {
  const email = await registerAndVerify(page, { name: "Ticket Person" });
  await page.goto("account/tickets/?new=1");
  const form = page.getByRole("form", { name: "New ticket" });
  await form.getByLabel("Subject").selectOption({ label: "Order issue" });
  await form.getByLabel("Order number").fill("CC-55554444");
  await form.getByLabel("Description").fill("Key says already used.");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/tickets\/?\?id=/);
  await page.goto("account/tickets/?new=1");
  await form.getByLabel("Subject").selectOption({ label: "Questions" });
  await form.getByLabel("Description").fill("Do you sell PS5 keys?");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/tickets\/?\?id=/);
  await signOutDemo(page);

  await signInDemoAdmin(page);
  if (isMobile) await page.goto("admin/tickets/");
  else await page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Tickets" }).click();
  await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
  const rows = page.locator(".tk-admin-table tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Questions"); // newest reply first
  await page.getByLabel("Subject").selectOption({ label: "Order issue" });
  await expect(rows).toHaveCount(1);
  await page.getByLabel("Subject").selectOption({ label: "All subjects" });
  await page.getByRole("searchbox", { name: "Search" }).fill("cc-5555");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("CC-55554444");
  await expect(rows.first()).toContainText(email);
  await expect(rows.first()).toHaveClass(/tk-waiting/);
  await noHorizontalScroll(page);
  await rows.first().getByRole("link").click();

  // Thread + side panel.
  await expect(page.getByRole("heading", { name: /Order issue$/, level: 2 })).toBeVisible();
  const side = page.getByRole("complementary", { name: "Ticket details" });
  await expect(side).toContainText("CC-55554444");
  await expect(side).toContainText("Not found in this customer's orders");
  await expect(side).toContainText(email);
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Write a message.")).toBeVisible();
  await page.getByLabel("Reply to customer").fill("Sorry! Here is a new key: <b>NOT-HTML</b>");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Reply sent.", { exact: false })).toBeVisible();
  await expect(page.locator(".tk-head .chip")).toHaveText("Answered");
  await expect(page.locator(".tk-support p")).toHaveText("Sorry! Here is a new key: <b>NOT-HTML</b>"); // shown as text
  await noHorizontalScroll(page);

  // Customer: unread badge (sidebar on desktop, section select on mobile), Answered, opening clears it.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/admin\/login/);
  await signInCustomer(page, email);
  if (isMobile) await expect(page.getByRole("combobox", { name: "Account section" }).locator("option", { hasText: "Tickets (1)" })).toHaveCount(1);
  else await expect(page.getByRole("navigation", { name: "Account sections" }).getByLabel("1 unread")).toBeVisible();
  await page.goto("account/tickets/");
  const mine = page.locator("tbody tr", { hasText: "CC-55554444" }).filter({ hasText: "Answered" });
  await expect(mine.first()).toBeVisible();
  await mine.first().getByRole("button", { name: /^View/ }).click();
  await expect(page.locator(".tk-support")).toContainText("CoreCart support");
  if (isMobile) await expect(page.getByRole("combobox", { name: "Account section" }).locator("option", { hasText: "Tickets (1)" })).toHaveCount(0);
  else await expect(page.getByRole("navigation", { name: "Account sections" }).getByLabel("1 unread")).toHaveCount(0);
  await page.getByLabel("Your reply").fill("Thanks, it works.");
  await page.getByRole("button", { name: "Reply" }).click();
  await expect(page.locator(".tk-head .chip")).toHaveText("Open");
  await signOutDemo(page);

  // Admin: status select → Closed shows for the customer too.
  await signInDemoAdmin(page);
  await page.goto("admin/tickets/");
  await page.getByRole("searchbox", { name: "Search" }).fill("CC-55554444");
  await expect(rows.first().locator(".chip")).toHaveText("Open");
  await rows.first().getByRole("link").click();
  await page.getByRole("complementary", { name: "Ticket details" }).getByLabel("Status").selectOption({ label: "Closed" });
  await expect(page.getByText("Status: Closed.")).toBeVisible();
  await expect(page.locator(".tk-head .chip")).toHaveText("Closed");
  await expect(page.locator(".tk-msg")).toHaveCount(3);
});

test("admin tickets need an admin", async ({ page }) => {
  await page.goto("admin/tickets/");
  await expect(page).toHaveURL(/admin\/login\/?\?next=/);
});
