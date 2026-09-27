import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";

// Handoff v12 step 2b: keys library (C5), key detail (C6), print as gift (C7), activation guides (C8).
// Demo customers get 2 sample orders after verify: Elden Ring + Cyberpunk 2077 keys (Steam) and one hardware item.
const goSection = async (page: Page, isMobile: boolean, label: string) => {
  if (isMobile) await page.getByRole("combobox", { name: "Account section" }).selectOption({ label });
  else await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: label }).click();
};
const rows = (page: Page) => page.locator(".keys-table tbody tr");

test("keys library: list, search, filter, reveal from detail, copy, back to library", async ({ page, isMobile, context }) => {
  await registerAndVerify(page);
  await goSection(page, isMobile, "Keys library");
  await expect(page.getByRole("heading", { name: "Keys library" })).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText("New");
  await expect(page.locator(".keys-table")).not.toContainText("Seller");
  await page.getByPlaceholder("Search by product name / order ID").fill("elden");
  await expect(rows(page)).toHaveCount(1);
  const orderId = (await rows(page).first().locator("code").textContent())!;
  await page.getByPlaceholder("Search by product name / order ID").fill(orderId.toLowerCase());
  await expect(rows(page)).toHaveCount(2);
  await page.getByPlaceholder("Search by product name / order ID").fill("");
  await page.getByRole("button", { name: /^Revealed/ }).click();
  await expect(page.getByText("No keys match your search.")).toBeVisible();
  await page.getByRole("button", { name: /^Not revealed/ }).click();
  await expect(rows(page)).toHaveCount(2);

  await page.getByRole("link", { name: /Reveal key.*Elden Ring/ }).click();
  await expect(page.getByRole("heading", { name: "Elden Ring" })).toBeVisible();
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Keys library" })).toBeVisible();
  const facts = page.locator(".key-facts");
  for (const f of ["Region", "Platform", "Product type", "Works on"]) await expect(facts).toContainText(f);
  await expect(facts.getByRole("link", { name: "Activation guide" })).toHaveAttribute("href", /help\/activate\/steam/);
  await expect(page.locator(".key-code")).toHaveText("•••••-•••••-•••••");
  await expect(page.getByText("Revealing the key ends the refund window.")).toBeVisible();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.locator(".key-code")).toHaveText(/^DEMO-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  const code = (await page.locator(".key-code").textContent())!;
  await expect(page.getByRole("link", { name: /Activate on Steam/ })).toHaveAttribute("href", "https://store.steampowered.com/account/registerkey");
  await expect(page.getByText(/not eligible for a refund/)).toBeVisible();
  await expect(page.locator(".key-meta")).toContainText("Sold by CoreCart");
  await expect(page.locator(".key-meta")).toContainText("Revealed");
  await expect(page.getByRole("link", { name: "Report a problem with this key" })).toHaveAttribute("href", /account\/tickets\/?\?new=1&key=/);
  if (!isMobile) {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByRole("button", { name: "Copied ✓" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  }
  await noHorizontalScroll(page);

  // Revealed state survives reload; library shows it under Revealed with View key.
  await page.reload();
  await expect(page.locator(".key-code")).toHaveText(code);
  await page.getByRole("link", { name: "My library" }).click();
  await page.getByRole("button", { name: /^Revealed/ }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("link", { name: /View key.*Elden Ring/ })).toBeVisible();
  await noHorizontalScroll(page);
});

test("overview recent purchases link to key detail and count reveals", async ({ page }) => {
  await registerAndVerify(page);
  const recent = page.locator(".purchases");
  await expect(recent.locator(".stats-strip")).toContainText("Not revealed2");
  await recent.getByRole("link", { name: /Reveal.*Cyberpunk 2077/ }).click();
  await page.getByRole("button", { name: "Reveal key" }).click();
  await expect(page.locator(".key-code")).toHaveText(/^DEMO-/);
  await page.goto("account/");
  await expect(recent.locator(".stats-strip")).toContainText("Not revealed1");
  await expect(recent).toContainText("1 key waiting");
  await expect(recent.getByRole("link", { name: /View.*Cyberpunk 2077/ })).toBeVisible();
});

test("print as a gift: to/from/message, key in dashed box, activation steps", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/keys/");
  await page.getByRole("link", { name: /Reveal key.*Elden Ring/ }).click();
  await page.getByRole("button", { name: "Reveal key" }).click();
  const code = (await page.locator(".key-code").textContent())!;
  await page.getByRole("link", { name: "Print as a gift" }).click();
  await expect(page.getByRole("heading", { name: "A gift for you" })).toBeVisible();
  await page.getByLabel("To (optional)").fill("Nok");
  await page.getByLabel("From (optional)").fill("Ann");
  await page.getByLabel("Message (optional)").fill("Happy birthday!");
  const card = page.locator(".gift-card");
  await expect(card).toContainText("To Nok · From Ann");
  await expect(card).toContainText("Happy birthday!");
  await expect(card.locator(".gift-code code")).toHaveText(code);
  await expect(card.locator("ol li")).toHaveCount(5);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".gift-form")).toBeHidden();
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
});

test("activation guides: index + six platform pages", async ({ page }) => {
  await page.goto("help/activate/");
  await expect(page.getByRole("heading", { name: "Activation guides" })).toBeVisible();
  for (const [slug, name] of [["steam", "Steam"], ["xbox", "Xbox"], ["playstation", "PlayStation"], ["nintendo", "Nintendo"], ["ea", "EA app"], ["ubisoft", "Ubisoft Connect"]]) {
    await page.goto(`help/activate/${slug}/`);
    await expect(page.getByRole("heading", { name: `How to activate a key on ${name}` })).toBeVisible();
    await expect(page.locator(".guide-steps li").first()).toBeVisible();
    await expect(page.locator("#region")).toContainText("Region restrictions");
  }
  await noHorizontalScroll(page);
});

test("keys library empty state for an account without orders; unknown key id", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("account/keys/");
  await expect(page.getByText("No keys yet")).toBeVisible();
  await page.goto("account/keys/view/?id=nope");
  await expect(page.getByText("Key not found")).toBeVisible();
});

test("keys library pages at 20 per page", async ({ page, isMobile }) => {
  test.skip(isMobile, "same logic on mobile");
  await registerAndVerify(page);
  await page.goto("account/orders/");
  const add = page.getByRole("button", { name: "Add sample order (test only)" });
  for (let i = 0; i < 19; i++) { await add.click(); await expect(add).toBeEnabled(); }
  await expect(page.locator(".orders-table > tbody > tr:not(.detail-row)")).toHaveCount(21);
  await page.goto("account/keys/");
  await expect(rows(page)).toHaveCount(20);
  await expect(page.getByRole("navigation", { name: "Keys pages" })).toContainText("Page 1 of 2");
  await page.getByRole("button", { name: "Next ›" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next ›" })).toBeDisabled();
});
