import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, signInDemoAdmin } from "./helpers";

// Task D (2026-09-29): admin menu & categories (/admin/categories) → header bar, products drawer and footer read it.
// Menu items All offers · On sale · Random Steam Keys · Trending now (NEW) · Platforms · Genres; NEW badge on flagged products.
// Every test runs on desktop and mobile. The header link bar exists only on desktop (hidden under 641px), so its checks run on desktop
// and the same links are checked in the drawer on both devices.
async function openDrawer(page: Page, isMobile: boolean) {
  await page.getByRole("button", { name: isMobile ? "Open products menu" : "☰ Products" }).click();
  return page.getByRole("dialog", { name: "Product categories" });
}
const row = (page: Page, name: string) => page.locator(".cat-list li").filter({ has: page.locator(":scope > .flt-row .flt-name strong", { hasText: new RegExp(`^${name}$`) }) });

test("default menu: Eneba items, NEW badge, Platforms + Genres submenus, footer", async ({ page, isMobile }) => {
  await page.goto("");
  if (!isMobile) {
    const bar = page.locator("header nav");
    await expect(bar.locator(".nav-item > a")).toHaveText(["All offers", "On sale", "Random Steam Keys", "Trending nowNew", "Platforms", "Genres", "PC Parts", "Deals"]);
    await expect(bar.getByRole("link", { name: /Trending now/ }).locator(".menu-new")).toBeVisible();
    await bar.getByRole("link", { name: "Platforms" }).hover(); // dropdown on hover
    await expect(bar.locator(".nav-sub").getByRole("link", { name: "Xbox" })).toBeVisible();
    await bar.locator(".nav-sub").getByRole("link", { name: "Xbox" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Xbox games" })).toBeVisible();
    await bar.getByRole("link", { name: "Genres" }).hover();
    await expect(bar.locator(".nav-sub-wide li")).toHaveCount(25);
  }
  let drawer = await openDrawer(page, isMobile);
  await expect(drawer.getByRole("link", { name: /Trending now/ }).locator(".menu-new")).toHaveText("New");
  await noHorizontalScroll(page);
  await drawer.getByRole("link", { name: "Random Steam Keys" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Random Steam keys" })).toBeVisible();
  await expect(page.locator(".lst-count strong")).toHaveText("3");
  await expect(page.getByRole("link", { name: "1 Random Steam Key – Hidden Gem", exact: true })).toBeVisible();
  drawer = await openDrawer(page, isMobile);
  await drawer.getByRole("link", { name: /Trending now/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Trending now" })).toBeVisible();
  await expect(page.locator(".lst-count strong")).toHaveText("4");
  await expect(page.locator(".lst-chip", { hasText: "Trending now" })).toBeVisible();
  drawer = await openDrawer(page, isMobile);
  await drawer.getByRole("link", { name: "On sale" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Games on sale" })).toBeVisible();
  drawer = await openDrawer(page, isMobile);
  await drawer.getByRole("link", { name: "All offers" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "All games" })).toBeVisible();
  drawer = await openDrawer(page, isMobile);
  await drawer.getByRole("button", { name: "Platforms" }).click();
  await expect(drawer.locator("ul li a")).toHaveText(["Steam", "Xbox", "PlayStation", "Nintendo", "PC (Windows)"]);
  await drawer.getByRole("link", { name: "Steam" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Steam games" })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "On sale" })).toHaveAttribute("href", /games\/?\?sale=On\+sale/);
});

test("NEW badge on flagged product cards and the product page; ?new=1 lists them", async ({ page }) => {
  await page.goto("games/?new=1");
  await expect(page.getByRole("heading", { level: 1, name: "New games" })).toBeVisible();
  await expect(page.locator(".lst-grid .product")).toHaveCount(3);
  await expect(page.locator(".lst-grid .product .badge-new")).toHaveCount(3);
  await page.goto("games/");
  const elden = page.locator(".lst-grid .product").filter({ has: page.getByRole("link", { name: "Elden Ring", exact: true }) });
  await expect(elden.locator(".badge-new")).toHaveCount(0);
  await page.goto("product/?id=key-gta-4-complete-steam");
  await expect(page.locator(".pdp-title .badge-new")).toHaveText("New");
  await page.goto("product/?id=key-elden-ring-steam");
  await expect(page.getByRole("heading", { level: 1, name: "Elden Ring" })).toBeVisible();
  await expect(page.locator(".pdp-title .badge-new")).toHaveCount(0);
  await noHorizontalScroll(page);
});

test("admin adds, nests, edits, hides, reorders and deletes menu items; store follows", async ({ page, isMobile }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/categories/");
  await expect(page.getByRole("heading", { level: 1, name: "Menu & categories" })).toBeVisible();
  await noHorizontalScroll(page);
  const add = page.getByRole("region", { name: "Add menu item" });
  // Unsafe link refused (same rule in the demo and the API).
  await add.getByRole("textbox", { name: "Name" }).fill("Bad link");
  await add.getByRole("combobox", { name: "Link target" }).selectOption({ label: "Custom store link…" });
  await add.getByRole("textbox", { name: "Custom link" }).fill("https://example.com");
  await add.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Link must be a store path that starts with /")).toBeVisible();
  // Top-level item with NEW badge in the header bar, then a sub-item under it.
  await add.getByRole("textbox", { name: "Name" }).fill("Summer picks");
  await add.getByRole("combobox", { name: "Link target" }).selectOption({ label: "Genre: Racing" });
  await add.getByRole("checkbox", { name: "Show NEW badge" }).check();
  await add.getByRole("checkbox", { name: "In header bar" }).check();
  await add.getByRole("button", { name: "Add item" }).click();
  await expect(row(page, "Summer picks")).toContainText("Genre: Racing");
  await add.getByRole("textbox", { name: "Name" }).fill("Cheap racers");
  await add.getByRole("combobox", { name: "Link target" }).selectOption({ label: "Custom store link…" });
  await add.getByRole("textbox", { name: "Custom link" }).fill("/games?genre=Racing&sale=On+sale");
  await add.getByRole("combobox", { name: "Place" }).selectOption({ label: "Under “Summer picks”" });
  await add.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("list", { name: "Sub-items of Summer picks" }).locator(".flt-name strong", { hasText: "Cheap racers" })).toBeVisible();
  // Move Summer picks up twice (last → above Deals), rename Deals, hide Clearance.
  await row(page, "Summer picks").first().getByRole("button", { name: "Move Summer picks up" }).click();
  await expect(page.getByText("Moved up")).toBeAttached();
  await row(page, "Summer picks").first().getByRole("button", { name: "Move Summer picks up" }).click();
  await row(page, "Deals").getByRole("button", { name: "Edit Deals" }).click();
  const edit = page.getByRole("group", { name: "Edit Deals" });
  await edit.getByRole("textbox", { name: "Name" }).fill("Hot deals");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(row(page, "Hot deals")).toBeVisible();
  await row(page, "Clearance").getByRole("button", { name: "Hide Clearance" }).click();
  await expect(row(page, "Clearance").locator(".flt-row .chip").last()).toHaveText("Hidden");
  await noHorizontalScroll(page);

  // Store: drawer + (desktop) header bar follow.
  await page.goto("");
  if (!isMobile) {
    const bar = page.locator("header nav");
    await expect(bar.getByRole("link", { name: /Summer picks/ }).locator(".menu-new")).toBeVisible();
    await expect(bar.getByRole("link", { name: "Hot deals" })).toBeVisible();
  }
  let drawer = await openDrawer(page, isMobile);
  const names = await drawer.locator(":scope ul > li > :first-child").allInnerTexts();
  expect(names.findIndex((n) => n.startsWith("Summer picks"))).toBe(names.findIndex((n) => n.startsWith("Hot deals")) - 1);
  await expect(drawer.getByRole("link", { name: "Clearance" })).toHaveCount(0);
  await drawer.getByRole("button", { name: /Summer picks/ }).click();
  await drawer.getByRole("link", { name: "Cheap racers" }).click();
  await expect(page).toHaveURL(/games\/?\?genre=Racing&sale=On\+sale/);
  await expect(page.getByRole("link", { name: "Forza Horizon 5", exact: true })).toHaveCount(0); // not on sale

  // Delete Summer picks: the confirm names its sub-item; both leave the store.
  await page.goto("admin/categories/");
  await row(page, "Summer picks").first().getByRole("button", { name: "Delete Summer picks" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete Summer picks" })).toContainText("Its 1 sub-item is deleted too.");
  await page.getByRole("alertdialog", { name: "Delete Summer picks" }).getByRole("button", { name: "Delete" }).click();
  await expect(row(page, "Summer picks")).toHaveCount(0);
  await page.goto("");
  drawer = await openDrawer(page, isMobile);
  await expect(drawer.getByRole("button", { name: /Summer picks/ })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "Hot deals" })).toBeVisible();
});

test("menu manager needs an admin", async ({ page }) => {
  await page.goto("admin/categories/");
  await expect(page).toHaveURL(/admin\/login\/?\?next=/);
});
