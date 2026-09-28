import { expect, test, type Locator, type Page } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

// Future task S6: payment logos in equal white tiles (cart summary + strip above the footer). Desktop and mobile.
const BRANDS = ["Visa", "Mastercard", "PayPal", "Apple Pay", "Google Pay", "Alipay", "UnionPay", "JCB", "Discover", "Klarna"];

// Every logo loaded, and drawn fully inside its tile; tiles all the same size.
async function checkTiles(page: Page, box: Locator) {
  const imgs = box.locator(".pay-tiles img");
  await expect(imgs).toHaveCount(BRANDS.length);
  expect(await imgs.evaluateAll((els) => els.map((e) => e.getAttribute("alt")))).toEqual(BRANDS);
  for (const img of await imgs.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    const inside = await img.evaluate((e) => { const a = e.getBoundingClientRect(); const t = e.parentElement!.getBoundingClientRect(); return a.left >= t.left && a.right <= t.right + 0.5 && a.top >= t.top && a.bottom <= t.bottom + 0.5 && a.width > 10; });
    expect(inside).toBe(true);
  }
  const sizes = await box.locator(".pay-tiles li").evaluateAll((els) => [...new Set(els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }))]);
  expect(sizes).toHaveLength(1);
  const [w, h] = sizes[0].split("x").map(Number);
  expect(Math.abs(w / h - 2)).toBeLessThan(0.1); // 2:1 tile
  await expect(box).not.toContainText(/AMEX|PromptPay/);
}

test("strip above the footer: 10 logos, equal tiles, no page scroll sideways", async ({ page }) => {
  await page.goto("");
  const strip = page.getByRole("region", { name: "Payment methods we accept" });
  await checkTiles(page, strip);
  // Directly above the dark footer.
  const gap = await strip.evaluate((e) => e.nextElementSibling?.tagName);
  expect(gap).toBe("FOOTER");
  await noHorizontalScroll(page);
});

test("cart summary: lock title + logo tiles, 4 per row", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("corecart-cart-v1", JSON.stringify([{ productId: "key-elden-ring-steam", qty: 1 }])));
  await page.goto("cart/");
  const block = page.locator(".cart-summary").getByRole("region", { name: "Payment methods" });
  await expect(block.getByText("Safe and secure payment methods")).toBeVisible();
  await checkTiles(page, block);
  const tops = await block.locator(".pay-tiles li").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops.filter((t) => t === tops[0])).toHaveLength(4);
  await noHorizontalScroll(page);
});
