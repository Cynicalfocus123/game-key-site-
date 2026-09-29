import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, signInDemoAdmin } from "./helpers";

// Task B: admin products (list + editor + locked 4:5 image) → storefront (listing, search, product page, cart), and the platform / edition
// picker. Every test runs on desktop and mobile. The image file is a landscape 700 x 467 photo: the crop box turns it into 800 x 1000.
const PHOTO = path.join(process.cwd(), "public/images/placeholders/game-placeholder-03.jpg");
const editor = (page: Page) => page.locator("form.prod-editor");

async function uploadImage(page: Page) {
  await editor(page).locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(page.getByRole("slider")).toBeVisible();
  await page.getByRole("slider").fill("1.5"); // zoom
  const frame = page.getByRole("application", { name: /Image position/ });
  await frame.focus(); await page.keyboard.press("ArrowLeft"); // move
  await page.getByRole("button", { name: "Use this image" }).click();
  await expect(page.getByRole("button", { name: "Replace image" })).toBeVisible();
  await expect(page.getByText("Image ready (800 × 1000)")).toBeVisible();
}

test("admin adds a game key with a cropped image; store shows it everywhere", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/products/");
  await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Elden Ring", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Add product" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add product" })).toBeVisible();
  await expect(page.getByText("800 × 1000 px (4:5)")).toBeVisible();

  // Saving without the required fields shows the first problem, nothing is created.
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.locator(".pc-summary .field-error")).toHaveText("Enter a name (up to 120 characters).");

  await page.getByLabel("Name", { exact: true }).fill("Hollow Knight Silksong");
  await expect(page.getByLabel("Product ID")).toHaveValue("key-hollow-knight-silksong-steam");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.locator(".pc-summary .field-error")).toHaveText("Enter a price between ฿0.01 and ฿1,000,000.");
  await page.locator("#p-price-in").fill("450");
  await page.locator("#p-old-in").fill("600");
  await expect(page.getByText(/Shows as −25% on sale/)).toBeVisible();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.locator(".pc-summary .field-error")).toHaveText("Upload the product image (800 × 1000).");
  await uploadImage(page);

  await page.getByRole("radio", { name: "Only in these countries" }).check();
  await page.getByRole("button", { name: "East + Southeast Asia" }).click();
  await expect(page.getByLabel(/Country codes/)).toHaveValue(/TH/);
  await page.getByRole("checkbox", { name: "Action", exact: true }).check();
  await page.getByLabel("Description").fill("Explore a haunted kingdom of silk and song.");
  await page.getByRole("radio", { name: "Published (in the store)" }).check();
  await page.getByRole("checkbox", { name: "Trending now" }).check();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Hollow Knight Silksong saved.")).toBeVisible();
  await expect(page.locator(".prod-table")).toContainText("key-hollow-knight-silksong-steam");

  // Product page: saved image is exactly 800 x 1000; region rule works for Thailand; description shows.
  await page.goto("product/?id=key-hollow-knight-silksong-steam");
  await expect(page.getByRole("heading", { level: 1, name: "Hollow Knight Silksong" })).toBeVisible();
  const size = await page.locator(".pdp-media img").evaluate(async (i: HTMLImageElement) => { await i.decode(); return [i.naturalWidth, i.naturalHeight]; });
  expect(size).toEqual([800, 1000]);
  await expect(page.locator(".pdp-facts")).toContainText("Can be activated in Thailand");
  await expect(page.getByText("Explore a haunted kingdom of silk and song.")).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /^Shopping cart/ })).toHaveAccessibleName("Shopping cart, 1 item");

  // Listing (home Trending section, /games, search) and cart keep it after a reload.
  await page.goto("");
  await expect(page.getByRole("link", { name: "Hollow Knight Silksong", exact: true })).toBeVisible();
  await page.goto("games/?genre=Action");
  await expect(page.getByRole("link", { name: "Hollow Knight Silksong", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Search products" }).fill("silksong");
  await expect(page.getByRole("listbox", { name: "Search suggestions" })).toContainText("Hollow Knight Silksong");
  await page.goto("cart/");
  await expect(page.locator(".cart-row")).toContainText("Hollow Knight Silksong");
});

test("admin edits price, drafts and deletes a product; store follows", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/products/edit/?id=key-doom-eternal-steam");
  await expect(page.getByRole("heading", { level: 1, name: "Edit product" })).toBeVisible();
  await expect(page.getByLabel("Product ID")).toBeDisabled();
  await page.locator("#p-price-in").fill("299");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("DOOM Eternal saved.")).toBeVisible();
  await page.goto("product/?id=key-doom-eternal-steam");
  await expect(page.locator(".pdp-price")).toContainText("299");

  // Draft = gone from the store (product page, listing), still in admin.
  await page.goto("admin/products/edit/?id=key-doom-eternal-steam");
  await page.getByRole("radio", { name: "Draft (admin only)" }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".prod-table tr", { hasText: "DOOM Eternal" })).toContainText("Draft");
  await page.goto("product/?id=key-doom-eternal-steam");
  await expect(page.getByRole("heading", { name: "Product not found" })).toBeVisible();
  await page.goto("games/");
  await expect(page.getByRole("link", { name: "DOOM Eternal", exact: true })).toHaveCount(0);

  // Delete asks first, then the product leaves the admin list too.
  await page.goto("admin/products/");
  await page.getByRole("searchbox").fill("tekken");
  await page.getByRole("button", { name: "Delete Tekken 8" }).click();
  await expect(page.getByRole("dialog")).toContainText("Delete Tekken 8?");
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Tekken 8 deleted.")).toBeVisible();
  await expect(page.locator(".prod-table")).toHaveCount(0);
  await page.goto("product/?id=key-tekken-8-steam");
  await expect(page.getByRole("heading", { name: "Product not found" })).toBeVisible();
});

