import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// Future task S1 (header search) + S2/S3 (listing page with filters). Every test runs on desktop and mobile.
const box = (page: Page) => page.getByRole("combobox", { name: "Search products" });
const list = (page: Page) => page.getByRole("listbox", { name: "Search suggestions" });
// Waits for the 150 ms debounce: product rows (or the no-results line) are in.
async function search(page: Page, text: string) {
  await box(page).fill(text);
  await expect(list(page).locator(".search-row, .search-empty").first()).toBeVisible();
}
const names = (page: Page) => list(page).locator(".search-name");

test("dropdown rows: thumbnail, tag, title, From + old price + discount, sold out last", async ({ page }) => {
  await page.goto("");
  await search(page, "grand theft auto 4");
  await expect(names(page)).toHaveText(["Grand Theft Auto IV", "Grand Theft Auto IV: The Complete Edition", "Grand Theft Auto IV"]);
  const deal = list(page).locator(".search-row", { hasText: "Complete Edition" });
  await expect(deal.locator("img")).toBeVisible();
  await expect(deal.locator(".search-tag")).toHaveText("Digital key · Steam · GLOBAL");
  await expect(deal.locator(".search-price small")).toHaveText("From");
  await expect(deal.locator(".search-was del")).toBeVisible();
  await expect(deal.locator(".search-was b")).toHaveText("-32%");
  const sold = list(page).locator(".search-row").last();
  await expect(sold).toHaveClass(/is-sold/);
  await expect(sold.locator(".search-sold")).toHaveText("Sold out");
  await expect(page.getByRole("link", { name: "Show all 3 results" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("matching: numbers ↔ Roman numerals, joined words, initials, typos, word order", async ({ page }) => {
  await page.goto("");
  const cases: [string, string][] = [["gta 4", "Grand Theft Auto IV: The Complete Edition"], ["lastof", "The Last of Us Part I"], ["the last of us part 2", "The Last of Us Part II Remastered"], ["cyberpnuk", "Cyberpunk 2077"], ["elden rign", "Elden Ring"], ["myth black", "Black Myth: Wukong"], ["rtx 5070", "ASUS TUF Gaming RTX 5070 Ti 16GB"]];
  for (const [q, first] of cases) {
    await search(page, q);
    await expect(names(page).first(), q).toHaveText(first);
  }
  await box(page).fill("zzzz qqqq");
  await expect(list(page).getByText("No results for “zzzz qqqq”")).toBeVisible();
  await box(page).fill("e");
  await expect(list(page)).toBeHidden(); // needs 2 characters
});

test("dropdown scrolls inside, Show all opens the results page with the text chip", async ({ page }) => {
  await page.goto("");
  await search(page, "steam");
  const ul = list(page);
  const { scroll, client } = await ul.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(scroll).toBeGreaterThan(client); // more rows than fit → own scrollbar
  const all = page.getByRole("link", { name: /^Show all \d+ results$/ });
  const count = Number((await all.textContent())!.match(/\d+/)![0]);
  await all.click();
  await expect(page).toHaveURL(/\/search\/?\?q=steam/);
  await expect(page.getByRole("heading", { level: 1, name: "Search results" })).toBeVisible();
  await expect(page.getByText("Text: steam")).toBeVisible();
  await expect(page.locator(".lst-count strong")).toHaveText(String(count));
  await expect(box(page)).toHaveValue("steam");
  await noHorizontalScroll(page);
});

test("keyboard: arrows move, Enter opens the product, Escape closes", async ({ page }) => {
  await page.goto("");
  await search(page, "doom");
  await box(page).press("Escape");
  await expect(list(page)).toBeHidden();
  await search(page, "doom eternal");
  await box(page).press("ArrowDown");
  await expect(list(page).getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await box(page).press("ArrowDown");
  await box(page).press("Enter");
  await expect(page).toHaveURL(/product\/?\?id=key-doom-eternal-steam/);
  await expect(page.getByRole("heading", { level: 1, name: "DOOM Eternal" })).toBeVisible();
});

test("Enter on the text opens the results page; ✕ clears the field", async ({ page }) => {
  await page.goto("");
  await search(page, "resident");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(box(page)).toHaveValue("");
  await expect(list(page)).toBeHidden();
  await box(page).fill("resident evil");
  await box(page).press("Enter");
  await expect(page).toHaveURL(/\/search\/?\?q=resident(\+|%20)evil/);
  await expect(page.locator(".lst-count strong")).toHaveText("1");
});

// Filters live in the sidebar on desktop and in a full-screen sheet on mobile. Same checks on both.
async function openFilters(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  return page.getByRole("dialog", { name: "Filters" });
}
async function closeFilters(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: /^Show \d+ results?$/ }).click();
}

test("genre page: title, counts, On sale filter, chips, back button, Clear all", async ({ page, isMobile }) => {
  await page.goto("games/?genre=FPS"); // old genre name (before 2026-09-29) still opens FPS/TPS
  await expect(page.getByRole("heading", { level: 1, name: "FPS/TPS games" })).toBeVisible();
  await expect(page.locator(".lst-count strong")).toHaveText("3");
  let panel = await openFilters(page, isMobile);
  await expect(panel.getByRole("checkbox", { name: /FPS/ })).toBeChecked();
  const sale = panel.getByRole("checkbox", { name: /On sale/ });
  await expect(panel.locator("label", { hasText: "On sale" }).locator("small")).toHaveText("2");
  await sale.check();
  await closeFilters(page, isMobile);
  await expect(page.locator(".lst-count strong")).toHaveText("2");
  await expect(page).toHaveURL(/sale=On(\+|%20)sale/);
  await expect(page.getByText("Sale: On sale")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".lst-count strong")).toHaveText("3");
  await page.getByRole("button", { name: "Remove Genre: FPS/TPS" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "All games" })).toBeVisible();
  await expect(page.locator(".lst-count strong")).toHaveText("25");
  panel = await openFilters(page, isMobile);
  await panel.getByRole("checkbox", { name: /^Steam/ }).check();
  await closeFilters(page, isMobile);
  await expect(page.getByRole("heading", { level: 1, name: "Steam games" })).toBeVisible();
  await page.getByRole("button", { name: "Clear all" }).first().click();
  await expect(page.locator(".lst-count strong")).toHaveText("25");
  await noHorizontalScroll(page);
});

test("sort menu, price range, country, load more", async ({ page, isMobile }) => {
  await page.goto("games/?genre=FPS");
  await page.getByRole("button", { name: /Most popular/ }).click();
  await page.getByRole("button", { name: "Price: low to high" }).click();
  await expect(page.locator(".lst-grid .product-link").first()).toHaveText("Half-Life 2");
  await expect(page).toHaveURL(/sort=price-asc/);
  let panel = await openFilters(page, isMobile);
  await panel.getByRole("textbox", { name: "Minimum price" }).fill("99999999");
  await panel.getByRole("textbox", { name: "Minimum price" }).press("Enter");
  await closeFilters(page, isMobile);
  await expect(page.getByRole("heading", { name: "No products match" })).toBeVisible();
  await page.getByRole("button", { name: /^Remove Price/ }).click();
  await expect(page.locator(".lst-count strong")).toHaveText("3");
  await page.goto("games/?q=last+of+us");
  await expect(page.locator(".lst-count strong")).toHaveText("5");
  panel = await openFilters(page, isMobile);
  await panel.getByRole("combobox", { name: "Country" }).selectOption("US");
  await closeFilters(page, isMobile);
  await expect(page.locator(".lst-count strong")).toHaveText("3"); // LATAM + Asia keys drop out, US + Global stay
  await expect(page.getByText("Country: United States")).toBeVisible();
  await page.goto("games/");
  await expect(page.locator(".lst-grid .product")).toHaveCount(24);
  await page.getByRole("button", { name: "Load more (1 left)" }).click();
  await expect(page.locator(".lst-grid .product")).toHaveCount(25);
});

test("long groups: search box + N more; hardware hides game-only groups", async ({ page, isMobile }) => {
  await page.goto("games/");
  let panel = await openFilters(page, isMobile);
  const genre = panel.locator(".lst-group", { has: page.getByRole("button", { name: /^Genre/ }) });
  await expect(genre.getByRole("checkbox")).toHaveCount(8);
  await genre.getByRole("button", { name: /\d+ more/ }).click();
  expect(await genre.getByRole("checkbox").count()).toBeGreaterThan(8);
  await genre.getByRole("searchbox", { name: "Search genre" }).fill("rac");
  await expect(genre.getByRole("checkbox")).toHaveCount(1);
  await expect(genre.getByRole("checkbox", { name: /Racing/ })).toBeVisible();
  await closeFilters(page, isMobile);
  await page.goto("hardware/");
  await expect(page.getByRole("heading", { level: 1, name: "PC hardware" })).toBeVisible();
  panel = await openFilters(page, isMobile);
  await expect(panel.getByRole("button", { name: /^Price range/ })).toBeVisible();
  for (const g of ["Platform", "Region", "Operating system", "Genre"]) await expect(panel.getByRole("button", { name: new RegExp(`^${g}`) })).toHaveCount(0);
  await expect(panel.getByRole("checkbox", { name: /On sale/ })).toBeVisible();
});

// Future task S5: region line on every product card (home + listing). Bangkok time zone → visitor country Thailand.
test("cards: region in capitals, GLOBAL green, limited red + Not for Thailand, discount percent", async ({ page }) => {
  await page.goto("");
  const home = page.locator(".product", { has: page.getByRole("link", { name: "Black Myth: Wukong" }) });
  await expect(home.locator(".region-tag")).toHaveText("ROW");
  await expect(home.locator(".card-region-no")).toHaveText("Not for Thailand");
  const elden = page.locator(".product", { has: page.getByRole("link", { name: "Elden Ring" }) });
  await expect(elden.locator(".region-tag")).toHaveClass(/is-global/);
  await expect(elden.locator(".card-region-no")).toHaveCount(0);
  await page.goto("search/?q=lastof");
  const latam = page.locator(".lst-grid .product").first();
  await expect(latam.locator(".region-tag")).toHaveText("LATIN AMERICA");
  await expect(latam.locator(".region-tag")).not.toHaveClass(/is-global/);
  expect(await latam.locator(".region-tag").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(217, 45, 32)");
  await expect(latam.locator(".card-off")).toHaveText("-51%");
  await expect(page.locator(".lst-grid .region-tag", { hasText: "UNITED STATES" }).first()).toBeVisible();
  const hw = await page.goto("hardware/").then(() => page.locator(".lst-grid .product").first());
  await expect(hw.locator(".card-region")).toHaveCount(0);
  await noHorizontalScroll(page);
});
