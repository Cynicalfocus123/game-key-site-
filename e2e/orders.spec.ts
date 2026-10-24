import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";
import { outbox, signInAs, signOutDemo } from "./seller-helpers";

// Admin Orders + seller Orders (wireframe orders-admin-seller-wireframe.png, approved 2026-10-24). Demo store = same rules as the server.
// Full mock flow: a seller offer with fake keys → buyer pays (PayPal, Simulate paid) → reveals the key → admin sees every order with the
// full key (logged) → the seller sees only their own line with a masked buyer. Desktop + mobile (phones at 390 px), no skips.
const K = "corecart-demo-v1";
const ELDEN = "key-elden-ring-steam";
const SHOTS = "D:/dev/tmp/step5/shots";
const SELLER_EMAIL = "key-shop@sellers.test";

// One approved seller "Key Shop" with an Elden Ring offer ($20.00) and 3 fake Steam keys, written straight into the demo store.
async function seedSeller(page: Page) {
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); s.users ??= []; s.sellerApps ??= [];
    const mk = (s.market ??= {}); mk.stores ??= []; mk.offers ??= []; mk.keys ??= []; mk.requests ??= []; mk.requestEvents ??= [];
    const now = new Date().toISOString(); const id = "seller-key-shop";
    s.users.push({ id, name: "Kim Seller", email: "key-shop@sellers.test", emailVerified: true, image: null, role: "seller", createdAt: now, provider: "email", status: "active" });
    s.sellerApps.push({ id: "app-key-shop", seq: 900, userId: id, email: "key-shop@sellers.test", status: "approved", sellerType: "individual", data: {}, merchantName: "Key Shop", merchantKey: "keyshop",
      idType: "national_id", idNumber: "1234567890123", freezeUntil: null, freezeReleasedAt: null, freezeReleasedBy: null, decidedAt: "2026-03-02T03:00:00.000Z", decidedById: null, reason: null, blacklistReason: null, statusBefore: null, createdAt: now });
    mk.stores.push({ userId: id, slug: "key-shop", name: "Key Shop", invoices: false, lowStockAt: 10 });
    mk.offers.push({ id: "offer-key-shop", sellerId: id, productId: "key-elden-ring-steam", priceUsdCents: 2000, active: true, clicks: 0, createdAt: now, updatedAt: now });
    ["KSHOP-AAAAA-11111", "KSHOP-BBBBB-22222", "KSHOP-CCCCC-33333"].forEach((code, n) => mk.keys.push({ id: `ks-key-${n}`, offerId: "offer-key-shop", sellerId: id, code, status: "in_stock", createdAt: now }));
    localStorage.setItem(k, JSON.stringify(s));
  }, K);
}
async function start(page: Page, isMobile: boolean) {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  await page.evaluate(() => localStorage.setItem("corecart-currency", "USD"));
  await seedSeller(page);
}
const offerRow = (page: Page, seller: string) => page.locator(".mk-row", { has: page.locator(".mk-name", { hasText: new RegExp(`^${seller}$`) }) });
// Buyer: seller offer (+ optionally CoreCart's own line) → payment → PayPal → processing.
async function buy(page: Page, isMobile: boolean, withCoreCart: boolean) {
  await page.goto(`product/?id=${ELDEN}`);
  await offerRow(page, "Key Shop").getByRole("button", { name: "Buy now from Key Shop" }).click();
  await expect(page).toHaveURL(/\/cart\/?$/);
  if (withCoreCart) { await page.goto(`product/?id=${ELDEN}`); await offerRow(page, "CoreCart").getByRole("button", { name: "Buy now from CoreCart" }).click(); await expect(page.locator(".cart-row")).toHaveCount(2); }
  await page.goto("checkout/payment/");
  await page.getByRole("radio", { name: /PayPal/ }).check();
  await page.locator(isMobile ? ".pay-sticky" : ".pay-aside-btn").getByRole("button", { name: "Pay with PayPal" }).click();
  await page.waitForURL(/checkout\/processing\/?\?order=/);
  return page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)!); return s.orders[s.sessionUserId][0].number as string; }, K);
}
// The order in the admin list: table row (desktop) or card (phones).
const adminRow = (page: Page, isMobile: boolean, number: string) => (isMobile ? page.locator(".ord-cards li", { hasText: number }) : page.locator(".ord-admin-table tbody tr", { hasText: number }));
const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Order status" }).getByRole("tab", { name: new RegExp(`^${name}`) });

