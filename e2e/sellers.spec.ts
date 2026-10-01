import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin, uniqueEmail } from "./helpers";

// T3 seller application, KYC redesign (demo store = same rules as the server) + close account. Desktop and mobile, no skips.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });
const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: PDF });
const outbox = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("corecart-demo-v1") || "{}").outbox ?? []) as { to: string; template: string; subject: string; html: string }[]);
const signInAs = (page: Page, email: string) => page.evaluate((e) => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = s.users.find((u: { email: string }) => u.email === e).id; localStorage.setItem(k, JSON.stringify(s)); }, email);
const signOutDemo = (page: Page) => page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
const box = (page: Page, title: string) => page.getByRole("group", { name: title, exact: true });
async function upload(page: Page, title: string, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await box(page, title).getByLabel(`${title}: choose file`).setInputFiles(files);
  for (const f of files) await expect(box(page, title).getByRole("button", { name: `Remove ${f.name}` })).toBeVisible();
}
const cont = (page: Page) => page.getByRole("button", { name: "Continue", exact: true }).click();
const radio = (page: Page, group: string, name: string) => page.getByRole("group", { name: group }).getByRole("radio", { name, exact: true }).check();
async function startType(page: Page, type: "Individual" | "Business") {
  await page.goto("sell/apply/");
  await page.getByRole("radio", { name: new RegExp(`^${type}`) }).check();
  await cont(page);
}
async function sentNumber(page: Page) {
  const sent = page.getByRole("region", { name: "Request sent" });
  await expect(sent.getByRole("heading", { name: "Your request has been sent" })).toBeVisible();
  return (await sent.locator("b").first().textContent())!;
}

// Individual: Basic details → Proofs → Product description → Send request. Returns the SA- number.
async function fillIndividualBasic(page: Page, merchant: string) {
  await page.getByLabel("First name").fill("Somchai");
  await page.getByLabel("Last name").fill("Srisuk");
  await page.getByLabel("Merchant name (shown to buyers)").fill(merchant);
  await page.getByLabel("Country of residence").selectOption("TH");
  await page.getByLabel("Citizenship").selectOption("TH");
  await page.getByLabel("How did you hear about us?").selectOption("Search engine");
}
async function applyIndividual(page: Page, { merchant, idNumber }: { merchant: string; idNumber: string }) {
  await startType(page, "Individual");
  await fillIndividualBasic(page, merchant);
  await cont(page);
  return finishIndividual(page, idNumber);
}
// Proofs + Product description + Send request (from the Proofs step).
async function finishIndividual(page: Page, idNumber: string) {
  await page.getByRole("checkbox", { name: "Game keys" }).check();
  await page.getByLabel("Document type").selectOption("national_id");
  await page.getByLabel("Document number").fill(idNumber);
  await upload(page, "Front side of your ID card", [png("id-front.png")]);
  await upload(page, "Back side of your ID card", [png("id-back.png")]);
  await upload(page, "Selfie holding the same document", [png("selfie.png")]);
  await cont(page);
  await radio(page, "Where do you purchase your products?", "Purchasing from suppliers");
  await upload(page, "Invoice / Agreement", [pdf("invoice-1.pdf")]);
  await page.getByLabel("Product procurement source").fill("Licensed distributor in Bangkok, monthly B2B orders.");
  await radio(page, "How many products do you have in stock?", "10–50");
  await radio(page, "Do you sell on other platforms?", "No");
  await page.getByRole("checkbox", { name: /I confirm the details are true/ }).check();
  await page.getByRole("checkbox", { name: /I agree to the terms and conditions/ }).check();
  await page.getByRole("button", { name: "Send request" }).click();
  return sentNumber(page);
}
async function openApplication(page: Page, number: string, tab = "Pending") {
  await page.goto("admin/sellers/");
  await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill(number);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("link", { name: number, exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(number) })).toBeVisible();
}

