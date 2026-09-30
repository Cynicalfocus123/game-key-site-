import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, signInDemoAdmin } from "./helpers";

// Purchase popup (wireframe approved 2026-09-30): "Someone just purchased" on store pages, admin on / off + hidden products (audited).
// Every test runs on desktop AND mobile (no skips). The fake clock (page.clock) runs the 3 s start, 6 s show and 8 s gap without waiting.
// Purchases are seeded straight into the demo store (localStorage) so each case has exact data.
type Buy = { productId: string; name: string; minutesAgo: number; country?: string | null; role?: string; status?: string; closed?: boolean };

async function seed(page: Page, buys: Buy[], extra: Record<string, unknown> = {}) {
  await page.goto(""); // any page of the site: localStorage is per origin
  await page.evaluate(({ buys, extra }) => {
    const KEY = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    s.users ??= []; s.orders ??= {};
    buys.forEach((b, n) => {
      const uid = `pp-buyer-${n}`; const at = new Date(Date.now() - b.minutesAgo * 60_000).toISOString();
      s.users.push({ id: uid, name: `Secret Buyer ${n}`, email: `secret.buyer.${n}@example.com`, emailVerified: true, role: b.role ?? "customer", createdAt: at, provider: "email", country: b.country ?? null, status: b.closed ? "closed" : "active" });
      s.orders[uid] = [{ id: `pp-order-${n}`, number: `CC-SECRET${n}`, status: b.status ?? "completed", currency: "USD", totalCents: 1000, createdAt: at, paidAt: at, isSample: true,
        items: [{ id: `pp-line-${n}`, name: b.name, kind: "game_key", quantity: 1, unitPriceCents: 1000, productId: b.productId }] }];
    });
    Object.assign(s, extra); localStorage.setItem(KEY, JSON.stringify(s));
  }, { buys, extra });
}
const popup = (page: Page) => page.getByTestId("purchase-popup");
const ELDEN = { productId: "key-elden-ring-steam", name: "Elden Ring" };
const CYBER = { productId: "key-cyberpunk-2077-steam", name: "Cyberpunk 2077" };
const BG3 = { productId: "key-baldurs-gate-3-steam", name: "Baldur's Gate 3" };
const WUKONG = { productId: "key-black-myth-wukong-steam", name: "Black Myth: Wukong" };

test("store page: popup with image, product link, time + buyer country only; layout per device", async ({ page, isMobile }) => {
  await page.clock.install();
  await seed(page, [{ ...ELDEN, minutesAgo: 0, country: "TH" }]);
  await page.goto("");
  await page.clock.runFor(3_500);
  const box = popup(page);
  await expect(box).toHaveClass(/show/);
  await expect(box).toContainText("Someone just purchased");
  await expect(box.getByRole("link", { name: "Elden Ring" })).toHaveAttribute("href", /product\/?\?id=key-elden-ring-steam/);
  await expect(box.locator(isMobile ? ".pp-inline" : ".pp-when")).toBeVisible();
  await expect(box.locator(isMobile ? ".pp-inline" : ".pp-when")).toContainText("this minute (Thailand)");
  await expect(box.locator("img")).toHaveJSProperty("complete", true);
  // Privacy: never the buyer's name, email or order number.
  await expect(box).not.toContainText(/Secret Buyer|secret\.buyer|CC-SECRET/);
  const r = (await box.boundingBox())!; const vw = page.viewportSize()!.width; const vh = page.viewportSize()!.height;
  if (isMobile) { expect(Math.round(r.x)).toBe(16); expect(Math.round(vw - r.x - r.width)).toBe(16); expect(r.height).toBeLessThan(70); expect(Math.round(vh - r.y - r.height)).toBe(12); }
  else { expect(Math.round(r.x)).toBe(20); expect(Math.round(r.width)).toBe(360); expect(Math.round(vh - r.y - r.height)).toBe(20); }
  await noHorizontalScroll(page);
  await box.getByRole("link", { name: "Elden Ring" }).click();
  await expect(page).toHaveURL(/product\/?\?id=key-elden-ring-steam/);
});

