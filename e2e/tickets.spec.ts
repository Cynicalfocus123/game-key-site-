import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Customer tickets (Handoff v8 C9, C10; Handoff v14 task 3). Support replies + unread badge are tested with the admin side (tickets-admin.spec.ts).
const goTickets = async (page: Page, isMobile: boolean) => {
  if (isMobile) await page.getByRole("combobox", { name: "Account section" }).selectOption({ label: "Tickets" });
  else await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Tickets" }).click();
  await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
};
async function newTicket(page: Page, category: string, subject: string, message: string) {
  await page.getByRole("button", { name: "New ticket" }).click();
  const form = page.getByRole("form", { name: "New ticket" });
  await form.getByLabel("Category").selectOption({ label: category });
  await form.getByLabel("Subject").fill(subject);
  await form.getByLabel("Message").fill(message);
  await form.getByRole("button", { name: "Send" }).click();
}

test("new ticket, thread, reply, close, reopen by reply, list, back button", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await goTickets(page, isMobile);
  await expect(page.getByText("No tickets yet.")).toBeVisible();
  await page.getByRole("button", { name: "New ticket" }).click();
  await expect(page).toHaveURL(/tickets\/?\?new=1/);
  const form = page.getByRole("form", { name: "New ticket" });
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Choose a category.")).toBeVisible();
  await form.getByLabel("Category").selectOption({ label: "Payment" });
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Enter a subject.")).toBeVisible();
  await form.getByLabel("Subject").fill("Charged twice");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Write a message.")).toBeVisible();
  await form.getByLabel("Order or key (optional)").selectOption({ index: 1 }); // whole first order
  await form.getByLabel("Message").fill("My card shows two payments.\nPlease check.");
  await form.getByRole("button", { name: "Send" }).click();

  await expect(page).toHaveURL(/tickets\/?\?id=/);
  await expect(page.getByRole("heading", { name: /^#1001 Charged twice$/ })).toBeVisible();
  await expect(page.locator(".tk-head .chip")).toHaveText("Open");
  await expect(page.locator(".tk-meta")).toContainText(/Payment · Order CC-/);
  const msgs = page.locator(".tk-msg");
  await expect(msgs).toHaveCount(1);
  await expect(msgs.first()).toContainText("You");
  await expect(msgs.first().locator("p")).toHaveText("My card shows two payments.\nPlease check.");

  await page.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByText("Write a message.")).toBeVisible();
  await page.getByLabel("Your reply").fill("Order total was ฿990.");
  await page.getByRole("button", { name: "Reply" }).click();
  await expect(msgs).toHaveCount(2);
  await page.getByRole("button", { name: "Close ticket" }).click();
  await expect(page.locator(".tk-head .chip")).toHaveText("Closed");
  await expect(page.getByText("This ticket is closed. Replying opens it again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close ticket" })).toHaveCount(0);
  await page.getByLabel("Your reply").fill("Still need help.");
  await page.getByRole("button", { name: "Reply" }).click();
  await expect(msgs).toHaveCount(3);
  await expect(page.locator(".tk-head .chip")).toHaveText("Open");
  await noHorizontalScroll(page);

  await page.reload(); // thread survives reload (?id=)
  await expect(msgs).toHaveCount(3);
  await page.getByRole("button", { name: "‹ All tickets" }).click();
  const row = page.locator(".tickets-table tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("#1001");
  await expect(row).toContainText("Charged twice");
  await expect(row).toContainText("Payment");
  await expect(row.locator(".chip")).toHaveText("Open");
  await expect(row).toContainText("You");
  await noHorizontalScroll(page);
  await row.getByRole("button", { name: /View/ }).click();
  await expect(page.getByRole("heading", { name: /#1001/ })).toBeVisible();
  await page.goBack();
  await expect(page.locator(".tickets-table tbody tr")).toHaveCount(1);
});

test("Report a problem on a key prefills category, key and subject; revealed state shown", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await page.goto("account/keys/");
  await page.getByRole("link", { name: /Reveal key/ }).first().click();
  await expect(page.getByRole("button", { name: "Reveal key" })).toBeVisible(); // title is "Your key" until the key loads
  const game = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.locator(".key-code")).toBeVisible();
  await page.getByRole("link", { name: "Report a problem with this key" }).click();
  const form = page.getByRole("form", { name: "New ticket" });
  await expect(form.getByLabel("Category")).toHaveValue("key");
  await expect(form.getByLabel("Order or key (optional)")).toHaveValue(/^key:/);
  await expect(form.getByLabel("Order or key (optional)").locator("option:checked")).toContainText(`Key: ${game} (revealed)`);
  await expect(form.getByLabel("Subject")).toHaveValue(`Problem with my ${game} key`);
  await form.getByLabel("Message").fill("Steam says the key is already used.");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".tk-meta")).toContainText(`Key invalid or used · Order CC-`);
  await expect(page.locator(".tk-meta")).toContainText(`Key: ${game} (revealed`);
  await page.locator(".tk-meta").getByRole("link", { name: game }).click();
  await expect(page).toHaveURL(/account\/keys\/view\/?\?id=/);
  if (isMobile) await expect(page.getByRole("combobox", { name: "Account section" })).toBeVisible();
});

test("returns tab and orders link to tickets; 6th new ticket in an hour is refused", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await page.goto("account/orders/?tab=returns");
  await page.getByRole("link", { name: "Open a ticket" }).click();
  await expect(page.getByRole("form", { name: "New ticket" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  for (let i = 1; i <= 5; i++) {
    await newTicket(page, "Other", `Question ${i}`, "Hello");
    await expect(page.getByRole("heading", { name: new RegExp(`Question ${i}$`) })).toBeVisible();
    await page.getByRole("button", { name: "‹ All tickets" }).click();
  }
  await expect(page.locator(".tickets-table tbody tr")).toHaveCount(5);
  await newTicket(page, "Other", "Question 6", "Hello");
  await expect(page.getByText("You opened several tickets in the last hour.", { exact: false })).toBeVisible();
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Tickets" })).toHaveAttribute("aria-current", "page");
});