test("register has no account type; footer + account menu lead to Sell on CoreCart; signed-out Start selling asks to sign in", async ({ page }) => {
  await page.goto("register/");
  await expect(page.getByRole("group", { name: "Account type" })).toHaveCount(0);
  await expect(page.getByText("Want to sell? Apply after sign-up", { exact: false })).toBeVisible();
  await page.locator("footer").getByRole("link", { name: "Sell on CoreCart" }).click();
  await expect(page.getByRole("heading", { name: "Sell on CoreCart", level: 1 })).toBeVisible();
  await expect(page.getByText("What you need")).toBeVisible();
  await expect(page.getByText("JPEG, PNG, GIF or PDF, up to 10 MB each", { exact: false })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: "Start selling" }).click();
  await expect(page).toHaveURL(/login\/?\?next=%2Fsell%2Fapply/);
});

test("Individual: type choice, grey Continue shows what is missing, file type by content, selfie no GIF, ticks required, Final step; admin list + one detail page, viewer Previous / Next audited, approve → seller", async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  const email = await registerAndVerify(page, { name: "Somchai Srisuk" });
  await page.goto("sell/apply/");
  await expect(page.getByRole("heading", { name: "Become a seller" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Choose Individual or Business.")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("radio", { name: /^Individual/ }).check();
  await cont(page);
  await expect(page.getByRole("heading", { name: "Personal verification" })).toBeVisible();
  if (isMobile) { await expect(page.getByText("Step 1 of 3 · Basic details")).toBeVisible(); await expect(page.getByRole("navigation", { name: "Progress" })).toBeHidden(); }
  else await expect(page.getByRole("navigation", { name: "Progress" })).toContainText("Progress (0/5)");
  const go = page.getByRole("button", { name: "Continue", exact: true });
  await expect(go).toHaveClass(/\boff\b/);
  await go.click();
  await expect(page.getByText("Enter the first name.")).toBeVisible();
  await expect(page.getByText("Merchant name: 3–40 letters", { exact: false })).toBeVisible();
  const merchant = `KeyShop ${Date.now().toString(36)}`;
  await fillIndividualBasic(page, merchant);
  await expect(go).not.toHaveClass(/\boff\b/);
  await go.click();
  if (isMobile) await expect(page.getByText("Step 2 of 3 · Proofs")).toBeVisible();
  else await expect(page.getByRole("navigation", { name: "Progress" })).toContainText("Basic detailsCompleted");
  // Type by content: a text file named .png is refused; a GIF is refused as a selfie (JPEG, PNG or PDF only) but fine as an ID.
  await page.getByLabel("Document type").selectOption("national_id");
  await box(page, "Front side of your ID card").getByLabel("Front side of your ID card: choose file").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("hello, not an image") });
  await expect(page.getByText("✕ fake.png: Use a JPEG, PNG, GIF or PDF file.")).toBeVisible();
  await box(page, "Selfie holding the same document").getByLabel("Selfie holding the same document: choose file").setInputFiles({ name: "selfie.gif", mimeType: "image/gif", buffer: GIF });
  await expect(page.getByText("✕ selfie.gif: Use a JPEG, PNG or PDF file.")).toBeVisible();
  await upload(page, "Front side of your ID card", [{ name: "id-front.gif", mimeType: "image/gif", buffer: GIF }]);
  await box(page, "Front side of your ID card").getByRole("button", { name: "Remove id-front.gif" }).click();
  await noHorizontalScroll(page);

  const idNumber = `1-2345-${Date.now().toString().slice(-5)}-12-3`;
  const number = await finishIndividual(page, idNumber);
  expect(number).toMatch(/^SA-1\d{5}$/);
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Progress" })).toContainText("ApprovingWaiting for admin");
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: "Go to details" }).click();
  await expect(page.getByRole("region", { name: "1 · Basic details" })).toContainText(merchant);
  await expect(page.getByRole("region", { name: "2 · Proofs" })).toContainText(`•••• ${idNumber.replace(/\D/g, "").slice(-4)}`);
  await expect(page.getByText("Files you sent (4)")).toBeVisible();
  await page.goto("account/");
  const card = page.getByRole("region", { name: "Seller application" });
  await expect(card).toContainText(number); await expect(card).toContainText("Approving"); await expect(card).toContainText("Individual");
  await page.goto("sell/apply/");
  await expect(page.getByRole("heading", { name: "Your request has been sent" })).toBeVisible();
  expect((await outbox(page)).some((m) => m.to === email && m.template === "sellerReceived")).toBe(true);

  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/sellers/");
  const row = page.locator("tr", { hasText: number });
  await expect(row).toContainText("Individual"); await expect(row).toContainText(merchant);
  await noHorizontalScroll(page);
  await row.getByRole("link", { name: `Open › ${number}` }).click();
  await expect(page.getByRole("heading", { name: new RegExp(number) })).toBeVisible();
  await expect(page.getByRole("region", { name: "Application", exact: true })).toContainText("✓ Agreed");
  await expect(page.locator(".sa-id")).toHaveText(/^12345\d{5}123$/); // "1-2345-…-12-3" saved as letters + digits only
  await expect(page.getByRole("region", { name: "3 · Product description" })).toContainText("Licensed distributor in Bangkok");
  await expect(page.getByRole("heading", { name: "Files (4)" })).toBeVisible();
  await expect(page.locator(".sa-grp")).toHaveText(["Proofs", "Product description"]);
  await page.getByRole("button", { name: "Open viewer from the first file" }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toContainText("Front side of your ID card"); await expect(viewer).toContainText("file 1 of 4");
  await expect(viewer.locator("img")).toBeVisible();
  await viewer.getByRole("button", { name: "Next ›" }).click();
  await expect(viewer).toContainText("file 2 of 4"); await expect(viewer).toContainText("id-back.png");
  await noHorizontalScroll(page);
  await viewer.getByRole("button", { name: "✕ Close" }).click();
  await expect(page.locator(".adm-audit li").first()).toContainText("Viewed ID back (id-back.png)");
  await expect(page.locator(".adm-audit li").nth(1)).toContainText("Viewed ID front (id-front.png)");
  await expect(page.locator(".adm-audit li").first()).toContainText("admin@corecart.demo");
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("alertdialog", { name: "Confirm approve" }).getByRole("button", { name: "Confirm approve" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Approved");
  await page.getByRole("link", { name: email }).first().click();
  await expect(page.locator(".acct-tile", { hasText: "Role" }).locator("strong")).toHaveText("Seller");
});

test("Business: Save for later + dashboard card + resume, 7 documents (tax skipped), representative + UBO, trade reference invoice = 10-day freeze, offers + ticks; admin sees every answer + every file; reject → Apply again prefilled", async ({ page, isMobile }) => {
  test.setTimeout(300_000);
  const email = await registerAndVerify(page, { name: "Anan Keyhub" });
  const company = `KeyHub ${Date.now().toString(36)} Co., Ltd.`; const merchant = `KeyHub ${Date.now().toString(36)}`; const repEmail = uniqueEmail("rep");
  await startType(page, "Business");
  await expect(page.getByRole("heading", { name: "Business verification" })).toBeVisible();
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Progress" })).toContainText("Progress (0/7)");
  await page.getByLabel("Company name").fill(company);
  await page.getByLabel("Merchant name (shown to buyers)").fill(merchant);
  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByText("Saved. You can finish later from your dashboard.")).toBeVisible();
  await page.goto("account/");
  const draftCard = page.getByRole("region", { name: "Seller application in progress" });
  await expect(draftCard).toContainText("In progress (0%)"); await expect(draftCard).toContainText("0 out of 5 steps completed · next: Basic details");
  await noHorizontalScroll(page);
  await draftCard.getByRole("link", { name: "Complete application" }).click();
  await expect(page.getByLabel("Company name")).toHaveValue(company); // resumed from the server draft
  await page.getByLabel("Registration number").fill("0105566012345");
  await page.getByLabel("Registration (place / type)").fill("Bangkok · Co., Ltd.");
  await page.getByLabel("Country").selectOption("TH");
  await page.getByLabel("Address 1").fill("12 Sukhumvit Rd, Khlong Toei");
  const state = page.getByLabel(/^State \/ province/);
  if ((await state.evaluate((x) => x.tagName)) === "SELECT") await state.selectOption({ index: 1 }); else await state.fill("Bangkok");
  await page.getByLabel("Postal code").fill("10110");
  await page.getByLabel("City").fill("Bangkok");
  await cont(page);

  // Documentation: certificate + supporting documents 1–7 (4 Tax registration optional, skipped).
  await expect(page.getByText("Upload documents (0 of 7 done)")).toBeVisible();
  await upload(page, "Certificate of Incorporation", [pdf("certificate.pdf")]);
  await upload(page, "Government ID", [png("director-passport.png"), png("owner-id.png")]);
  for (const [n, title, file] of [["2", "Business registration", "dbd-extract.pdf"], ["3", "Proof of business address", "electric-bill.pdf"], ["5", "Proof of legitimate key supply", "distributor.pdf"], ["6", "List of shareholders / UBOs", "ubo-list.pdf"], ["7", "Articles of association", "articles.pdf"]] as const) {
    await page.getByRole("button", { name: new RegExp(`^${n} ${title.replace("/", "\\/")}`) }).click();
    await upload(page, title, [pdf(file)]);
  }
  await expect(page.getByText("Upload documents (6 of 7 done)")).toBeVisible();
  await noHorizontalScroll(page);
  await cont(page);

  // Representative + CEO same + UBO (add / remove another) + passport + selfie.
  const rep = page.getByRole("region", { name: "Representative" });
  await rep.getByLabel("Full name").fill("Somchai Prasert");
  await rep.getByLabel("Date of birth").fill("1996-10-05");
  await rep.getByLabel("Email address").fill(repEmail);
  await rep.getByLabel("Phone number: country code").selectOption("TH");
  await rep.getByLabel("Phone number: number").fill("812345678");
  await rep.getByLabel("Basis of representation").fill("CEO");
  await rep.getByLabel("Citizenship").selectOption("TH");
  const ubo = page.getByRole("group", { name: "UBO 1" });
  await ubo.getByLabel("Full name").fill("Somchai Prasert"); await ubo.getByLabel("Date of birth").fill("1996-10-05"); await ubo.getByLabel("Country").selectOption("TH");
  await ubo.getByLabel("Address").fill("12 Sukhumvit Rd"); await ubo.getByLabel("City").fill("Bangkok"); await ubo.getByLabel("ZIP code").fill("10110");
  await page.getByRole("button", { name: /Add another UBO/ }).click();
  await expect(page.getByRole("group", { name: "UBO 2" })).toBeVisible();
  await page.getByRole("button", { name: "Remove UBO 2" }).click();
  await expect(page.getByRole("group", { name: "UBO 2" })).toHaveCount(0);
  await page.getByLabel("Document type").selectOption("passport");
  await page.getByLabel("Document number").fill(`AA${Date.now().toString().slice(-7)}`);
  await upload(page, "Passport main page (international passport with MRZ, no cover)", [png("passport.png")]);
  await upload(page, "Selfie holding the same document", [pdf("selfie.pdf")]);
  await cont(page);

  // Trade reference: B2B invoice only → 10-day freeze note.
  await expect(page.getByText("We will require proof of partnership.")).toBeVisible();
  await page.getByLabel("Supplier name").fill("Supplier X");
  await radio(page, "Company type", "Publisher");
  await page.getByLabel("Company name").fill("Supplier X GmbH");
  await page.getByLabel("Country").selectOption("DE");
  await page.getByLabel("Address").fill("Alexanderplatz 1"); await page.getByLabel("City").fill("Berlin"); await page.getByLabel("ZIP code").fill("10115");
  await page.getByRole("checkbox", { name: "Games", exact: true }).check();
  await radio(page, "What are you uploading?", "B2B invoice (last month)");
  await expect(page.getByText("10-day freeze period")).toBeVisible();
  await upload(page, "Contract / confirmation / invoice", [png("supplierx-invoice.png")]);
  await noHorizontalScroll(page);
  await cont(page);

  // Offer details; Send request needs the two ticks.
  await page.getByRole("checkbox", { name: "Game keys" }).check();
  await page.getByRole("tab", { name: /Other products/ }).click();
  await page.getByRole("checkbox", { name: "Direct top up" }).check();
  await page.getByLabel("Product 1").fill("Steam keys");
  await radio(page, "What is the expected quantity you will upload for each of the products?", "20–100");
  await radio(page, "Will you be using our API services?", "No");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Agree to the terms and conditions.", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I confirm the details are true/ }).check();
  await page.getByRole("checkbox", { name: /I agree to the terms and conditions/ }).check();
  await page.getByRole("button", { name: "Send request" }).click();
  const number = await sentNumber(page);
  await expect(page.getByRole("region", { name: "Request sent" })).toContainText(company);
  const mails = await outbox(page);
  expect(mails.some((m) => m.to === repEmail && m.template === "sellerReceived")).toBe(true); // representative gets the email too
  await page.goto("sell/details/");
  await expect(page.getByRole("region", { name: "1 · Company details" })).toContainText(company);
  await expect(page.locator(".sell-dfiles li", { hasText: "4 Tax registration" })).toContainText("Not sent (optional)");

  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/sellers/");
  const row = page.locator("tr", { hasText: number });
  await expect(row).toContainText("Business"); await expect(row).toContainText("10-day freeze"); await expect(row).toContainText(company);
  await openApplication(page, number);
  await expect(page.locator(".sa-head")).toContainText("10-day freeze");
  await expect(page.getByRole("region", { name: "1 · Company details" })).toContainText("0105566012345");
  await expect(page.getByRole("region", { name: "3 · Representative" })).toContainText("+66 812345678");
  await expect(page.getByRole("region", { name: "3 · Representative" })).toContainText("Same as representative");
  await expect(page.getByRole("region", { name: "UBOs (1)" })).toContainText("05 Oct 1996");
  await expect(page.getByRole("region", { name: "4 · Trade reference 1" })).toContainText("B2B invoice (last month) · 1 file");
  await expect(page.getByRole("region", { name: "5 · Offer details" })).toContainText("Direct top up");
  await expect(page.getByRole("region", { name: "Application", exact: true })).toContainText("version 2026-09-30");
  await expect(page.getByRole("heading", { name: "Files (11)" })).toBeVisible();
  await expect(page.locator(".sa-none", { hasText: "4 Tax registration" })).toContainText("Not sent (optional)");
  await expect(page.locator(".sa-grp", { hasText: "Trade references — Supplier X" })).toBeVisible();
  await page.getByRole("button", { name: /^View Confirmation from supplier/ }).click();
  await expect(page.getByRole("dialog")).toContainText("file 11 of 11");
  await page.getByRole("dialog").getByRole("button", { name: "✕ Close" }).click();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Reject…" }).click();
  await page.getByRole("alertdialog", { name: "Confirm reject" }).getByLabel("Reason (required)").fill("Invoice older than one month");
  await page.getByRole("alertdialog", { name: "Confirm reject" }).getByRole("button", { name: "Confirm reject" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Rejected");
  const rejected = (await outbox(page)).find((m) => m.to === email && m.template === "sellerRejected")!;
  expect(rejected.subject).toBe("Your CoreCart business verification was declined");
  expect(rejected.html).toContain("Invoice older than one month");

  // Apply again: a new draft with the old answers (no files, no document number).
  await signInAs(page, email);
  await page.goto("account/");
  await page.getByRole("link", { name: "Apply again" }).click();
  await expect(page.getByText("Your earlier answers are filled in.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Business/ })).toBeChecked();
  await cont(page);
  await expect(page.getByLabel("Company name")).toHaveValue(company);
});

test("unfinished application card: N of 3 steps, Delete asks first, Keep it keeps it, Delete application clears it", async ({ page }) => {
  await registerAndVerify(page, { name: "Draft Person" });
  await startType(page, "Individual");
  await fillIndividualBasic(page, `Drafty ${Date.now().toString(36)}`);
  await cont(page);
  await expect(page.getByLabel("Document type")).toBeVisible();
  await page.goto("sell/");
  const card = page.getByRole("region", { name: "Seller application in progress" });
  await expect(card).toContainText("In progress (33%)"); await expect(card).toContainText("1 out of 3 steps completed · next: Proofs");
  await expect(page.getByRole("link", { name: "Start selling" })).toHaveCount(0);
  await noHorizontalScroll(page);
  await card.getByRole("button", { name: "Delete" }).click();
  const ask = card.getByRole("alertdialog", { name: "Delete this application?" });
  await expect(ask).toContainText("Files you uploaded are kept by CoreCart");
  await ask.getByRole("button", { name: "Keep it" }).click();
  await expect(card.getByRole("link", { name: "Complete application" })).toBeVisible();
  await card.getByRole("button", { name: "Delete" }).click();
  await card.getByRole("button", { name: "Delete application" }).click();
  await expect(card).toHaveCount(0);
  await page.goto("account/");
  await expect(page.getByRole("region", { name: "Seller application in progress" })).toHaveCount(0);
  await page.goto("sell/apply/");
  await expect(page.getByRole("heading", { name: "Become a seller" })).toBeVisible(); // starts again
});

test("reject + blacklist are kept; a new application with the same ID number is flagged as a returning person", async ({ page }) => {
  test.setTimeout(180_000);
  const idNumber = `9${Date.now().toString().slice(-9)}`;
  const firstEmail = await registerAndVerify(page, { name: "First Applicant" });
  const first = await applyIndividual(page, { merchant: `Shady ${Date.now().toString(36)}`, idNumber });
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await openApplication(page, first);
  await page.getByRole("button", { name: "Reject…" }).click();
  const dlg = page.getByRole("alertdialog", { name: "Confirm reject" });
  await dlg.getByRole("button", { name: "Confirm reject" }).click();
  await expect(page.getByText("Enter a reason (3–500 characters).")).toBeVisible();
  await dlg.getByLabel("Reason (required)").fill("Invoices do not match");
  await dlg.getByRole("button", { name: "Confirm reject" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Rejected");
  const rejected = (await outbox(page)).find((m) => m.to === firstEmail && m.template === "sellerRejected")!;
  expect(rejected.subject).toBe("Your CoreCart personal verification was declined");
  expect(rejected.html).toContain("Personal verification rejected");
  expect(rejected.html).toContain("Invoices do not match");
  expect(rejected.html).toContain("CONTACT SUPPORT TEAM");
  await page.getByRole("button", { name: "Blacklist…" }).click();
  await page.getByRole("alertdialog", { name: "Confirm blacklist" }).getByLabel("Reason (required)").fill("Fake invoices");
  await page.getByRole("alertdialog", { name: "Confirm blacklist" }).getByRole("button", { name: "Confirm blacklist" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Blacklisted");
  await expect(page.locator(".adm-audit li").first()).toContainText("Blacklisted: Fake invoices");

  // The applicant sees "not approved" (never the blacklist reason) and may apply again, from another account too.
  await signOutDemo(page);
  await registerAndVerify(page, { name: "Second Applicant" });
  const second = await applyIndividual(page, { merchant: `Fresh ${Date.now().toString(36)}`, idNumber });
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
  await expect(page.getByRole("link", { name: first, exact: true })).toBeVisible();
});

test("close account: data kept, sign-in blocked, Closed tab; same email signs up again → returning person; seller application moves to Closed", async ({ page }) => {
  test.setTimeout(180_000);
  const email = uniqueEmail("closer");
  await registerAndVerify(page, { name: "Closing Person", email });
  const number = await applyIndividual(page, { merchant: `Closer ${Date.now().toString(36)}`, idNumber: `7${Date.now().toString().slice(-8)}` });
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
  await expect(page.getByRole("link", { name: number, exact: true })).toBeVisible();
});
