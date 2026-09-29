import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin, uniqueEmail } from "./helpers";

// T3 seller application + close account (demo store = same rules as the server). Desktop and mobile.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });
const signOutDemo = (page: Page) => page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
const box = (page: Page, label: string) => page.getByRole("group", { name: label, exact: true });
async function upload(page: Page, label: string, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await box(page, label).getByLabel(`${label}: choose file`).setInputFiles(files);
  for (const f of files) await expect(box(page, label).getByRole("button", { name: `Remove ${f.name}` })).toBeVisible();
}

// Fills and sends all 4 steps. Returns the SA- number.
async function apply(page: Page, { merchant, idNumber }: { merchant: string; idNumber: string }) {
  await page.evaluate(() => localStorage.removeItem("corecart-sell-draft")); // start clean (the form keeps a draft)
  await page.goto("sell/apply/");
  await page.getByLabel("First name").fill("Somchai");
  await page.getByLabel("Last name").fill("Srisuk");
  await page.getByLabel("Merchant name (shown to buyers)").fill(merchant);
  await page.getByLabel("Why do you want to sell on CoreCart?").fill("I run a licensed key shop and want to reach more gamers.");
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("checkbox", { name: "Official distributor" }).check();
  await page.getByLabel("Business location").selectOption("TH");
  await page.getByLabel("Citizenship").selectOption("TH");
  await page.getByLabel("How many codes do you have in stock?").selectOption("100–1,000");
  await page.getByRole("checkbox", { name: "Game keys" }).check();
  await upload(page, "Sample invoices (1–5)", [{ name: "invoice-1.pdf", mimeType: "application/pdf", buffer: PDF }]);
  await upload(page, "Photos of keys you hold (1–5)", [png("keys-1.png")]);
  await page.getByLabel("How did you hear about us?").selectOption("Search engine");
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("radio", { name: "Yes" }).check();
  await page.getByLabel("Company name").fill(`${merchant} Co., Ltd.`);
  await page.getByLabel("Registration number").fill("0105561234567");
  await page.getByLabel("Tax ID / VAT number").fill("0105561234567");
  await page.getByLabel("Company address").fill("1 Sukhumvit Rd, Bangkok 10110");
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByLabel("ID type").selectOption("national_id");
  await page.getByLabel("ID number").fill(idNumber);
  await upload(page, "ID front", [png("id-front.png")]);
  await upload(page, "ID back", [png("id-back.png")]);
  await page.getByRole("checkbox", { name: /I confirm the details are true/ }).check();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Submit application" }).click();
  const done = page.getByRole("region", { name: "Application sent" });
  await expect(done.getByRole("heading", { name: "Application sent" })).toBeVisible();
  return (await done.locator("strong").first().textContent())!;
}
async function openApplication(page: Page, number: string, tab = "Pending") {
  await page.goto("admin/sellers/");
  await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill(number);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("link", { name: number }).click();
  await expect(page.getByRole("heading", { name: new RegExp(number) })).toBeVisible();
}

test("register has no account type; footer + account menu lead to Sell on CoreCart; signed-out Start selling asks to sign in", async ({ page }) => {
  await page.goto("register/");
  await expect(page.getByRole("group", { name: "Account type" })).toHaveCount(0);
  await expect(page.getByText("Want to sell? Apply after sign-up", { exact: false })).toBeVisible();
  await page.locator("footer").getByRole("link", { name: "Sell on CoreCart" }).click();
  await expect(page.getByRole("heading", { name: "Sell on CoreCart", level: 1 })).toBeVisible();
  await expect(page.getByText("What you need")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: "Start selling" }).click();
  await expect(page).toHaveURL(/login\/?\?next=%2Fsell%2Fapply/);
});

test("apply in 4 steps: step checks, file type by content, submit → under review; admin sees everything, views ID (audited), approves → seller", async ({ page, isMobile }) => {
  const email = await registerAndVerify(page, { name: "Somchai Srisuk" });
  await page.goto("sell/apply/");
  if (isMobile) await expect(page.getByText("Step 1 of 4 · Personal")).toBeVisible();
  else await expect(page.getByRole("list", { name: "Step 1 of 4: Personal" })).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByText("Enter your first name.")).toBeVisible();
  await expect(page.getByText("Merchant name: 3–40 letters", { exact: false })).toBeVisible();
  await page.getByLabel("First name").fill("Somchai"); await page.getByLabel("Last name").fill("Srisuk");
  await page.getByLabel("Merchant name (shown to buyers)").fill("KeyShop TH"); await page.getByLabel("Why do you want to sell on CoreCart?").fill("I run a licensed key shop and want to reach more gamers.");
  await page.getByRole("button", { name: "Next →" }).click();
  // A text file named .png is refused (type checked by content); a PDF is not allowed as a key photo.
  await box(page, "Photos of keys you hold (1–5)").getByLabel("Photos of keys you hold (1–5): choose file").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("hello, not an image") });
  await expect(page.getByText("fake.png: Use a JPG, PNG, WebP or PDF file.")).toBeVisible();
  await box(page, "Photos of keys you hold (1–5)").getByLabel("Photos of keys you hold (1–5): choose file").setInputFiles({ name: "keys.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("keys.pdf: Use a JPG, PNG or WebP image.")).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByText("Upload 1–5 sample invoices.")).toBeVisible();
  await noHorizontalScroll(page);

  const number = await apply(page, { merchant: `KeyShop ${Date.now().toString(36)}`, idNumber: `1-2345-${Date.now().toString().slice(-5)}-12-3` });
  expect(number).toMatch(/^SA-1\d{5}$/);
  await page.getByRole("link", { name: "Go to my account" }).click();
  const card = page.getByRole("region", { name: "Seller application" });
  await expect(card).toContainText(number); await expect(card).toContainText("Under review");
  await page.goto("sell/apply/");
  await expect(page.getByRole("heading", { name: "Application under review" })).toBeVisible();

  await signOutDemo(page);
  await signInDemoAdmin(page);
  await openApplication(page, number);
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.locator(".sa-id")).toHaveText(/^12345\d{5}123$/); // "1-2345-…-12-3" saved as letters + digits only
  await expect(page.getByText("0105561234567").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Files (4)" })).toBeVisible();
  await page.getByRole("button", { name: /^View ID front/ }).click();
  const viewer = page.getByRole("dialog", { name: /ID front/ });
  await expect(viewer.locator("img")).toBeVisible();
  await noHorizontalScroll(page);
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".adm-audit li").first()).toContainText("Viewed ID front (id-front.png)");
  await expect(page.locator(".adm-audit li").first()).toContainText("admin@corecart.demo");
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("alertdialog", { name: "Confirm approve" }).getByRole("button", { name: "Confirm approve" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Approved");
  await page.getByRole("link", { name: email }).click();
  await expect(page.locator(".acct-tile", { hasText: "Role" }).locator("strong")).toHaveText("Seller");
  await expect(page.locator(".adm-audit li").first()).toContainText(`customer → seller (${number} approved)`);
});