test("timing: one at a time, ~6 s each, 8 s gap, each purchase once; newest first; no country → no brackets", async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ ...CYBER, minutesAgo: 5, country: null }, { ...ELDEN, minutesAgo: 1, country: "UA" }]);
  await page.goto("games/");
  await page.clock.runFor(3_500);
  await expect(popup(page)).toHaveClass(/show/);
  await expect(popup(page).getByRole("link")).toHaveText("Elden Ring"); // newest first
  await expect(popup(page)).toContainText("1 min ago (Ukraine)");
  await page.clock.runFor(6_500);
  await expect(popup(page)).not.toHaveClass(/show/);
  await page.clock.runFor(8_500);
  await expect(popup(page)).toHaveClass(/show/);
  await expect(popup(page).getByRole("link")).toHaveText("Cyberpunk 2077");
  await expect(popup(page)).toContainText("5 min ago");
  await expect(popup(page)).not.toContainText("(");
  await page.clock.runFor(6_500 + 8_500);
  await expect(popup(page)).toHaveCount(0);
  // Seen once: after a reload nothing shows again.
  await page.reload(); await page.clock.runFor(40_000);
  await expect(popup(page)).toHaveCount(0);
});

test("focus pauses the timer; × hides it for the rest of the visit", async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ ...ELDEN, minutesAgo: 0, country: "TH" }, { ...CYBER, minutesAgo: 2, country: "TH" }]);
  await page.goto("");
  await page.clock.runFor(3_500);
  await expect(popup(page)).toHaveClass(/show/);
  await popup(page).getByRole("link").focus();
  await page.clock.runFor(10_000);
  await expect(popup(page)).toHaveClass(/show/); // paused while focused
  await popup(page).getByRole("button", { name: "Close purchase popup" }).click();
  await expect(popup(page)).toHaveCount(0);
  await page.goto("games/"); await page.clock.runFor(40_000);
  await expect(popup(page)).toHaveCount(0); // the second purchase never shows this visit
});

test("never on cart, checkout, account, admin or sign-in pages", async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ ...ELDEN, minutesAgo: 0, country: "TH" }]);
  for (const path of ["cart/", "checkout/", "checkout/payment/", "login/", "register/", "account/", "admin/login/"]) {
    await page.goto(path); await page.clock.runFor(4_000);
    await expect(popup(page), path).toHaveCount(0);
  }
  await page.goto("search/?q=elden"); await page.clock.runFor(4_000);
  await expect(popup(page)).toHaveClass(/show/); // listing pages do show it
});

test("feed rules: only paid orders of active buyer accounts in the last 24 h", async ({ page }) => {
  await page.clock.install();
  await seed(page, [
    { ...BG3, minutesAgo: 1, country: "TH", role: "admin" }, // admin's own order
    { ...WUKONG, minutesAgo: 1, country: "TH", status: "refunded" },
    { ...CYBER, minutesAgo: 25 * 60, country: "TH" }, // older than 24 h
    { ...CYBER, minutesAgo: 1, country: "TH", closed: true }, // closed account
    { ...ELDEN, minutesAgo: 2, country: "US", role: "seller" }, // sellers buy too
  ]);
  await page.goto("");
  await page.clock.runFor(3_500);
  await expect(popup(page).getByRole("link")).toHaveText("Elden Ring");
  await expect(popup(page)).toContainText("(United States)");
  await page.clock.runFor(6_500 + 8_500 + 30_000);
  await expect(popup(page)).toHaveCount(0); // nothing else qualified
});

