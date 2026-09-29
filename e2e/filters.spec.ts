import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, signInDemoAdmin } from "./helpers";

// Future task S4: admin filter manager (/admin/filters) → storefront listing reflects it. Every test runs on desktop and mobile.
async function pickGroup(page: Page, label: string, isMobile: boolean) {
  if (isMobile) await page.getByRole("combobox", { name: "Filter group" }).selectOption({ label });
  else await page.getByRole("navigation", { name: "Filter groups" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await expect(page.getByRole("heading", { level: 2, name: label })).toBeVisible();
}
const row = (page: Page, name: string) => page.locator(".flt-list > li").filter({ has: page.locator(".flt-name strong", { hasText: new RegExp(`^${name}$`) }) });
async function openFilters(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  return page.getByRole("dialog", { name: "Filters" });
}

test("admin renames, hides, adds, deletes and reorders values; store follows", async ({ page, isMobile }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/filters/");
  await expect(page.getByRole("heading", { level: 1, name: "Filters" })).toBeVisible();
  await pickGroup(page, "Genres", isMobile);
  await noHorizontalScroll(page);

  // Rename FPS/TPS → Shooter (URL value stays FPS/TPS).
  await row(page, "FPS/TPS").getByRole("button", { name: "Rename FPS/TPS" }).click();
  await page.getByRole("textbox", { name: "New name for FPS/TPS" }).fill("Shooter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row(page, "Shooter")).toContainText("Catalog value: FPS/TPS");
  // Taken name is refused.
  await row(page, "Shooter").getByRole("button", { name: "Rename Shooter" }).click();
  await page.getByRole("textbox", { name: "New name for Shooter" }).fill("horror");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("That name is already in this group.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Hide Horror.
  await row(page, "Horror").getByRole("button", { name: "Hide Horror" }).click();
  await expect(row(page, "Horror").locator(".chip")).toHaveText("Hidden");
  // Add a value with no products: admin only.
  await page.getByRole("textbox", { name: "Add genre" }).fill("Roguelike");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(row(page, "Roguelike")).toContainText("0 products");
  // Delete Racing: amber confirm with the product count.
  await row(page, "Racing").getByRole("button", { name: "Delete Racing" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete Racing" })).toHaveText(/Delete “Racing”\? 1 product uses it — they lose this genre\./);
  await page.getByRole("alertdialog", { name: "Delete Racing" }).getByRole("button", { name: "Delete" }).click();
  await expect(row(page, "Racing")).toHaveCount(0);
  // Move Sports to the top.
  const names = page.locator(".flt-list .flt-name strong");
  const before = await names.allTextContents();
  const i = before.indexOf("Sports");
  for (let k = 0; k < i; k++) await row(page, "Sports").getByRole("button", { name: "Move Sports up" }).click();
  await expect(names.first()).toHaveText("Sports");
  await expect(row(page, "Sports").getByRole("button", { name: "Move Sports up" })).toBeDisabled();

  // Regions: rename Europe → EU only (shows on cards).
  await pickGroup(page, "Regions", isMobile);
  await row(page, "Europe").getByRole("button", { name: "Rename Europe" }).click();
  await page.getByRole("textbox", { name: "New name for Europe" }).fill("EU only");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row(page, "EU only")).toBeVisible();

  // Store.
  await page.goto("games/?genre=FPS%2FTPS");
  await expect(page.getByRole("heading", { level: 1, name: "Shooter games" })).toBeVisible();
  await expect(page.locator(".lst-count strong")).toHaveText("3");
  await expect(page.getByText("Genre: Shooter")).toBeVisible();
  await page.goto("games/");
  const panel = await openFilters(page, isMobile);
  const group = panel.locator(".lst-group", { has: page.getByRole("button", { name: /^Genre/ }) });
  const genres = group.locator(".lst-options label span");
  await expect(genres.first()).toHaveText("Sports"); // admin order (config loaded)
  await group.getByRole("button", { name: /more/ }).click();
  const all = await genres.allTextContents();
  expect(all).not.toContain("Horror"); expect(all).not.toContain("Racing"); expect(all).not.toContain("Roguelike"); expect(all).toContain("Shooter");
  if (isMobile) await page.getByRole("button", { name: "Close filters" }).click();
  await page.goto("games/?region=Europe"); // renamed region label on the card (29 games since task D: GTA Collection is past the first 24)
  await expect(page.locator(".product", { hasText: "Grand Theft Auto Collection" }).locator(".region-tag")).toHaveText("EU ONLY");
  await noHorizontalScroll(page);
});

test("admin hides a whole group and sets one to start closed; store follows", async ({ page, isMobile }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/filters/");
  await pickGroup(page, "Platforms", isMobile);
  await page.getByRole("checkbox", { name: "Show group on the store" }).uncheck();
  await expect(page.getByRole("checkbox", { name: "Show group on the store" })).not.toBeChecked();
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Filter groups" }).getByRole("button", { name: /^Platforms/ })).toContainText("Hidden");
  await pickGroup(page, "Operating systems", isMobile);
  await page.getByRole("checkbox", { name: "Starts open" }).uncheck();
  // Countries + Sale: no Add, no Delete.
  await pickGroup(page, "Countries", isMobile);
  await expect(page.getByRole("textbox", { name: /^Add/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  await row(page, "Japan").getByRole("button", { name: "Hide Japan" }).click();
  await pickGroup(page, "Price range", isMobile);
  await expect(page.getByText("There are no values to manage.")).toBeVisible();

  await page.evaluate(() => localStorage.removeItem("corecart-filter-open")); // shopper has not opened / closed groups yet
  await page.goto("games/?platform=Steam");
  // Hidden group: its URL filter is ignored and it is not in the sidebar.
  await expect(page.locator(".lst-count strong")).toHaveText("29"); // 25 games + 4 random keys (task D)
  const panel = await openFilters(page, isMobile);
  await expect(panel.getByRole("button", { name: /^Platform/ })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^Operating system/ })).toHaveAttribute("aria-expanded", "false");
  await expect(panel.getByRole("button", { name: /^Genre/ })).toHaveAttribute("aria-expanded", "true");
  await expect(panel.getByRole("combobox", { name: "Country" }).locator("option", { hasText: "Japan" })).toHaveCount(0);
  await expect(panel.getByRole("combobox", { name: "Country" }).locator("option", { hasText: "Thailand" })).toHaveCount(1);
});

test("filter manager needs an admin", async ({ page }) => {
  await page.goto("admin/filters/");
  await expect(page).toHaveURL(/admin\/login\/?\?next=/);
});