test("product page picker switches platform, edition and region within a game group", async ({ page }) => {
  await page.goto("product/?id=key-gta-4-complete-steam");
  const platform = page.getByRole("group", { name: "Platform" }); const edition = page.getByRole("group", { name: "Edition" });
  await expect(platform.getByRole("link", { name: "Steam" })).toHaveAttribute("aria-current", "true");
  await expect(edition.getByRole("link", { name: "Complete Edition" })).toHaveAttribute("aria-current", "true");
  await platform.getByRole("link", { name: "Xbox" }).click();
  await expect(page).toHaveURL(/id=key-gta-4-xbox/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grand Theft Auto IV");
  await expect(page.getByRole("group", { name: "Platform" }).getByRole("link", { name: "Xbox" })).toHaveAttribute("aria-current", "true");
  await page.getByRole("group", { name: "Edition" }).getByRole("link", { name: "Complete Edition" }).click();
  await expect(page).toHaveURL(/id=key-gta-4-complete-steam/);
  await noHorizontalScroll(page);
  // A product without a game group has no picker.
  await page.goto("product/?id=key-elden-ring-steam");
  await expect(page.locator(".pdp-variants")).toHaveCount(0);
});

test("admin adds game keys by paste and CSV; duplicates and bad lines skipped; list shows last 4 only", async ({ page }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/products/");
  await page.getByRole("searchbox").fill("elden");
  await page.getByRole("link", { name: "Keys for Elden Ring: 0 available" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Game keys" })).toBeVisible();
  await page.getByLabel(/Keys \(one per line/).fill("AAAAA-BBBBB-CC11\naaaaa-bbbbb-cc11\nbad key!\nZZZZZ-YYYYY-XX22");
  await expect(page.getByText("2 keys ready · 1 repeated · 1 not valid")).toBeVisible();
  await page.getByLabel("Batch name (optional)").fill("Supplier A");
  await page.getByRole("button", { name: "Add 2 keys" }).click();
  await expect(page.getByText(/Added 2 keys\. 1 already added \(skipped\)\. 1 not valid \(skipped\): bad key!/)).toBeVisible();
  await expect(page.locator(".keyinv-table")).toContainText("•••••-XX22");
  await expect(page.locator(".keyinv-table")).not.toContainText("ZZZZZ");
  // CSV: header + first column; a key already stored counts as a duplicate.
  await page.locator('.keyinv-add input[type="file"]').setInputFiles({ name: "keys.csv", mimeType: "text/csv", buffer: Buffer.from("key,cost\nQQQQQ-WWWWW-EE33,10\nZZZZZ-YYYYY-XX22,10\n") });
  await expect(page.getByText("2 keys ready")).toBeVisible();
  await page.getByRole("button", { name: "Add 2 keys" }).click();
  await expect(page.getByText("Added 1 key. 1 already added (skipped).")).toBeVisible();
  await expect(page.locator(".keyinv-counts")).toContainText("Available3");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove key •••••-EE33" }).click();
  await expect(page.getByText("Removed key •••••-EE33.")).toBeVisible();
  await expect(page.locator(".keyinv-counts")).toContainText("Available2");
  await noHorizontalScroll(page);
  await page.goto("admin/products/");
  await expect(page.getByRole("link", { name: "Keys for Elden Ring: 2 available" })).toBeVisible();
});
