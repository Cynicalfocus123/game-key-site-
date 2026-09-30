import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin, signOutFromAccount } from "./helpers";

// Returns & Orders (Handoff v14 task 2). Demo sample orders: #1 completed (Elden Ring + Cyberpunk 2077 keys), #2 paid 9 days ago (Samsung SSD hardware).
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "THB")); });

const goOrders = async (page: Page, isMobile: boolean) => {
  if (isMobile) await page.getByRole("combobox", { name: "Account section" }).selectOption({ label: "Returns & Orders" });
  else await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Returns & Orders" }).click();
  await expect(page.getByRole("heading", { name: "Returns & Orders" })).toBeVisible();
};
const orderRows = (page: Page) => page.locator(".orders-table > tbody > tr");
const line = (page: Page, name: string) => page.locator(".order-items li:not(.return-li)", { hasText: name });
// Email task: Details (or the row) opens the order page /account/orders/view?id=.
async function openOrder(page: Page, n: number) {
  if (!/account\/orders\/?(\?.*)?$/.test(page.url())) await page.goto("account/orders/");
  await page.getByRole("tab", { name: /Orders/ }).click();
  await orderRows(page).nth(n).getByRole("link", { name: /Details/ }).click();
  await expect(page).toHaveURL(/account\/orders\/view\/?\?id=/);
  await expect(page.locator(".order-items li").first()).toBeVisible();
}
async function requestReturn(page: Page, item: string, reason: string, message = "") {
  await line(page, item).getByRole("button", { name: `Request return for ${item}` }).click();
  const form = page.getByRole("form", { name: `Return ${item}` });
  await form.getByLabel("Reason").selectOption({ label: reason });
  if (message) await form.getByLabel(/Message/).fill(message);
  await form.getByRole("button", { name: "Send return request" }).click();
  await expect(page.getByText(/Return RT-[A-Z0-9]{8} requested/)).toBeVisible();
  await expect(page.locator(".returns-table tbody tr", { hasText: item }).first()).toBeVisible();
}

test("customer: tabs, key return blocks reveal, revealed key not eligible, hardware return", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await goOrders(page, isMobile);
  await expect(page.getByRole("tab", { name: /Orders/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Returns/ }).click();
  await expect(page).toHaveURL(/tab=returns/);
  await expect(page.getByText("No returns yet.")).toBeVisible();

  // Key return: form checks, then Returns tab shows it (survives reload through ?tab=returns).
  await openOrder(page, 0);
  await line(page, "Elden Ring").getByRole("button", { name: "Request return for Elden Ring" }).click();
  const form = page.getByRole("form", { name: "Return Elden Ring" });
  await expect(form.getByLabel("Reason").locator("option")).toHaveText(["Choose a reason", "Key not revealed – no longer needed", "Wrong item", "Other"]);
  await form.getByRole("button", { name: "Send return request" }).click();
  await expect(form.getByText("Choose a reason.")).toBeVisible();
  await form.getByLabel("Reason").selectOption({ label: "Other" });
  await form.getByRole("button", { name: "Send return request" }).click();
  await expect(form.getByText("Tell us more about the problem.")).toBeVisible();
  await form.getByLabel("Reason").selectOption({ label: "Key not revealed – no longer needed" });
  await form.getByRole("button", { name: "Send return request" }).click();
  await expect(page.getByText(/Return RT-[A-Z0-9]{8} requested/)).toBeVisible();
  await expect(page.getByRole("tab", { name: /Returns/ })).toHaveAttribute("aria-selected", "true");
  const row = page.locator(".returns-table tbody tr").first();
  await expect(row).toContainText("Elden Ring");
  await expect(row).toContainText("Key not revealed – no longer needed");
  await expect(row.locator(".chip")).toHaveText("Requested");
  await page.reload();
  await expect(page.getByRole("tab", { name: /Returns/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".returns-table tbody tr")).toHaveCount(1);
  await noHorizontalScroll(page);

  // Same line cannot be returned twice; its key cannot be revealed while the return is open.
  await openOrder(page, 0);
  await expect(line(page, "Elden Ring")).toContainText("A return is already requested for this item.");
  await line(page, "Elden Ring").getByRole("link", { name: /Reveal key/ }).click();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.getByText("This key is part of a return request, so it cannot be shown.")).toBeVisible();

  // Revealed key: not eligible, ticket link instead.
  await page.goto("account/orders/");
  await openOrder(page, 0);
  await line(page, "Cyberpunk 2077").getByRole("link", { name: /Reveal key/ }).click();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.locator(".key-code")).toHaveText(/^DEMO-/);
  await page.goto("account/orders/");
  await openOrder(page, 0);
  await expect(line(page, "Cyberpunk 2077")).toContainText("Not eligible for return: the key was shown.");
  await expect(line(page, "Cyberpunk 2077").getByRole("link", { name: "Open a ticket" })).toHaveAttribute("href", /account\/tickets\/?\?new=1&key=/);

  // Hardware (9 days old): "Changed my mind" still offered.
  await openOrder(page, 1);
  await line(page, "Samsung 990 PRO").getByRole("button", { name: /Request return/ }).click();
  await expect(page.getByRole("form", { name: /Return Samsung/ }).getByLabel("Reason").locator("option")).toHaveText(["Choose a reason", "Damaged", "Wrong item", "Not as described", "Changed my mind (within 14 days)", "Other"]);
  await page.getByRole("form", { name: /Return Samsung/ }).getByRole("button", { name: "Cancel" }).click();
  await requestReturn(page, "Samsung 990 PRO 2TB NVMe SSD", "Damaged", "Box arrived crushed.");
  await expect(page.locator(".returns-table tbody tr")).toHaveCount(2);
  await noHorizontalScroll(page);
});

