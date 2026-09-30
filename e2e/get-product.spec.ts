import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Task 8 (wireframe approved 2026-09-30): Get your product for keys not shown yet. Info row + Manual activation card only;
// Display the key needs both ticks, then the key page; Request refund = the return request; revealed keys never show this page. Desktop + mobile.
const firstKeyLine = (page: Page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("corecart-demo-v1")!); const o = s.orders[s.sessionUserId].find((x: { items: { kind: string }[] }) => x.items.some((i) => i.kind === "game_key"));
  return o.items.find((i: { kind: string }) => i.kind === "game_key") as { id: string; name: string };
});

test("email link (?item=) opens Get your product: info row, warning, both ticks needed, then the key page", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  const line = await firstKeyLine(page);
  await page.goto(`account/keys/get/?item=${line.id}`);
  await expect(page.getByRole("heading", { name: "Get your product", level: 1 })).toBeVisible();
  await expect(page.locator(".gp-title")).toHaveText(line.name);
  const facts = page.locator(".key-facts");
  for (const f of ["Region", "Platform", "Product type", "Works on"]) await expect(facts).toContainText(f);
  await expect(facts.getByRole("link", { name: "Check region restrictions" })).toBeVisible();
  const card = page.getByRole("region", { name: "Manual activation" });
  await expect(card).toContainText("Requires manual input");
  await expect(card).toContainText("Please make sure you bought the correct product: returns are not possible once the key is displayed.");
  await expect(card).not.toContainText(/extension|Install and Activate/i); // only the manual card (user 2026-09-30)
  const platform = card.getByRole("checkbox", { name: "STEAM is the correct platform" }); const region = card.getByRole("checkbox", { name: "GLOBAL is the correct region" });
  const display = card.getByRole("button", { name: "Display the key" });
  await expect(display).toBeDisabled();
  await platform.check(); await expect(display).toBeDisabled();
  await platform.uncheck(); await region.check(); await expect(display).toBeDisabled();
  await platform.check(); await expect(display).toBeEnabled();
  await expect(card.getByRole("button", { name: "Request refund" })).toBeVisible();
  if (isMobile) { const b = (await display.boundingBox())!, r = (await card.getByRole("button", { name: "Request refund" }).boundingBox())!; expect(Math.abs(b.y - r.y)).toBeLessThan(2); } // side by side
  await noHorizontalScroll(page);
  await display.click();
  await page.waitForURL(/account\/keys\/view\/?\?id=/);
  await expect(page.locator(".key-code")).toHaveText(/^DEMO-/);
  await expect(page.locator(".key-facts")).toContainText("Works on"); // same info row on both pages
  // Shown keys never show Get your product again: the same email link now opens the key page.
  await page.goto(`account/keys/get/?item=${line.id}`);
  await page.waitForURL(/account\/keys\/view\/?\?id=/);
});

test("order page + keys library: hidden keys say Get key and open this page; Request refund opens the return form", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/keys/");
  await page.getByRole("link", { name: /Get key.*Elden Ring/ }).click();
  await page.waitForURL(/account\/keys\/get\/?\?id=/);
  await page.getByRole("button", { name: "Request refund" }).click();
  const form = page.getByRole("form", { name: /Return Elden Ring/ });
  await expect(form).toBeVisible();
  await form.getByLabel("Reason").selectOption({ index: 1 });
  await form.getByRole("button", { name: /Send|Request/ }).click();
  await page.waitForURL(/account\/orders\/?\?tab=returns&sent=/);
  // Old key-page link for a hidden key goes to Get your product (one place to reveal).
  await page.goto("account/keys/");
  const href = await page.getByRole("link", { name: /Get key.*Cyberpunk/ }).getAttribute("href");
  await page.goto(`account/keys/view/?id=${new URL(href!, page.url()).searchParams.get("id")}`);
  await page.waitForURL(/account\/keys\/get\/?\?id=/);
  await expect(page.getByRole("heading", { name: "Manual activation" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("unknown key: Key not found", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/keys/get/?id=nope");
  await expect(page.getByText("Key not found.")).toBeVisible();
  await page.goto("account/keys/get/?item=nope");
  await expect(page.getByText("Key not found.")).toBeVisible();
});
