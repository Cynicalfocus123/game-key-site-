import { expect, type Page } from "@playwright/test";

// Seller e2e helpers (demo store), shared by sellers.spec.ts (application / KYC) and seller-pages.spec.ts (marketplace step 2).
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
export const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
export const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
export const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });
export const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: PDF });
export const outbox = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("corecart-demo-v1") || "{}").outbox ?? []) as { to: string; template: string; subject: string; html: string }[]);
export const signInAs = (page: Page, email: string) => page.evaluate((e) => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = s.users.find((u: { email: string }) => u.email === e).id; localStorage.setItem(k, JSON.stringify(s)); }, email);
export const signOutDemo = (page: Page) => page.evaluate(() => { const k = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.sessionUserId = null; localStorage.setItem(k, JSON.stringify(s)); });
export const box = (page: Page, title: string) => page.getByRole("group", { name: title, exact: true });
export async function upload(page: Page, title: string, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await box(page, title).getByLabel(`${title}: choose file`).setInputFiles(files);
  for (const f of files) await expect(box(page, title).getByRole("button", { name: `Remove ${f.name}` })).toBeVisible();
}
export const cont = (page: Page) => page.getByRole("button", { name: "Continue", exact: true }).click();
export const radio = (page: Page, group: string, name: string) => page.getByRole("group", { name: group }).getByRole("radio", { name, exact: true }).check();
export async function startType(page: Page, type: "Individual" | "Business") {
  await page.goto("sell/apply/");
  await page.getByRole("radio", { name: new RegExp(`^${type}`) }).check();
  await cont(page);
}
export async function sentNumber(page: Page) {
  const sent = page.getByRole("region", { name: "Request sent" });
  await expect(sent.getByRole("heading", { name: "Your request has been sent" })).toBeVisible();
  return (await sent.locator("b").first().textContent())!;
}

// Individual: Basic details → Proofs → Product description → Send request. Returns the SA- number.
export async function fillIndividualBasic(page: Page, merchant: string) {
  await page.getByLabel("First name").fill("Somchai");
  await page.getByLabel("Last name").fill("Srisuk");
  await page.getByLabel("Merchant name (shown to buyers)").fill(merchant);
  await page.getByLabel("Country of residence").selectOption("TH");
  await page.getByLabel("Citizenship").selectOption("TH");
  await page.getByLabel("How did you hear about us?").selectOption("Search engine");
}
export async function applyIndividual(page: Page, { merchant, idNumber }: { merchant: string; idNumber: string }) {
  await startType(page, "Individual");
  await fillIndividualBasic(page, merchant);
  await cont(page);
  return finishIndividual(page, idNumber);
}
// Proofs + Product description + Send request (from the Proofs step).
export async function finishIndividual(page: Page, idNumber: string) {
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
export async function openApplication(page: Page, number: string, tab = "Pending") {
  await page.goto("admin/sellers/");
  await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill(number);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("link", { name: number, exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(number) })).toBeVisible();
}
