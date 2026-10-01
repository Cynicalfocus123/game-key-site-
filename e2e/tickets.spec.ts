import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, displayKey } from "./helpers";

// Customer tickets (Handoff v8 C9, C10; Handoff v15 task 3: Subject select + Order number + Description). Support replies + unread badge are tested with the admin side (tickets-admin.spec.ts).
const goTickets = async (page: Page, isMobile: boolean) => {
  if (isMobile) await page.getByRole("combobox", { name: "Account section" }).selectOption({ label: "Tickets" });
  else await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Tickets" }).click();
  await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
};
async function newTicket(page: Page, subject: string, message: string) {
  await page.getByRole("button", { name: "New ticket" }).click();
  const form = page.getByRole("form", { name: "New ticket" });
  await form.getByLabel("Subject").selectOption({ label: subject });
  await form.getByLabel("Description").fill(message);
  await form.getByRole("button", { name: "Send" }).click();
}

test("new ticket, thread, reply, close, reopen by reply, list, back button", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await goTickets(page, isMobile);
  await expect(page.getByText("No tickets yet.")).toBeVisible();
  await page.getByRole("button", { name: "New ticket" }).click();
  await expect(page).toHaveURL(/tickets\/?\?new=1/);
  const form = page.getByRole("form", { name: "New ticket" });
  // Only 3 fields: Subject select (4 options), Order number, Description.
  await expect(form.locator("input, select, textarea")).toHaveCount(3);
  await expect(form.getByLabel("Subject").locator("option:not([value=''])")).toHaveText(["Order issue", "Return/refund", "General support", "Questions", "Account verification"]);
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Choose a subject.")).toBeVisible();
  await form.getByLabel("Subject").selectOption({ label: "Questions" });
  await expect(form.getByLabel("Order number (optional)")).toBeVisible();
  await form.getByLabel("Subject").selectOption({ label: "Order issue" });
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Enter your order number.")).toBeVisible();
  await form.getByLabel("Order number").fill("CC 12#");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Enter a valid order number, e.g. CC-12345678.")).toBeVisible();
  await form.getByLabel("Order number").fill(" cc-99887766 ");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Write a description.")).toBeVisible();
  await expect(form.getByLabel("Order number")).toHaveValue("CC-99887766"); // trimmed + upper-case on blur
  await form.getByLabel("Description").fill("My card shows two payments.\nPlease check.");
  await form.getByRole("button", { name: "Send" }).click();

  await expect(page).toHaveURL(/tickets\/?\?id=/);
  await expect(page.getByRole("heading", { name: /^#1001 Order issue$/ })).toBeVisible();
  await expect(page.locator(".tk-head .chip")).toHaveText("Open");
  await expect(page.locator(".tk-meta")).toContainText(/^Order CC-99887766 · Opened/);
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
  await expect(row.locator('td[data-label="Subject"]')).toHaveText("Order issue");
  await expect(row.locator('td[data-label="Order number"]')).toHaveText("CC-99887766");
  await expect(row.locator(".chip")).toHaveText("Open");
  await expect(row).toContainText("You");
  await noHorizontalScroll(page);
  await row.getByRole("button", { name: /View/ }).click();
  await expect(page.getByRole("heading", { name: /#1001/ })).toBeVisible();
  await page.goBack();
  await expect(page.locator(".tickets-table tbody tr")).toHaveCount(1);
});

test("Report a problem on a key prefills Order issue + that order number; key + revealed state shown", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await page.goto("account/keys/");
  await page.getByRole("link", { name: /Get key/ }).first().click();
  const game = (await page.locator(".gp-title").textContent())!.trim();
  await displayKey(page);
  await expect(page.locator(".key-code")).toBeVisible();
  await page.getByRole("link", { name: "Report a problem with this key" }).click();
  const form = page.getByRole("form", { name: "New ticket" });
  await expect(form.getByLabel("Subject")).toHaveValue("order_issue");
  await expect(form.getByLabel("Order number")).toHaveValue(/^CC-[A-Z0-9]{8}$/);
  const orderNo = await form.getByLabel("Order number").inputValue();
  await form.getByLabel("Description").fill("Steam says the key is already used.");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: /Order issue$/ })).toBeVisible();
  await expect(page.locator(".tk-meta")).toContainText(`Order ${orderNo} · Key: `);
  await expect(page.locator(".tk-meta")).toContainText(`Key: ${game} (revealed`);
  await page.locator(".tk-meta").getByRole("link", { name: game }).click();
  await expect(page).toHaveURL(/account\/keys\/view\/?\?id=/);
  if (isMobile) await expect(page.getByRole("combobox", { name: "Account section" })).toBeVisible();
});

test("returns tab link prefills Return/refund; 6th new ticket in an hour is refused", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await page.goto("account/orders/?tab=returns");
  await page.getByRole("link", { name: "Open a ticket" }).click();
  const form = page.getByRole("form", { name: "New ticket" });
  await expect(form.getByLabel("Subject")).toHaveValue("return_refund");
  await expect(form.getByLabel("Order number", { exact: true })).toHaveValue(""); // required for Return/refund (no "(optional)")
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Cancel" }).click();
  for (let i = 1; i <= 5; i++) {
    await newTicket(page, "Questions", `Hello ${i}`);
    await expect(page.getByRole("heading", { name: `#${1000 + i} Questions` })).toBeVisible();
    await page.getByRole("button", { name: "‹ All tickets" }).click();
  }
  await expect(page.locator(".tickets-table tbody tr")).toHaveCount(5);
  await newTicket(page, "General support", "Hello 6");
  await expect(page.getByText("You opened several tickets in the last hour.", { exact: false })).toBeVisible();
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Tickets" })).toHaveAttribute("aria-current", "page");
});