test("reject + blacklist are kept; a new application with the same ID number is flagged as a returning person", async ({ page }) => {
  const idNumber = `9${Date.now().toString().slice(-9)}`;
  await registerAndVerify(page, { name: "First Applicant" });
  const first = await apply(page, { merchant: `Shady ${Date.now().toString(36)}`, idNumber });
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await openApplication(page, first);
  await page.getByRole("button", { name: "Reject…" }).click();
  const dlg = page.getByRole("alertdialog", { name: "Confirm reject" });
  await dlg.getByRole("button", { name: "Confirm reject" }).click();
  await expect(page.getByText("Enter a reason (3–500 characters).")).toBeVisible();
  await dlg.getByLabel("Reason (required)").fill("Invoices do not match the company");
  await dlg.getByRole("button", { name: "Confirm reject" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Rejected");
  await page.getByRole("button", { name: "Blacklist…" }).click();
  await page.getByRole("alertdialog", { name: "Confirm blacklist" }).getByLabel("Reason (required)").fill("Fake invoices");
  await page.getByRole("alertdialog", { name: "Confirm blacklist" }).getByRole("button", { name: "Confirm blacklist" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Blacklisted");
  await expect(page.locator(".adm-audit li").first()).toContainText("Blacklisted: Fake invoices");

  // The applicant sees "not approved" (never the blacklist reason) and may apply again, from another account too.
  await signOutDemo(page);
  await registerAndVerify(page, { name: "Second Applicant" });
  const second = await apply(page, { merchant: `Fresh ${Date.now().toString(36)}`, idNumber });
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/sellers/");
  await expect(page.locator("tr", { hasText: second })).toContainText("⚠ Returning person");
  await openApplication(page, second);
  const flag = page.locator(".sa-matches");
  await expect(flag).toContainText(`Same KYC ID number as ${first} (Blacklisted: “Fake invoices”)`);
  await flag.getByRole("link", { name: `Open ${first}` }).click();
  await expect(page.getByRole("heading", { name: new RegExp(first) })).toBeVisible();
  await page.goto("admin/sellers/?tab=blacklisted");
  await expect(page.getByRole("tab", { name: /^Blacklisted/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: first })).toBeVisible();
});

test("close account: data kept, sign-in blocked, Closed tab; same email signs up again → returning person; seller application moves to Closed", async ({ page }) => {
  const email = uniqueEmail("closer");
  await registerAndVerify(page, { name: "Closing Person", email });
  const number = await apply(page, { merchant: `Closer ${Date.now().toString(36)}`, idNumber: `7${Date.now().toString().slice(-8)}` });
  await page.goto("account/settings/");
  await page.getByRole("button", { name: "Close account…" }).click();
  await page.getByLabel("Password (leave empty for Google-only accounts)").fill("wrong-password-1");
  await page.getByLabel("Type CLOSE to confirm").fill("close");
  await page.getByRole("button", { name: "Close my account" }).click();
  await expect(page.getByText("Wrong password.")).toBeVisible();
  await page.getByLabel("Password (leave empty for Google-only accounts)").fill(DEMO_PASSWORD);
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Close my account" }).click();
  await expect(page.getByText("Your account is closed and you are signed out everywhere.", { exact: false })).toBeVisible();
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("This account is closed. Contact support to reopen it.")).toBeVisible();

  // Same email again → a new customer account (allowed), flagged to admins.
  await registerAndVerify(page, { name: "Back Again", email });
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/users/");
  await page.getByRole("tab", { name: "Closed" }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("closing person");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".adm-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".adm-table tbody tr")).toContainText("Closed");
  await page.getByRole("tab", { name: "Active" }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill(email);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".adm-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".adm-table tbody tr")).toContainText("⚠ Returning person");
  await page.locator(".adm-table tbody tr").first().getByRole("link").first().click();
  await expect(page.locator(".sa-matches")).toContainText(`Same email as a closed account (${email})`);
  await expect(page.getByRole("button", { name: "Close account…" })).toBeVisible();
  await page.goto("admin/sellers/?tab=closed");
  await expect(page.getByRole("link", { name: number })).toBeVisible();
});