test("product page: above the phone sticky buy bar; favorites toast never under the popup", async ({ page, isMobile }) => {
  await page.clock.install();
  await seed(page, [{ ...CYBER, minutesAgo: 0, country: "TH" }]);
  await page.goto("product/?id=key-elden-ring-steam");
  await page.clock.runFor(3_500);
  await expect(popup(page)).toHaveClass(/show/);
  const p = (await popup(page).boundingBox())!;
  if (isMobile) {
    const bar = (await page.locator(".pdp-sticky").boundingBox())!;
    expect(Math.round(bar.y - (p.y + p.height))).toBe(12); // 12 px above the Add to cart / Buy now bar
  } else {
    await expect(page.locator(".pdp-sticky")).toBeHidden(); // desktop has no sticky bar: 20 px from the bottom
    expect(Math.round(page.viewportSize()!.height - (p.y + p.height))).toBe(20);
  }
  await page.getByRole("button", { name: "Save Elden Ring to favorites" }).first().click();
  const toast = page.locator(".fav-toast.show"); await expect(toast).toBeVisible();
  await toast.evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished))); // CSS slide-in runs on real time, not the fake clock
  const t = (await toast.boundingBox())!;
  const overlap = !(t.x + t.width <= p.x || p.x + p.width <= t.x || t.y + t.height <= p.y || p.y + p.height <= t.y);
  expect(overlap, JSON.stringify({ toast: t, popup: p })).toBe(false);
  await noHorizontalScroll(page);
});

test("admin: turn off / on, hide a product, discard, history; store follows", async ({ page, isMobile }) => {
  await seed(page, [{ ...ELDEN, minutesAgo: 0, country: "TH" }, { ...CYBER, minutesAgo: 1, country: "TH" }]);
  await signInDemoAdmin(page);
  if (isMobile) await page.getByRole("combobox", { name: "Admin section" }).selectOption({ label: "Purchase popup" });
  else await page.getByRole("link", { name: "Purchase popup" }).click();
  await expect(page.getByRole("heading", { name: "Purchase popup", level: 1 })).toBeVisible();
  await noHorizontalScroll(page);
  const sw = page.getByRole("switch", { name: "Show the popup" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  // Discard
  await sw.click(); await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  // Off → saved + history
  await sw.click(); await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.locator(".pp-history li").first()).toContainText("admin@corecart.demo");
  await expect(page.locator(".pp-history li").first()).toContainText("Popup turned off");
  await page.clock.install(); await page.goto(""); await page.clock.runFor(40_000);
  await expect(popup(page)).toHaveCount(0);
  // On + hide Elden Ring
  await page.goto("admin/purchase-popup/");
  await page.getByRole("switch", { name: "Show the popup" }).click();
  await page.getByLabel("Search products to hide").fill("elden");
  await page.getByRole("button", { name: "Hide Elden Ring", exact: true }).click();
  await expect(page.locator(".pp-table")).toContainText("Elden Ring");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".pp-history li").first()).toContainText("Popup turned on · Hidden: Elden Ring");
  await page.reload();
  await expect(page.locator(".pp-table")).toContainText("Elden Ring"); // really saved
  await noHorizontalScroll(page);
  await page.goto(""); await page.clock.runFor(3_500);
  await expect(popup(page).getByRole("link")).toHaveText("Cyberpunk 2077"); // Elden Ring hidden
  // Show again
  await page.goto("admin/purchase-popup/");
  await page.getByRole("button", { name: "Show Elden Ring again", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".pp-history li").first()).toContainText("Shown again: Elden Ring");
  await expect(page.getByText("No hidden products.")).toBeVisible();
});

test("admin without the Products section: no link, No access page", async ({ page, isMobile }) => {
  await seed(page, [], {});
  await page.evaluate(() => {
    const KEY = "corecart-demo-v1"; const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    s.users.push({ id: "pp-admin", name: "Plain Admin", email: "plain.admin@example.com", emailVerified: true, role: "admin", adminPerms: ["users"], createdAt: new Date().toISOString(), provider: "email" });
    s.sessionUserId = "pp-admin"; localStorage.setItem(KEY, JSON.stringify(s));
  });
  await page.goto("admin/");
  if (isMobile) await expect(page.getByRole("combobox", { name: "Admin section" }).locator("option", { hasText: "Purchase popup" })).toHaveCount(0);
  else await expect(page.getByRole("link", { name: "Purchase popup" })).toHaveCount(0);
  await page.goto("admin/purchase-popup/");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
});
