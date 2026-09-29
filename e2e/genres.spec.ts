import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, signInDemoAdmin } from "./helpers";

// Task C: one flat "Genres" list (24, user order) in the drawer menu + filters; admin create / rename / hide / delete; old names upgraded.
// Every test runs on desktop and mobile.
const GENRES = ["Singleplayer", "Multiplayer", "Action", "First Person", "Third Person", "Simulation", "Sports", "Co-Op", "FPS/TPS", "Adventure", "Strategy", "Racing",
  "Indie", "RPG", "Bird View", "Horror", "Virtual Reality", "Platformer", "Hack Slash", "Fighting", "Puzzle", "MMO", "Point-Click", "Arcade"];
async function openGenres(page: Page, isMobile: boolean) {
  await page.getByRole("button", { name: isMobile ? "Open products menu" : "☰ Products" }).click();
  const drawer = page.getByRole("dialog", { name: "Product categories" });
  await drawer.getByRole("button", { name: "Digital Games" }).click();
  await drawer.getByRole("button", { name: "Genres" }).click();
  await expect(drawer.getByRole("button", { name: "← Genres" })).toBeVisible();
  return drawer;
}

test("drawer Genres submenu lists all 24 genres in order and opens a genre page", async ({ page, isMobile }) => {
  await page.goto("");
  const drawer = await openGenres(page, isMobile);
  await expect(drawer.locator("ul li a")).toHaveText(GENRES);
  await expect(drawer.getByRole("link", { name: "Open world" })).toHaveCount(0);
  await noHorizontalScroll(page);
  await drawer.getByRole("button", { name: "← Genres" }).click(); // back one level
  await expect(drawer.getByRole("button", { name: "← Digital Games" })).toBeVisible();
  await drawer.getByRole("button", { name: "Genres" }).click();
  await drawer.getByRole("link", { name: "Simulation" }).click();
  await expect(page).toHaveURL(/games\/?\?genre=Simulation/);
  await expect(page.getByRole("heading", { level: 1, name: "Simulation games" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forza Horizon 5", exact: true })).toBeVisible();
  await page.goto("games/?genre=FPS%2FTPS");
  await expect(page.locator(".lst-count strong")).toHaveText("3");
});

test("admin genre changes show in the menu; old genre names are upgraded", async ({ page, isMobile }) => {
  await page.goto("");
  // Settings + a product saved with the old names (before 2026-09-29): FPS (renamed by the admin), Open world, an admin genre.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("corecart-demo-v1") || "{}");
    s.filters = { groups: [], options: [
      { id: "g1", group: "genre", value: "FPS", label: "Shooters", hidden: false, position: 0, deleted: false },
      { id: "g2", group: "genre", value: "Open world", label: "Open world", hidden: false, position: 1, deleted: false },
      { id: "g3", group: "genre", value: "Roguelike", label: "Roguelike", hidden: false, position: 2, deleted: false }] };
    localStorage.setItem("corecart-demo-v1", JSON.stringify(s));
  });
  await signInDemoAdmin(page);
  await page.goto("admin/filters/");
  if (isMobile) await page.getByRole("combobox", { name: "Filter group" }).selectOption({ label: "Genres" });
  const names = page.locator(".flt-list .flt-name strong");
  await expect(names).toHaveText([...GENRES, "Roguelike"]);
  // Hide Arcade, rename Point-Click.
  const row = (n: string) => page.locator(".flt-list > li").filter({ has: page.locator(".flt-name strong", { hasText: new RegExp(`^${n}$`) }) });
  await row("Arcade").getByRole("button", { name: "Hide Arcade" }).click();
  await row("Point-Click").getByRole("button", { name: "Rename Point-Click" }).click();
  await page.getByRole("textbox", { name: "New name for Point-Click" }).fill("Point & Click");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row("Point & Click")).toBeVisible();
  await page.goto("");
  const drawer = await openGenres(page, isMobile);
  await expect(drawer.getByRole("link", { name: "Point & Click" })).toHaveAttribute("href", /genre=Point-Click/);
  await expect(drawer.getByRole("link", { name: "Arcade" })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "Roguelike" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Shooters" })).toHaveCount(0);
});
