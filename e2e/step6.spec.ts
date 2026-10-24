import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";
import { signInAs, signOutDemo } from "./seller-helpers";

// Step 6 (orders + key delivery) finish: the failure paths and the seller side on the demo store (lib/client/demo-api.ts = browser copy of
// lib/server/checkout.ts / returns.ts / admin-orders.ts, same shared rules in lib/checkout.ts, lib/returns.ts, lib/marketplace.ts).
// a not enough stock, b last key / two buyers, c 30-minute hold expiry, d approved returns (unrevealed / revealed), e seller dashboard
// on the real sale, f Rate the seller, g Trusted badge. Desktop + mobile (phones at 390 px), no skips.
const K = "corecart-demo-v1";
const ELDEN = "key-elden-ring-steam";
const CYBER = "key-cyberpunk-2077-steam";
const SELLER = "Key Shop";
const SELLER_EMAIL = "key-shop@sellers.test";
type Offer = { productId: string; priceUsdCents: number; codes: string[] };

// One approved seller "Key Shop" with offers + fake Steam keys (+ optional five-star ratings, days old), written straight into the demo store.
async function seedSeller(page: Page, offers: Offer[], fiveStarAgesDays: number[] = []) {
  await page.evaluate(([k, list, ages]) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); s.users ??= []; s.sellerApps ??= []; s.ratings ??= [];
    const mk = (s.market ??= {}); mk.stores ??= []; mk.offers ??= []; mk.keys ??= []; mk.requests ??= []; mk.requestEvents ??= [];
    const now = new Date().toISOString(); const id = "seller-key-shop";
    s.users.push({ id, name: "Kim Seller", email: "key-shop@sellers.test", emailVerified: true, image: null, role: "seller", createdAt: now, provider: "email", status: "active" });
    s.sellerApps.push({ id: "app-key-shop", seq: 900, userId: id, email: "key-shop@sellers.test", status: "approved", sellerType: "individual", data: {}, merchantName: "Key Shop", merchantKey: "keyshop",
      idType: "national_id", idNumber: "1234567890123", freezeUntil: null, freezeReleasedAt: null, freezeReleasedBy: null, decidedAt: "2026-03-02T03:00:00.000Z", decidedById: null, reason: null, blacklistReason: null, statusBefore: null, createdAt: now });
    mk.stores.push({ userId: id, slug: "key-shop", name: "Key Shop", invoices: false, lowStockAt: 10 });
    list.forEach((o, j) => {
      mk.offers.push({ id: `offer-ks-${j}`, sellerId: id, productId: o.productId, priceUsdCents: o.priceUsdCents, active: true, clicks: 0, createdAt: now, updatedAt: now });
      o.codes.forEach((code, n) => mk.keys.push({ id: `ks-key-${j}-${n}`, offerId: `offer-ks-${j}`, sellerId: id, code, status: "in_stock", createdAt: now }));
    });
    ages.forEach((d, n) => s.ratings.push({ userId: `rater-${n}`, orderId: `old-order-${n}`, seller: "Key Shop", stars: 5, comment: "", updatedAt: new Date(Date.now() - d * 86_400_000).toISOString() }));
    localStorage.setItem(k, JSON.stringify(s));
  }, [K, offers, fiveStarAgesDays] as const);
}
const codes = (tag: string, n: number) => Array.from({ length: n }, (_, i) => `KSHOP-${tag}-${String(11111 * (i + 1)).slice(0, 5)}`);
async function start(page: Page, isMobile: boolean, offers: Offer[], fiveStarAgesDays: number[] = []) {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("");
  await page.evaluate(() => localStorage.setItem("corecart-currency", "USD"));
  await seedSeller(page, offers, fiveStarAgesDays);
}
// ฿10,000 top-up in the signed-in buyer's wallet.
const fund = (page: Page) => page.evaluate((k) => {
  const s = JSON.parse(localStorage.getItem(k)!); const uid = s.sessionUserId;
  (s.ledger[uid] ??= []).push({ id: `seed-topup-${uid}`, createdAt: new Date().toISOString(), bucket: "wallet", type: "top_up", ref: "TU-SEED", amountMinor: 1_000_000 });
  localStorage.setItem(k, JSON.stringify(s));
}, K);
type Key = { id: string; offerId: string; code: string; status: string; orderItemId?: string | null };
type Data = { keys: Key[]; orders: { id: string; number: string; status: string; failureReason: string | null; items: { id: string; name: string }[] }[]; ledger: { type: string; amountMinor: number }[]; lib: { code: string; orderItemId: string; revealedAt: string | null; returnedAt?: string }[]; allLib: { code: string }[] };
// The demo store as the server would read it back: seller keys, the buyer's real (non-sample) orders, wallet ledger, key library.
const data = (page: Page, email?: string) => page.evaluate(([k, e]) => {
  const s = JSON.parse(localStorage.getItem(k)!); const uid = e ? s.users.find((u: { email: string }) => u.email === e).id : s.sessionUserId;
  return { keys: s.market.keys, orders: (s.orders?.[uid] ?? []).filter((o: { isSample?: boolean }) => !o.isSample), ledger: s.ledger?.[uid] ?? [], lib: s.keys?.[uid] ?? [],
    allLib: Object.values(s.keys ?? {}).flat() } as unknown;
}, [K, email ?? ""] as const) as Promise<Data>;
const balance = (d: Data) => d.ledger.reduce((t, r) => t + r.amountMinor, 0);
const offerRow = (page: Page, seller: string) => page.locator(".mk-row", { has: page.locator(".mk-name", { hasText: new RegExp(`^${seller}$`) }) });
async function addOffer(page: Page, productId: string, seller = SELLER) {
  await page.goto(`product/?id=${productId}`);
  await offerRow(page, seller).getByRole("button", { name: `Buy now from ${seller}` }).click();
  await expect(page).toHaveURL(/\/cart\/?$/);
}
// Product page with no live seller offer: the normal buy box, no offers list (offers load after the page).
async function noSellerOffer(page: Page, productId: string, name: string) {
  await page.goto(`product/?id=${productId}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator(".mk-offers")).toHaveCount(0);
  await expect(page.getByText(SELLER, { exact: true })).toHaveCount(0);
}
const payBtn = (page: Page, isMobile: boolean, label: string) => page.locator(isMobile ? ".pay-sticky" : ".pay-aside-btn").getByRole("button", { name: label });
async function openWallet(page: Page) {
  await page.goto("checkout/payment/");
  await page.getByRole("radio", { name: /CoreCart wallet/ }).check();
  await expect(page.locator(".wl-box")).toContainText("Balance after paying");
}
async function payWallet(page: Page, isMobile: boolean) {
  await openWallet(page);
  await payBtn(page, isMobile, "Pay with wallet").click();
  await page.waitForURL(/checkout\/processing\/?\?order=/);
  await expect(page.locator(".proc-ok").getByRole("heading", { name: "Payment confirmed!" })).toBeVisible();
  return (await data(page)).orders[0];
}
async function rate(page: Page, orderId: string, seller: string, stars: number) {
  await page.goto(`account/orders/view/?id=${orderId}`);
  await page.getByRole("button", { name: `★ Rate the seller ${seller}` }).click();
  const dialog = page.getByRole("dialog", { name: `Rate ${seller}` });
  await dialog.locator(`input[name=stars][value="${stars}"]`).check({ force: true }); // the radio is visually hidden behind its star
  await dialog.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByText(`Thanks! Your rating for ${seller} is saved.`)).toBeVisible();
}
const adminRow = (page: Page, isMobile: boolean, number: string) => (isMobile ? page.locator(".ord-cards li", { hasText: number }) : page.locator(".ord-admin-table tbody tr", { hasText: number }));
const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Order status" }).getByRole("tab", { name: new RegExp(`^${name}`) });
async function openAdminOrder(page: Page, isMobile: boolean, number: string, tabName = "All") {
  await page.goto("admin/orders/");
  await tab(page, tabName).click();
  const row = adminRow(page, isMobile, number);
  await expect(row).toBeVisible();
  if (isMobile) await row.getByRole("link").click(); else await row.getByRole("link", { name: number }).click();
  await page.waitForURL(/admin\/orders\/view\/?\?id=/);
  return row;
}

test("a. not enough stock: order refused with a clear message, nothing held, nothing charged, no order", async ({ page, isMobile }) => {
  await start(page, isMobile, [{ productId: ELDEN, priceUsdCents: 2000, codes: codes("AAAAA", 2) }]);
  await registerAndVerify(page, { name: "Stock Buyer" });
  await fund(page);
  await addOffer(page, ELDEN);
  await page.locator(".cart-row", { has: page.getByText("Sold by") }).getByRole("button", { name: "Increase quantity of Elden Ring" }).click();
  await expect(page.locator(".cart-row", { has: page.getByText("Sold by") }).locator("output")).toHaveText("2");
  await openWallet(page);
  const before = await data(page);
  // Someone else buys one of the 2 keys while this buyer is on the payment page.
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)!); Object.assign(s.market.keys.find((x: { id: string }) => x.id === "ks-key-0-0"), { status: "sold", soldAt: new Date().toISOString() }); localStorage.setItem(k, JSON.stringify(s)); }, K);
  await payBtn(page, isMobile, "Pay with wallet").click();
  const alert = page.locator(".stock-alert");
  await expect(alert.getByRole("heading", { name: "Not enough stock" })).toBeVisible();
  await expect(alert.locator("li")).toHaveText("Elden Ring · seller Key Shop — you want 2, only 1 left");
  await expect(alert).toContainText("You were not charged. Nothing was taken from your wallet.");
  await expect(alert.getByRole("button", { name: "Change to 1" })).toBeVisible();
  await expect(page).toHaveURL(/checkout\/payment\/?$/);
  // Read back: no order, ledger unchanged (no purchase row), the free key still on sale and not held, nothing in the key library.
  const after = await data(page);
  expect(after.orders).toHaveLength(0);
  expect(after.ledger.filter((r) => r.type === "purchase")).toHaveLength(0);
  expect(balance(after)).toBe(balance(before));
  expect(balance(after)).toBe(1_000_000);
  const free = after.keys.find((x) => x.id === "ks-key-0-1")!;
  expect(free.status).toBe("in_stock"); expect(free.orderItemId ?? null).toBeNull();
  expect(after.keys.filter((x) => x.status === "reserved")).toHaveLength(0);
  expect(after.lib.filter((x) => x.code.startsWith("KSHOP-"))).toHaveLength(0);
  await noHorizontalScroll(page);
});

test("b. last key, two buyers: only the first payer gets it, the second is refused (sold out), no double sale", async ({ page, isMobile }) => {
  // Ann's tab stands for another device: it does not hear this browser's storage events (the demo keeps one session per browser).
  await page.addInitScript(() => window.addEventListener("storage", (e) => e.stopImmediatePropagation(), true));
  await start(page, isMobile, [{ productId: ELDEN, priceUsdCents: 2000, codes: ["KSHOP-LASTK-99999"] }]);
  const emailA = await registerAndVerify(page, { name: "Buyer Ann" });
  await fund(page);
  await addOffer(page, ELDEN);
  await openWallet(page); // Ann waits on the payment page…

  // …while Ben (same browser storage, second tab) buys the last key with his wallet.
  const ben = await page.context().newPage();
  if (isMobile) await ben.setViewportSize({ width: 390, height: 844 });
  await ben.goto(""); await signOutDemo(ben);
  const emailB = await registerAndVerify(ben, { name: "Buyer Ben" });
  await fund(ben);
  await addOffer(ben, ELDEN);
  const benOrder = await payWallet(ben, isMobile);
  expect(benOrder.status).toBe("completed");
  await ben.close();

  // Ann pays now: refused, sold out, not charged.
  await signInAs(page, emailA);
  await payBtn(page, isMobile, "Pay with wallet").click();
  const alert = page.locator(".stock-alert");
  await expect(alert.getByRole("heading", { name: "Not enough stock" })).toBeVisible();
  await expect(alert.locator("li")).toHaveText("Elden Ring · seller Key Shop — you want 1, sold out");
  await expect(alert.getByRole("button", { name: "Update my cart" })).toBeVisible();
  // Read back: the key is sold once, to Ben's order; one library copy in the whole store; Ann has no order and her full balance.
  const a = await data(page, emailA); const b = await data(page, emailB);
  const k = a.keys.find((x) => x.code === "KSHOP-LASTK-99999")!;
  expect(k.status).toBe("sold"); expect(k.orderItemId).toBe(b.orders[0].items[0].id);
  expect(a.allLib.filter((x) => x.code === "KSHOP-LASTK-99999")).toHaveLength(1);
  expect(b.lib.map((x) => x.code)).toContain("KSHOP-LASTK-99999");
  expect(a.orders).toHaveLength(0); expect(balance(a)).toBe(1_000_000);
  expect(b.ledger.filter((r) => r.type === "purchase")).toHaveLength(1);
  // Sold out: Key Shop is gone from the product page (no other seller → the normal product page).
  await noSellerOffer(page, ELDEN, "Elden Ring");
  await noHorizontalScroll(page);
});

test("c. hold expiry: unpaid after 30 min (Playwright clock) → cancelled 'Not paid within 30 minutes.', key back on sale, admin Orders shows Expired", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  await page.clock.install();
  await start(page, isMobile, [{ productId: ELDEN, priceUsdCents: 2000, codes: codes("CCCCC", 3) }]);
  await registerAndVerify(page, { name: "Late Payer" });
  await addOffer(page, ELDEN);
  await page.goto("checkout/payment/");
  await page.getByRole("radio", { name: /PayPal/ }).check();
  await payBtn(page, isMobile, "Pay with PayPal").click();
  await page.waitForURL(/checkout\/processing\/?\?order=/);
  await expect(page.getByRole("button", { name: "Simulate paid" })).toBeVisible();
  let d = await data(page);
  const number = d.orders[0].number;
  expect(d.orders[0].status).toBe("pending");
  expect(d.keys.filter((x) => x.status === "reserved")).toHaveLength(1); // one key held for 30 min
  expect(d.keys.filter((x) => x.status === "in_stock")).toHaveLength(2);

  await page.clock.fastForward("29:00");
  await page.reload();
  expect((await data(page)).orders[0].status).toBe("pending"); // still inside the hold
  await page.clock.fastForward("02:00");
  await page.reload(); // every load releases holds that ran out (like the server's lazy check)
  await expect(page.getByRole("heading", { name: "Your payment was not completed" })).toBeVisible();
  d = await data(page);
  expect(d.orders[0].status).toBe("cancelled");
  expect(d.orders[0].failureReason).toBe("Not paid within 30 minutes.");
  expect(d.keys.filter((x) => x.status === "in_stock")).toHaveLength(3);
  expect(d.keys.filter((x) => x.status === "reserved" || x.orderItemId)).toHaveLength(0);
  expect(d.ledger.filter((r) => r.type === "purchase")).toHaveLength(0);
  expect(d.lib.filter((x) => x.code.startsWith("KSHOP-"))).toHaveLength(0);

  // Admin: Expired tab + order page; seller: "not paid in time · key back in stock".
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await openAdminOrder(page, isMobile, number, "Expired");
  await expect(page.getByTestId("ord-status")).toHaveText("Expired");
  await expect(page.locator("main")).toContainText("Not paid within 30 minutes.");
  await noHorizontalScroll(page);
  await page.goto("admin/orders/");
  await tab(page, "Expired").click();
  await expect(adminRow(page, isMobile, number)).toContainText("Expired");
  await tab(page, "Pending").click();
  await expect(adminRow(page, isMobile, number)).toHaveCount(0);
  await signOutDemo(page);
  await signInAs(page, SELLER_EMAIL);
  await page.goto("seller/orders/");
  await expect(page.locator(".sl-sales tbody tr", { hasText: number })).toContainText("not paid in time · key back in stock");
  await page.goto(`product/?id=${ELDEN}`);
  await expect(offerRow(page, SELLER)).toBeVisible(); // back on sale
});

test("d. approved returns: UNREVEALED key back on sale; REVEALED key marked returned, never resold", async ({ page, isMobile }) => {
  test.setTimeout(150_000);
  await start(page, isMobile, [{ productId: ELDEN, priceUsdCents: 2000, codes: ["KSHOP-ELDEN-00001"] }, { productId: CYBER, priceUsdCents: 1500, codes: ["KSHOP-CYBER-00001"] }]);
  const email = await registerAndVerify(page, { name: "Return Buyer" });
  await fund(page);
  await addOffer(page, ELDEN); await addOffer(page, CYBER);
  const order = await payWallet(page, isMobile);
  expect(order.status).toBe("completed");

  // Return requests for both lines (both unrevealed now, as the return rules need).
  for (const name of ["Elden Ring", "Cyberpunk 2077"]) {
    await page.goto(`account/orders/view/?id=${order.id}`);
    const line = page.locator(".order-items li:not(.return-li)", { hasText: name });
    await line.getByRole("button", { name: `Request return for ${name}` }).click();
    const form = page.getByRole("form", { name: `Return ${name}` });
    await form.getByLabel("Reason").selectOption({ label: "Key not revealed – no longer needed" });
    await form.getByRole("button", { name: "Send return request" }).click();
    await expect(page.getByText(/Return RT-[A-Z0-9]{8} requested/)).toBeVisible();
  }
  // The Cyberpunk key gets shown before the admin decides (the case the take-back must never resell).
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)!); s.keys[s.sessionUserId].find((x: { code: string }) => x.code === "KSHOP-CYBER-00001").revealedAt = new Date().toISOString(); localStorage.setItem(k, JSON.stringify(s)); }, K);

  await signOutDemo(page);
  await signInDemoAdmin(page);
  await page.goto("admin/returns/");
  await page.getByLabel("Search").fill(email);
  const rows = page.locator(".rt-table > tbody > tr:not(.rt-row)");
  await expect(rows).toHaveCount(2);
  for (const name of ["Elden Ring", "Cyberpunk 2077"]) {
    const r = rows.filter({ hasText: name });
    await r.getByRole("button", { name: /Open/ }).click();
    const detail = page.locator(".rt-row");
    await detail.getByLabel("Change status").selectOption({ label: "Approve" });
    await detail.getByRole("button", { name: "Save" }).click();
    await expect(r.locator(".chip")).toHaveText("Approved");
  }
  // Read back: Elden key in stock again (no order link), Cyberpunk key "returned"; both left the buyer's library.
  const d = await data(page, email);
  const elden = d.keys.find((x) => x.code === "KSHOP-ELDEN-00001")!; const cyber = d.keys.find((x) => x.code === "KSHOP-CYBER-00001")!;
  expect(elden.status).toBe("in_stock"); expect(elden.orderItemId ?? null).toBeNull();
  expect(cyber.status).toBe("returned");
  expect(d.lib.filter((x) => x.code.startsWith("KSHOP-")).every((x) => x.returnedAt)).toBe(true);

  // Admin order page timeline + Returned tab.
  await openAdminOrder(page, isMobile, order.number, "Returned");
  const timeline = page.getByRole("region", { name: "Timeline" });
  await expect(timeline).toContainText("Elden Ring key …0001 taken back by a return (back on sale)");
  await expect(timeline).toContainText("Cyberpunk 2077 key …0001 taken back by a return (revealed: never resold)");
  await noHorizontalScroll(page);
  // Seller Orders notes.
  await signOutDemo(page);
  await signInAs(page, SELLER_EMAIL);
  await page.goto("seller/orders/");
  const sales = page.locator(".sl-sales tbody tr");
  await expect(sales.filter({ hasText: "Elden Ring" })).toContainText("unrevealed → back on sale");
  await expect(sales.filter({ hasText: "Cyberpunk 2077" })).toContainText("returned after reveal · never resold");
  // Buyers: Elden Ring from Key Shop on sale again; Cyberpunk 2077 not (its only key is never sold again).
  await signOutDemo(page);
  await page.goto(`product/?id=${ELDEN}`);
  await expect(offerRow(page, SELLER)).toBeVisible();
  await noSellerOffer(page, CYBER, "Cyberpunk 2077");
});

test("e. seller dashboard: sample numbers before the first sale; after a real paid sale tiles, revenue chart and best sellers use it", async ({ page, isMobile }) => {
  await start(page, isMobile, [{ productId: ELDEN, priceUsdCents: 2000, codes: codes("EEEEE", 3) }]);
  const tile = (label: string) => page.locator("dl.sl-tiles > div", { hasText: label }).locator("dd");
  const rev = page.getByRole("region", { name: "Revenue" });
  await signInAs(page, SELLER_EMAIL);
  await page.goto("seller/");
  await expect(rev.getByRole("note")).toContainText("Sample numbers — real ones appear after your first sales");
  await expect(tile("Sales (last 7 days)")).toHaveText("0");
  await signOutDemo(page);

  await registerAndVerify(page, { name: "Real Buyer" });
  await fund(page);
  await addOffer(page, ELDEN);
  await payWallet(page, isMobile);
  await signOutDemo(page);

  await signInAs(page, SELLER_EMAIL);
  await page.goto("seller/");
  await expect(rev.getByRole("heading", { name: "Revenue" })).toBeVisible();
  await expect(rev.locator(".sl-sample")).toHaveCount(0);
  await expect(page.getByText("Sample numbers")).toHaveCount(0);
  await expect(tile("Sales (last 7 days)")).toHaveText("1");
  await expect(tile("Income (last 7 days)")).toHaveText("$20.00");
  await expect(rev.locator(".sl-kpis > div", { hasText: "Net revenue" }).locator("b")).toHaveText("$20.00");
  await expect(rev.locator(".sl-bar").last()).toHaveAttribute("aria-label", /\(so far\) · Net \$20\.00 · 1 orders · 1 keys$/);
  await rev.getByRole("button", { name: "Day", exact: true }).click();
  await expect(rev.locator(".sl-bar").last()).toHaveAttribute("aria-label", /\(so far\) · Net \$20\.00 · 1 orders · 1 keys$/);
  const best = rev.locator("table tbody tr");
  await expect(best).toHaveCount(1);
  await expect(best).toContainText("Elden Ring");
  await noHorizontalScroll(page);
});

test("f. Rate the seller on the order page rates THAT seller: Key Shop rating on the offer row + store page, CoreCart unchanged", async ({ page, isMobile }) => {
  await start(page, isMobile, [{ productId: ELDEN, priceUsdCents: 2000, codes: codes("FFFFF", 3) }]);
  await page.goto(`product/?id=${ELDEN}`);
  await expect(offerRow(page, SELLER).locator(".mk-new")).toHaveText("New seller");
  const coreBefore = await offerRow(page, "CoreCart").locator(".mk-rating, .mk-new").textContent();
  await registerAndVerify(page, { name: "Rating Buyer" });
  await fund(page);
  await addOffer(page, ELDEN); await addOffer(page, ELDEN, "CoreCart");
  const order = await payWallet(page, isMobile);
  await page.goto(`account/orders/view/?id=${order.id}`);
  await expect(page.getByRole("button", { name: /★ Rate the seller/ })).toHaveCount(2); // one per seller
  await rate(page, order.id, SELLER, 5);
  await expect(page.getByRole("button", { name: `You rated 5 of 5 Edit rating ${SELLER}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "★ Rate the seller CoreCart" })).toBeVisible();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).ratings.filter((r: { orderId: string }) => !r.orderId.startsWith("old-")).map((r: { seller: string; stars: number }) => `${r.seller}:${r.stars}`), K);
  expect(saved.filter((x: string) => x.startsWith("Key Shop") || x.startsWith("CoreCart"))).toContain("Key Shop:5");
  expect(saved).not.toContain("CoreCart:5");
  await noHorizontalScroll(page);

  await page.goto(`product/?id=${ELDEN}`);
  await expect(offerRow(page, SELLER).locator(".mk-rating")).toHaveText("★ 5.0 (1 rating)");
  await expect(offerRow(page, "CoreCart").locator(".mk-rating, .mk-new")).toHaveText(coreBefore!);
  await page.goto("store/?s=key-shop");
  await expect(page.locator(".mk-store-head .mk-rating")).toHaveText("★ 5.0 (1 rating)");
});

