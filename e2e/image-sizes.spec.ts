import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// Product image sizes (Eneba, user 2026-09-29): one 4:5 image per product; listing cards 5:7, product page 4:5, small covers 4:5.
// Every check runs at modern phone, tablet (portrait + landscape) and desktop widths, in both projects (desktop + mobile).
const VIEWPORTS = [
  { name: "phone 360", width: 360, height: 800 }, { name: "iPhone 390", width: 390, height: 844 }, { name: "phone 412", width: 412, height: 915 },
  { name: "iPhone Pro Max 430", width: 430, height: 932 }, { name: "iPad mini 768", width: 768, height: 1024 }, { name: "iPad Air 820", width: 820, height: 1180 },
  { name: "iPad landscape 1180", width: 1180, height: 820 }, { name: "iPad Pro 1024", width: 1024, height: 1366 },
  { name: "laptop 1280", width: 1280, height: 800 }, { name: "desktop 1440", width: 1440, height: 900 }, { name: "desktop 1920", width: 1920, height: 1080 },
];
const LIST = 5 / 7, PDP = 4 / 5;

// Width / height of each visible box, and whether its image fills the box.
async function boxes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => {
    const r = e.getBoundingClientRect(); // clientWidth/Height = inside the 1px border
    const img = e.tagName === "IMG" ? e : e.querySelector("img");
    const i = img?.getBoundingClientRect();
    return { ratio: r.width / r.height, w: r.width, fills: !!i && Math.abs(i.width - e.clientWidth) < 1.5 && Math.abs(i.height - e.clientHeight) < 1.5, fit: img ? getComputedStyle(img).objectFit : "" };
  }));
}
async function expectRatio(page: Page, selector: string, ratio: number, where: string) {
  const list = await boxes(page, selector);
  expect(list.length, `${where}: ${selector} visible`).toBeGreaterThan(0);
  for (const b of list) {
    expect(Math.abs(b.ratio - ratio), `${where}: ${selector} ratio ${b.ratio.toFixed(3)}`).toBeLessThan(0.02);
    expect(b.fills, `${where}: image fills ${selector}`).toBe(true);
    expect(b.fit, `${where}: ${selector} object-fit`).toBe("cover");
  }
}

for (const [page_, path] of [["home", ""], ["games listing", "games/"], ["hardware listing", "hardware/"], ["search listing", "search/"]] as const) {
  test(`listing cards are 5:7 on every device width: ${page_}`, async ({ page }) => {
    await page.goto(path);
    for (const v of VIEWPORTS) {
      await page.setViewportSize(v);
      await expectRatio(page, ".product-image", LIST, `${page_} @ ${v.name}`);
      await noHorizontalScroll(page);
    }
  });
}

test("product page image is 4:5 for games and hardware on every device width", async ({ page }) => {
  for (const id of ["key-elden-ring-steam", "hw-rtx-5070-ti-tuf"]) {
    await page.goto(`product/?id=${id}`);
    for (const v of VIEWPORTS) {
      await page.setViewportSize(v);
      await expectRatio(page, ".pdp-media", PDP, `${id} @ ${v.name}`);
      const w = (await boxes(page, ".pdp-media"))[0].w;
      expect(w, `${id} @ ${v.name}: image not wider than the screen`).toBeLessThanOrEqual(v.width - 32);
      await noHorizontalScroll(page);
    }
  }
});

test("cart popup, cart page and search thumbnails use the 4:5 image", async ({ page, isMobile }) => {
  await page.goto("");
  await page.getByRole("button", { name: "Add to cart: Elden Ring" }).first().click();
  // Mobile has no row list in its "Added" popup (centered popup shows text only); the desktop run covers the popup rows.
  if (!isMobile) await expectRatio(page, ".cart-pop-rows img", PDP, "cart popup");
  await page.goto("cart/");
  for (const v of VIEWPORTS) {
    await page.setViewportSize(v);
    await expectRatio(page, ".cart-row .cover", PDP, `cart @ ${v.name}`);
    await noHorizontalScroll(page);
  }
  await page.goto("");
  await page.getByRole("combobox", { name: "Search products" }).fill("elden");
  await expect(page.locator(".search-row").first()).toBeVisible();
  await expectRatio(page, ".search-thumb", PDP, "search suggestions");
});

test("favorites cards use the same 5:7 listing shape on every device width", async ({ page }) => {
  await page.goto("product/?id=key-elden-ring-steam");
  await page.locator(".pdp-title").getByRole("button", { name: "Save Elden Ring to favorites" }).click();
  await page.goto("favorites/");
  for (const v of VIEWPORTS) {
    await page.setViewportSize(v);
    await expectRatio(page, ".fav-cover", LIST, `favorites @ ${v.name}`);
    await noHorizontalScroll(page);
  }
});