test("full mock flow: seller offer → buyer pays + reveals → admin sees every order + full key (logged), note, resend; seller sees only own line, masked buyer", async ({ page, isMobile }) => {
  test.setTimeout(150_000);
  await start(page, isMobile);
  const email = await registerAndVerify(page, { name: "John Smith" });
  const number = await buy(page, isMobile, true);
  // Buyer: Simulate paid → happy cat → Get your key → Display the key.
  await page.getByRole("button", { name: "Simulate paid" }).click();
  const ok = page.locator(".proc-ok");
  await expect(ok.getByRole("heading", { name: "Payment confirmed!" })).toBeVisible();
  await ok.getByRole("link", { name: "Get your key" }).click(); // 2 lines → the order page; open the Key Shop line's key
  await page.getByRole("listitem").filter({ hasText: "Seller: Key Shop" }).getByRole("link", { name: /Get key/ }).click();
  await page.waitForURL(/account\/keys\/get\/?\?id=/);
  for (const box of await page.locator(".gp-check input").all()) await box.check();
  await page.getByRole("button", { name: "Display the key" }).click();
  await expect(page.locator(".key-code")).toHaveText(/^KSHOP-[A-Z]{5}-\d{5}$/);
  const code = (await page.locator(".key-code").textContent())!;

  // Admin: list with today tiles, both lines, sellers, status, keys.
  await signOutDemo(page);
  await signInDemoAdmin(page);
  const latest = page.getByRole("region", { name: "Latest orders" });
  await expect(latest).toContainText(number);
  await page.goto("admin/orders/");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  const row = adminRow(page, isMobile, number);
  await expect(row).toContainText(email);
  await expect(row).toContainText("Key Shop");
  await expect(row).toContainText("CoreCart");
  await expect(row).toContainText("Paid");
  await expect(row).toContainText("2 delivered · 1 revealed");
  await expect(page.locator(".acct-tile", { hasText: "Seller sales today" })).toContainText("$20.00");
  await expect(tab(page, "Paid")).toContainText("1");
  await tab(page, "Pending").click();
  await expect(page.getByText("No orders match.")).toBeVisible();
  await tab(page, "All").click();
  await page.getByLabel("Search").fill("nobody@nowhere.test");
  await expect(page.getByText("No orders match.")).toBeVisible();
  await page.getByLabel("Search").fill(number.toLowerCase().replace("-", " "));
  await expect(row).toBeVisible();
  await page.getByLabel("Sold by").selectOption({ label: "Key Shop" });
  await expect(row).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/admin-orders-${isMobile ? "phone" : "desktop"}.png`, fullPage: true });

  // Detail: lines with seller, keys masked until "Show key"; the view is logged; note + resend.
  if (isMobile) await row.getByRole("link").click(); else await row.getByRole("link", { name: number }).click();
  await page.waitForURL(/admin\/orders\/view\/?\?id=/);
  await expect(page.getByTestId("ord-status")).toHaveText("Paid");
  const items = page.getByRole("region", { name: "Items" });
  await expect(items).toContainText("Sold by Key Shop");
  await expect(items).toContainText("seller price $20.00");
  const buyer = page.getByRole("region", { name: "Buyer" });
  await expect(buyer).toContainText("John Smith"); await expect(buyer).toContainText(email);
  const sellerKey = items.locator(".ord-keylist li", { has: page.locator(".chip", { hasText: /^Revealed$/ }) });
  await expect(sellerKey.locator(".ord-code")).toHaveText(`•••••-•••••-•••••-${code.slice(-4)}`);
  await sellerKey.getByRole("button", { name: "Show key" }).click();
  await expect(sellerKey.locator(".ord-code")).toHaveText(code);
  const timeline = page.getByRole("region", { name: "Timeline" });
  await expect(timeline).toContainText(`admin@corecart.demo showed the full key for Elden Ring …${code.slice(-4)}`);
  await expect(timeline).toContainText("Payment confirmed");
  await expect(timeline).toContainText(`Buyer revealed the Elden Ring key …${code.slice(-4)}`);
  await sellerKey.getByRole("button", { name: "Hide" }).click();
  await expect(sellerKey.locator(".ord-code")).not.toHaveText(code);
  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByLabel(/Note \(admins only/).fill("Buyer says key works.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(timeline).toContainText('Note by admin@corecart.demo: "Buyer says key works."');
  const before = (await outbox(page)).filter((m) => m.to === email && m.template === "orderConfirmed").length;
  await page.getByRole("button", { name: /Resend "Order confirmed" email/ }).click();
  await expect(page.getByText('"Order confirmed" email sent again.')).toBeVisible();
  expect((await outbox(page)).filter((m) => m.to === email && m.template === "orderConfirmed").length).toBe(before + 1);
  await expect(page.getByRole("button", { name: "Cancel order…" })).toHaveCount(0); // paid: nothing to cancel
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/admin-order-${isMobile ? "phone" : "desktop"}.png`, fullPage: true });

  // Seller: only the Key Shop line, masked buyer, no email / full name / order total / CoreCart line.
  await signOutDemo(page);
  await signInAs(page, SELLER_EMAIL);
  await page.goto("seller/orders/");
  await expect(page.getByRole("navigation", { name: "Seller pages" }).getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
  const sales = page.locator(".sl-sales tbody tr");
  await expect(sales).toHaveCount(1);
  await expect(sales).toContainText(number);
  await expect(sales).toContainText("J***n");
  await expect(sales).toContainText("Elden Ring");
  await expect(sales).toContainText("$20.00");
  await expect(sales).toContainText("Revealed");
  await expect(sales).toContainText(`key …${code.slice(-4)}`);
  await expect(sales.getByRole("link", { name: "Report a problem" })).toHaveAttribute("href", new RegExp(`account/tickets/?\\?new=1&subject=order_issue&order=${number}`));
  const text = await page.locator("main").innerText();
  for (const hidden of [email, "John Smith", "CoreCart wallet", "PayPal"]) expect(text).not.toContain(hidden);
  await expect(page.locator(".acct-tile", { hasText: "Sold today" })).toContainText("1 key");
  await expect(page.locator(".space-acct")).toHaveCount(1); // dark seller dashboard look
  await noHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/seller-orders-${isMobile ? "phone" : "desktop"}.png`, fullPage: true });
});

test("pending order: admin cancels → held key back on sale; failed payment → Failed tab; new orders bar after 30 s", async ({ page, isMobile }) => {
  test.setTimeout(150_000);
  await start(page, isMobile);
  await registerAndVerify(page, { name: "Mali Kaew" });
  const pending = await buy(page, isMobile, false);
  const stock = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).market.keys.filter((x: { offerId: string; status: string }) => x.offerId === "offer-key-shop" && x.status === "in_stock").length as number, K);
  expect(await stock()).toBe(2); // one key held
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/orders/");
  const row = adminRow(page, isMobile, pending);
  await expect(row).toContainText("Pending");
  await expect(row).toContainText("1 held");
  await expect(page.locator(".acct-tile", { hasText: "Pending now" })).toContainText("1");
  if (isMobile) await row.getByRole("link").click(); else await row.getByRole("link", { name: pending }).click();
  await page.getByRole("button", { name: "Cancel order…" }).click();
  await page.getByRole("alertdialog", { name: "Cancel order" }).getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("Order cancelled. Held keys are back on sale.")).toBeVisible();
  await expect(page.getByTestId("ord-status")).toHaveText("Cancelled");
  await expect(page.getByRole("region", { name: "Timeline" })).toContainText("admin@corecart.demo cancelled the order");
  expect(await stock()).toBe(3);

  // Buyer pays again but the payment fails → Failed tab.
  await signOutDemo(page);
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)!); s.sessionUserId = s.users.find((u: { name: string }) => u.name === "Mali Kaew").id; localStorage.setItem(k, JSON.stringify(s)); }, K);
  const failed = await buy(page, isMobile, false);
  await page.getByRole("button", { name: "Simulate failed" }).click();
  await expect(page.getByRole("heading", { name: "Your payment was not completed" })).toBeVisible();
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.clock.install(); // the list checks for new orders every 30 s
  await page.goto("admin/orders/");
  await tab(page, "Failed").click();
  await expect(adminRow(page, isMobile, failed)).toContainText("Failed");
  await tab(page, "Cancelled").click();
  await expect(adminRow(page, isMobile, pending)).toContainText("Cancelled");
  await tab(page, "All").click();
  // A new order arrives while the page is open → "1 new order" bar → Show → blue dot on it.
  const fresh = await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!); const uid = s.users.find((u: { name: string }) => u.name === "Mali Kaew").id;
    const o = { ...s.orders[uid][0], id: crypto.randomUUID(), number: "CC-NEWORDR1", createdAt: new Date(Date.now() + 1000).toISOString(), status: "pending", holdUntil: new Date(Date.now() + 1_800_000).toISOString(), idem: "fresh" };
    s.orders[uid].unshift(o); localStorage.setItem(k, JSON.stringify(s)); return o.number as string;
  }, K);
  await page.clock.fastForward(31_000);
  const bar = page.getByRole("status").filter({ hasText: "new order" });
  await expect(bar).toContainText("1 new order since you opened this page");
  await bar.getByRole("button", { name: "Show" }).click();
  await expect(adminRow(page, isMobile, fresh)).toHaveClass(/ord-fresh/);
  await noHorizontalScroll(page);
});

test("admin without the Orders section: no Orders link, No access page, no Latest orders box", async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); s.users ??= [];
    s.users.push({ id: "helper-admin", name: "Helper Admin", email: "helper@corecart.demo", emailVerified: true, image: null, role: "admin", adminPerms: ["users"], createdAt: new Date().toISOString(), provider: "email", status: "active" });
    s.sessionUserId = "helper-admin"; s.adminSeeded = true; localStorage.setItem(k, JSON.stringify(s));
  }, K);
  await page.goto("admin/");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Latest orders" })).toHaveCount(0);
  if (isMobile) await expect(page.getByRole("combobox", { name: "Admin section" }).locator("option", { hasText: "Orders" })).toHaveCount(0);
  else await expect(page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Orders" })).toHaveCount(0);
  await page.goto("admin/orders/");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(page.locator(".ord-admin-table, .ord-cards")).toHaveCount(0);
});