test("g. Trusted badge after 5 five-star ratings in 30 days (older ones do not count)", async ({ page, isMobile }) => {
  // 4 five-stars in the last 30 days + 3 older (40-60 days): 7 five-stars, but only 4 in the window → not Trusted yet.
  await start(page, isMobile, [{ productId: ELDEN, priceUsdCents: 2000, codes: codes("GGGGG", 3) }], [1, 3, 10, 29, 40, 50, 60]);
  await page.goto(`product/?id=${ELDEN}`);
  await expect(offerRow(page, SELLER).locator(".mk-rating")).toHaveText("★ 5.0 (7 ratings)");
  await expect(offerRow(page, SELLER).locator(".mk-trusted")).toHaveCount(0);
  await page.goto("store/?s=key-shop");
  await expect(page.locator(".mk-store-head .mk-trusted")).toHaveCount(0);

  await registerAndVerify(page, { name: "Fifth Star" });
  await fund(page);
  await addOffer(page, ELDEN);
  const order = await payWallet(page, isMobile);
  await rate(page, order.id, SELLER, 5);

  await page.goto(`product/?id=${ELDEN}`);
  await expect(offerRow(page, SELLER).locator(".mk-rating")).toHaveText("★ 5.0 (8 ratings)");
  await expect(offerRow(page, SELLER).locator(".mk-trusted")).toContainText("Trusted");
  await expect(page.locator(".mk-featured .mk-name")).toHaveText(SELLER); // Trusted sellers go first
  await page.goto("store/?s=key-shop");
  await expect(page.locator(".mk-store-head .mk-trusted")).toContainText("Trusted");
  await noHorizontalScroll(page);
});