test("admin: list, reject needs a note, approve → refunded; rejected key return frees the key", async ({ page, isMobile }) => {
  const email = await registerAndVerify(page);
  await goOrders(page, isMobile);
  await openOrder(page, 1);
  await requestReturn(page, "Samsung 990 PRO 2TB NVMe SSD", "Wrong item");
  await openOrder(page, 0);
  await requestReturn(page, "Elden Ring", "Key not revealed – no longer needed");
  await page.goto("account/");
  await signOutFromAccount(page);

  await signInDemoAdmin(page);
  await page.goto("admin/returns/");
  await expect(page.getByRole("heading", { name: "Returns", exact: true })).toBeVisible();
  // Phones show the "Admin section" select instead of the link list (hidden under 768px).
  if (await page.getByRole("navigation", { name: "Admin navigation" }).isVisible()) await expect(page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Returns" })).toHaveAttribute("aria-current", "page");
  else await expect(page.getByRole("combobox", { name: "Admin section" })).toHaveValue("/admin/returns");
  await page.getByLabel("Search").fill(email);
  const rows = page.locator(".rt-table > tbody > tr:not(.rt-row)");
  await expect(rows).toHaveCount(2);
  const ssd = rows.filter({ hasText: "Samsung" }); const key = rows.filter({ hasText: "Elden Ring" });
  await expect(ssd.locator(".chip")).toHaveText("Requested");

  // Hardware: approve, then refunded with a note.
  await ssd.getByRole("button", { name: /Open/ }).click();
  let detail = page.locator(".rt-row");
  await expect(detail).toContainText("Wrong item");
  await detail.getByLabel("Change status").selectOption({ label: "Approve" });
  await detail.getByRole("button", { name: "Save" }).click();
  await expect(ssd.locator(".chip")).toHaveText("Approved");
  await detail.getByLabel("Change status").selectOption({ label: "Mark refunded" });
  await detail.getByLabel(/Note to customer/).fill("Refunded ฿5,690 by bank transfer.");
  await detail.getByRole("button", { name: "Save" }).click();
  await expect(ssd.locator(".chip")).toHaveText("Refunded");
  await expect(detail).toContainText("No further changes.");
  await noHorizontalScroll(page);

  // Key: reject without a note fails, with a note works.
  await key.getByRole("button", { name: /Open/ }).click();
  detail = page.locator(".rt-row");
  await detail.getByLabel("Change status").selectOption({ label: "Reject" });
  await detail.getByRole("button", { name: "Save" }).click();
  await expect(detail.getByText("Add a note that tells the customer why.")).toBeVisible();
  await detail.getByLabel(/Note to customer/).fill("Order is older than our key return window.");
  await detail.getByRole("button", { name: "Save" }).click();
  await expect(key.locator(".chip")).toHaveText("Rejected");
  await page.getByLabel("Status").selectOption({ label: "Refunded (1)" });
  await expect(rows).toHaveCount(1);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/admin\/login/);

  // Customer sees the outcomes; a rejected return frees the key (return again possible, reveal works).
  await page.goto("login/");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.goto("account/orders/?tab=returns");
  const mine = page.locator(".returns-table tbody tr");
  await expect(mine.filter({ hasText: "Samsung" })).toContainText("Refunded ฿5,690 by bank transfer.");
  await expect(mine.filter({ hasText: "Elden Ring" }).locator(".chip")).toHaveText("Rejected");
  await expect(mine.filter({ hasText: "Elden Ring" })).toContainText("Order is older than our key return window.");
  await openOrder(page, 0);
  await expect(line(page, "Elden Ring").getByRole("button", { name: "Request return for Elden Ring" })).toBeVisible();
  await line(page, "Elden Ring").getByRole("link", { name: /Reveal key/ }).click();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.locator(".key-code")).toHaveText(/^DEMO-/);
});
