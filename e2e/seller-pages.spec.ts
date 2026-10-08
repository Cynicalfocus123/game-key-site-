import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";
import { applyIndividual, openApplication, signInAs, signOutDemo } from "./seller-helpers";

// Seller marketplace step 2: seller pages /seller, /seller/offers, /seller/offers/new, /seller/requests (wireframe screens 3, 3A, 4,
// 4B, 5A, 6). Demo store = same rules as the seller API. Desktop + mobile (phones at 390 px), no skips.
// Test 1 makes the seller the real way (apply → demo admin Approve). The other tests start from an approved seller written straight
// into the demo store (same record the approve step leaves), because the full KYC flow takes ~1 min and is covered by sellers.spec.ts.
const K = "corecart-demo-v1";
type Seed = { hold?: boolean; offers?: { productId: string; keys?: number; priceUsdCents?: number; active?: boolean }[]; requests?: { name: string; status: string; productId?: string; reason?: string }[]; adminKeys?: { productId: string; code: string }[] };
// n-th valid Steam key (XXXXX-XXXXX-XXXXX), different for every tag.
const steamKey = (tag: string, n: number) => `${tag.toUpperCase().padEnd(5, "Z").slice(0, 5)}-${String(n).padStart(5, "0")}-ABCDE`;

async function seedSeller(page: Page, seed: Seed = {}) {
  const email = await registerAndVerify(page, { name: "Pro Gamer" });
  const merchant = `Pro Gamers ${Date.now().toString(36)}`;
  const sd0 = { ...seed, offers: (seed.offers ?? []).map((o, i) => ({ ...o, codes: Array.from({ length: o.keys ?? 0 }, (_, n) => steamKey(`S${i}`, n)) })) };
  await page.evaluate(([k, m, sd]) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); const u = s.users.find((x: { id: string }) => x.id === s.sessionUserId); const now = new Date().toISOString();
    u.role = "seller"; const apps = (s.sellerApps ??= []);
    apps.push({ id: crypto.randomUUID(), seq: 100 + apps.length, userId: u.id, email: u.email, status: "approved", sellerType: "individual", data: {}, merchantName: m, merchantKey: m.toLowerCase().replace(/[^a-z0-9]/g, ""),
      idType: "national_id", idNumber: "1234567890123", freezeUntil: sd.hold ? new Date(Date.now() + 5 * 86400_000).toISOString() : null, freezeReleasedAt: null, freezeReleasedBy: null,
      decidedAt: "2026-03-02T03:00:00.000Z", decidedById: null, reason: null, blacklistReason: null, statusBefore: null, createdAt: now });
    const mk = (s.market ??= {}); mk.stores ??= []; mk.offers ??= []; mk.keys ??= []; mk.requests ??= []; mk.requestEvents ??= [];
    (sd.offers ?? []).forEach((o, i) => {
      const id = crypto.randomUUID(); const at = new Date(Date.now() - i * 1000).toISOString();
      mk.offers.push({ id, sellerId: u.id, productId: o.productId, priceUsdCents: o.priceUsdCents ?? 1999, active: o.active ?? true, clicks: 0, createdAt: at, updatedAt: at });
      o.codes.forEach((code) => mk.keys.push({ id: crypto.randomUUID(), offerId: id, sellerId: u.id, code, status: "in_stock", createdAt: at }));
    });
    (sd.requests ?? []).forEach((r, i) => mk.requests.push({ id: crypto.randomUUID(), seq: 1001 + mk.requests.length, sellerId: u.id, nameKey: r.name.toLowerCase(), name: r.name, platform: "Steam", region: "Global", edition: "", link: "", note: "",
      status: r.status, productId: r.productId ?? null, reason: r.reason ?? null, createdAt: new Date(Date.now() - (i + 1) * 86400_000).toISOString(), decidedAt: r.status === "waiting" ? null : now, decidedBy: null }));
    (sd.adminKeys ?? []).forEach((a) => (s.productKeys ??= []).push({ id: crypto.randomUUID(), productId: a.productId, code: a.code, status: "available", batch: null, createdAt: now }));
    localStorage.setItem(k, JSON.stringify(s));
  }, [K, merchant, sd0] as const);
  return { email, merchant };
}
const phone = async (page: Page, isMobile: boolean) => { if (isMobile) await page.setViewportSize({ width: 390, height: 844 }); };
// Account menu: sidebar links (desktop / tablet) or the "Account section" select (phones).
async function menuHas(page: Page, isMobile: boolean, label: string) {
  await expect(page.locator(".acct-hello strong")).toBeAttached(); // menu depends on the signed-in user (loads after the page; sidebar hidden on phones)
  if (isMobile) return (await page.getByRole("combobox", { name: "Account section" }).locator("option", { hasText: label }).count()) > 0;
  return (await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: label, exact: true }).count()) > 0;
}
const report = (page: Page) => page.getByTestId("key-report");
const denied = (page: Page) => page.locator(".sl-denied").getByRole("alert"); // Next's route announcer is a role=alert too
const tile = (page: Page, label: string) => page.locator("dl.sl-tiles > div", { hasText: label }).locator("dd");

test("not approved → message + link to Sell on CoreCart; apply + admin Approve → account menu Seller dashboard → Hello, store, Verified, Seller since, tiles", async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  const email = await registerAndVerify(page, { name: "Somchai Srisuk" });
  await phone(page, isMobile);
  await page.goto("seller/");
  await expect(denied(page)).toHaveText("Only approved sellers can sell on CoreCart.");
  await expect(page.locator(".sl-denied").getByRole("link", { name: /Sell on CoreCart/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue" })).toHaveCount(0);
  expect(await menuHas(page, isMobile, "Seller dashboard")).toBe(false);
  await noHorizontalScroll(page);
  await page.goto("seller/offers/new/");
  await expect(denied(page)).toHaveText("Only approved sellers can sell on CoreCart.");

  const merchant = `KeyShop ${Date.now().toString(36)}`;
  const number = await applyIndividual(page, { merchant, idNumber: `1-2345-${Date.now().toString().slice(-5)}-12-3` });
  await page.goto("seller/");
  await expect(denied(page)).toHaveText("Only approved sellers can sell on CoreCart."); // pending is not approved
  await signOutDemo(page);
  await signInDemoAdmin(page);
  await openApplication(page, number);
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("alertdialog", { name: "Confirm approve" }).getByRole("button", { name: "Confirm approve" }).click();
  await expect(page.locator(".sa-head .chip").first()).toHaveText("Approved");
  await signOutDemo(page);
  await signInAs(page, email);

  await page.goto("account/");
  expect(await menuHas(page, isMobile, "Seller dashboard")).toBe(true);
  if (isMobile) await page.getByRole("combobox", { name: "Account section" }).selectOption("/seller");
  else await page.getByRole("navigation", { name: "Account sections" }).getByRole("link", { name: "Seller dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Hello, ${merchant}` })).toBeVisible();
  const card = page.getByRole("region", { name: "Your store" });
  await expect(card.getByLabel("Verified seller")).toBeVisible();
  await expect(card).toContainText(`Seller since ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`);
  await expect(tile(page, "Available for payout")).toHaveText("$0.00");
  await expect(tile(page, "Income (last 7 days)")).toHaveText("$0.00");
  await expect(tile(page, "Sales (last 7 days)")).toHaveText("0");
  await expect(tile(page, "Active offers")).toHaveText("0");
  await page.getByRole("button", { name: "About Available for payout" }).click();
  await expect(page.getByRole("note").filter({ hasText: "Payouts come later" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("dashboard: sales hold notice, Revenue Day / Week / Month (sample note, KPIs with % change, bars + average + tooltip, phones 7 bars + More numbers), best sellers", async ({ page, isMobile }) => {
  await seedSeller(page, { hold: true, offers: [{ productId: "key-elden-ring-steam", keys: 3 }, { productId: "key-doom-eternal-steam", keys: 20 }] });
  await phone(page, isMobile);
  await page.goto("seller/");
  await expect(page.getByRole("status").filter({ hasText: "Sales are on hold until" })).toContainText("buyers see them when the hold ends");
  const rev = page.getByRole("region", { name: "Revenue" });
  await expect(rev.getByRole("note")).toContainText("Sample numbers — real ones appear after your first sales");
  await expect(rev.getByRole("button", { name: "Week", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(rev.getByText("Last 12 weeks")).toBeVisible();
  const bars = rev.locator(".sl-bar");
  await expect(bars).toHaveCount(12);
  await expect(rev.locator(".sl-bar.now")).toHaveCount(1);
  await expect(bars.last()).toHaveAttribute("aria-label", /^Week of \d+ \w{3} \(so far\) · Net \$[\d,]+\.\d\d · \d+ orders · \d+ keys$/);
  await expect(rev.locator(".sl-avg")).toContainText("Avg $");
  // KPIs: Net + Orders always; the other three on desktop, behind "More numbers" on phones.
  const kpi = (label: string) => rev.locator(".sl-kpis > div", { hasText: label });
  await expect(kpi("Net revenue")).toBeVisible(); await expect(kpi("Orders")).toBeVisible();
  await expect(kpi("Net revenue").locator(".sl-delta")).toHaveText(/^(▲|▼) \d+%$/);
  if (isMobile) {
    await expect(kpi("Gross sales")).toBeHidden();
    await rev.getByRole("button", { name: "More numbers ▾" }).click();
    await expect(kpi("Gross sales")).toBeVisible(); await expect(kpi("Avg. order value")).toBeVisible();
    // 7 bars in view, scrolled to the newest; swipe (scroll) for older ones.
    const geo = await rev.locator(".sl-chart").evaluate((el) => ({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth, w: el.clientWidth, bar: (el.querySelector(".sl-col") as HTMLElement).getBoundingClientRect().width }));
    expect(geo.max).toBeGreaterThan(0); expect(geo.left).toBeGreaterThanOrEqual(geo.max - 2);
    expect(Math.round(geo.w / geo.bar)).toBeGreaterThanOrEqual(6); expect(Math.round(geo.w / geo.bar)).toBeLessThanOrEqual(8);
    await bars.last().tap();
  } else {
    await expect(rev.locator(".sl-more")).toBeHidden();
    for (const l of ["Gross sales", "Keys sold", "Avg. order value"]) await expect(kpi(l)).toBeVisible();
    await bars.nth(5).hover();
    await expect(rev.getByRole("tooltip")).toHaveText(/^Week of \d+ \w{3} · Net \$/);
    await bars.last().click();
  }
  await expect(rev.getByRole("tooltip")).toContainText("(so far)");
  await rev.getByRole("button", { name: "Day", exact: true }).click();
  await expect(bars).toHaveCount(30); await expect(rev.getByText("Last 30 days")).toBeVisible();
  await rev.getByRole("button", { name: "Month", exact: true }).click();
  await expect(bars).toHaveCount(12); await expect(bars.last()).toHaveAttribute("aria-label", /^\w{3} 20\d\d \(so far\)/);
  await rev.getByLabel("Bars show").selectOption("orders");
  await expect(rev.locator(".sl-avg")).toContainText(/^Avg [\d,]+$/);
  // Best sellers = the seller's own products.
  const best = rev.locator("table");
  await expect(best.locator("tbody tr")).toHaveCount(2);
  await expect(best).toContainText("Elden Ring (PC) Steam Key GLOBAL");
  // Same numbers after a reload (sample is seeded by the store).
  const net = await kpi("Net revenue").locator("b").textContent();
  await page.reload(); await page.getByRole("region", { name: "Revenue" }).getByRole("button", { name: "Month", exact: true }).click();
  await expect(kpi("Net revenue").locator("b")).toHaveText(net!);
  await noHorizontalScroll(page);
});

test("new offer: header-style product search, price + You receive, keys check (duplicate, wrong format, already in CoreCart), save; existing offer → Add keys (paste + CSV upload)", async ({ page, isMobile }) => {
  await seedSeller(page, { adminKeys: [{ productId: "key-cyberpunk-2077-steam", code: "KKKKK-LLLLL-MMMMM" }] });
  await phone(page, isMobile);
  await page.goto("seller/offers/new/");
  await expect(page.getByRole("heading", { level: 1, name: "New offer" })).toBeVisible();
  await expect(tile(page, "For payout")).toHaveText("$0.00");
  const field = page.getByRole("combobox", { name: /Product name/ });
  await field.fill("eldn rin"); // typo: same matcher as the header search
  const option = page.getByRole("option", { name: "Elden Ring (PC) Steam Key GLOBAL" });
  await expect(option).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Catalog products" }).getByRole("option")).not.toContainText([/Hardware/]);
  await noHorizontalScroll(page);
  await option.click();
  await expect(field).toHaveValue("Elden Ring (PC) Steam Key GLOBAL");
  await expect(page.getByText("✓ Steam · GLOBAL")).toBeVisible();
  await expect(page.getByRole("link", { name: "Request new name" })).toHaveAttribute("href", /\/seller\/requests\/?$/);
  await page.getByLabel("Your price (USD)").fill("12.3456");
  await page.getByLabel("Your price (USD)").blur();
  await expect(page.getByText("Enter a price between $0.10 and $10,000")).toBeVisible();
  await page.getByLabel("Your price (USD)").fill("28.12");
  await expect(page.locator("#price-hint")).toContainText("CoreCart price: $");
  await expect(page.locator("#price-hint")).toContainText("You receive: $28.12 − commission (commission % pending)");
  await page.getByRole("textbox", { name: "Keys, one per line" }).fill(["AAAAA-BBBBB-CCCCC", "DDDDD-EEEEE-FFFFF", "AAAAA-BBBBB-CCCCC", "12345", "GGGGG-HHHHH-JJJJJ", "KKKKK-LLLLL-MMMMM"].join("\n"));
  const r = report(page);
  await expect(r).toContainText("3 OK new keys, Steam format"); // after the API check: the admin key on line 6 is already in CoreCart
  await expect(r).toContainText("1 duplicate line 3 — same key twice in this list (skipped)");
  await expect(r).toContainText("1 wrong format line 4 “12345” — not a Steam key (XXXXX-XXXXX-XXXXX)");
  await expect(r).toContainText("1 already sold / listed line 6 — already in CoreCart (refused)");
  await page.getByRole("button", { name: "Save offer + 3 keys" }).click();
  await expect(page.getByRole("status").filter({ hasText: "✓ Offer saved" })).toHaveText("✓ Offer saved: Elden Ring at $28.12 with 3 keys. 3 lines were not saved (see below).");
  await expect(tile(page, "Active offers")).toHaveText("1");
  await noHorizontalScroll(page);

  // Same product again → already have an offer → Add keys to it.
  await field.fill("elden ring");
  await page.getByRole("option", { name: "Elden Ring (PC) Steam Key GLOBAL" }).click();
  await expect(page.getByText("You already have an offer for this product.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save offer/ })).toBeDisabled();
  await page.getByRole("link", { name: "Add keys to it ›" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add keys" })).toBeVisible();
  await expect(page.locator(".sl-fixed")).toContainText("Elden Ring (PC) Steam Key GLOBAL");
  await expect(page.locator(".sl-fixed")).toContainText("Stock 3");
  await page.getByRole("textbox", { name: "Keys, one per line" }).fill("AAAAA-BBBBB-CCCCC\nNNNNN-PPPPP-QQQQQ");
  await expect(report(page)).toContainText("1 already sold / listed line 1"); // own key from the first upload
  await page.getByRole("button", { name: "Add 1 key" }).click();
  await expect(page.getByRole("status").filter({ hasText: "key added" })).toContainText("✓ 1 key added to Elden Ring. 1 line was not saved");
  await expect(page.locator(".sl-fixed")).toContainText("Stock 4");
  // CSV / TXT upload: first column, header word skipped.
  await page.getByRole("tab", { name: "Upload CSV / TXT" }).click();
  await page.getByLabel("Keys file (CSV or TXT)").setInputFiles({ name: "keys.csv", mimeType: "text/csv", buffer: Buffer.from("key,note\nRRRRR-SSSSS-TTTTT,box 1\nUUUUU-VVVVV-WWWWW,box 2\n") });
  await expect(page.getByText("keys.csv · 3 lines read")).toBeVisible();
  await expect(report(page)).toContainText("2 OK new keys");
  await page.getByLabel("Keys file (CSV or TXT)").setInputFiles({ name: "keys.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
  await expect(page.getByText("Use a .csv or .txt file.")).toBeVisible();
  await page.getByRole("button", { name: "Add 2 keys" }).click();
  await expect(page.locator(".sl-fixed")).toContainText("Stock 6");
  await noHorizontalScroll(page);
});

test("my offers: counts + tabs, Sold out at 0 keys, pause / resume, price edit inline, lowest other price, Add keys link; phones = cards, no sideways scroll", async ({ page, isMobile }) => {
  await seedSeller(page, { offers: [{ productId: "key-cyberpunk-2077-steam", keys: 2, priceUsdCents: 2500 }, { productId: "key-baldurs-gate-3-steam", keys: 0, priceUsdCents: 3000 }] });
  await phone(page, isMobile);
  // A new offer without keys = Sold out.
  await page.goto("seller/offers/new/");
  await page.getByRole("combobox", { name: /Product name/ }).fill("doom eternal");
  await page.getByRole("option", { name: "DOOM Eternal (PC) Steam Key GLOBAL" }).click();
  await page.getByLabel("Your price (USD)").fill("9.99");
  await page.getByRole("button", { name: "Save offer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "✓ Offer saved" })).toContainText("with 0 keys. It shows as Sold out until you add keys.");
  await page.getByRole("link", { name: "Go to My offers ›" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "My offers" })).toBeVisible();
  const kv = page.locator("dl.sl-kv");
  await expect(kv).toContainText("Active offers1"); await expect(kv).toContainText("Keys in stock2"); await expect(kv).toContainText("Sold out2");
  await expect(page.getByRole("tab", { name: "All 3" })).toHaveAttribute("aria-selected", "true");
  const row = (id: string) => page.locator(`tr[data-offer="${id}"]`);
  const cp = row("key-cyberpunk-2077-steam"); const doom = row("key-doom-eternal-steam");
  await expect(doom.locator(".c-status")).toHaveText("Sold out");
  await expect(doom.locator(".c-qty")).toContainText("0");
  await expect(cp.locator(".c-get")).toContainText("$25.00 − fee (commission % pending)");
  await expect(cp.locator(".c-low")).toContainText(/\$[\d,]+\.\d\d (Lowest|You are not lowest)/); // CoreCart's own price in USD
  await expect(doom.getByRole("link", { name: /Add keys/ })).toHaveAttribute("href", /\/seller\/offers\/new\/?\?offer=/);
  await page.getByRole("tab", { name: "Sold out 2" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2); await expect(cp).toHaveCount(0);
  await page.getByRole("tab", { name: "All 3" }).click();
  await noHorizontalScroll(page);
  if (isMobile) { // card layout: no table header, chip next to the name, switch on the card
    await expect(page.locator(".sl-offers thead")).toBeHidden();
    await expect(cp.locator(".c-name .chip")).toHaveText("Active");
  } else await expect(page.locator(".sl-offers thead")).toBeVisible();

  // Pause / resume.
  const sw = cp.getByRole("switch", { name: "Offer on: Cyberpunk 2077" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(cp.locator(".c-status")).toHaveText("Paused");
  await expect(page.getByRole("status").filter({ hasText: "offer paused" })).toContainText("Cyberpunk 2077: offer paused (buyers do not see it).");
  await expect(page.getByRole("tab", { name: "Paused 1" })).toBeVisible();
  await page.reload();
  await expect(row("key-cyberpunk-2077-steam").getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await row("key-cyberpunk-2077-steam").getByRole("switch").click();
  await expect(row("key-cyberpunk-2077-steam").locator(".c-status")).toHaveText("Active");

  // Price edit inline (USD).
  await cp.getByRole("button", { name: "Edit price of Cyberpunk 2077" }).click();
  const input = cp.getByLabel("New price for Cyberpunk 2077 (USD)");
  await input.fill("abc"); await cp.getByRole("button", { name: "Save" }).click();
  await expect(cp.getByRole("alert")).toContainText("Enter a price between $0.10 and $10,000");
  await input.fill("19.99"); await cp.getByRole("button", { name: "Save" }).click();
  await expect(cp.locator(".c-price")).toHaveText("$19.99");
  await expect(page.getByRole("status").filter({ hasText: "price saved" })).toContainText("Cyberpunk 2077: price saved ($19.99).");
  await page.reload();
  await expect(row("key-cyberpunk-2077-steam").locator(".c-price")).toHaveText("$19.99");
  await noHorizontalScroll(page);
});

test("dashboard low stock: Low stock / Out of stock tabs, 5 per page, seller changes the low-stock number, Add keys opens that offer; Add stock buttons", async ({ page, isMobile }) => {
  const sold = ["key-gta-4-complete-steam", "key-tlou-2-remastered-steam", "key-cod-mw3-steam", "key-doom-eternal-steam", "key-baldurs-gate-3-steam", "key-black-myth-wukong-steam"];
  await seedSeller(page, { offers: [{ productId: "key-cyberpunk-2077-steam", keys: 2, priceUsdCents: 498 }, { productId: "key-elden-ring-steam", keys: 12 }, ...sold.map((productId) => ({ productId, keys: 0 }))] });
  await phone(page, isMobile);
  await page.goto("seller/");
  const low = page.getByRole("region", { name: "Offers low on stock" });
  await expect(low.getByRole("tab", { name: "Low stock (1)" })).toHaveAttribute("aria-selected", "true");
  await expect(low.locator("tbody tr")).toHaveCount(1);
  const cp = low.locator("tbody tr").first();
  await expect(cp).toContainText("Cyberpunk 2077"); await expect(cp.locator(".c-qty b")).toHaveText("2");
  await expect(cp.locator(".c-price")).toContainText("$4.98"); await expect(cp.locator(".c-get")).toContainText("$4.98 − fee");
  await low.getByRole("tab", { name: "Out of stock (6)" }).click();
  await expect(low.locator("tbody tr")).toHaveCount(5);
  await expect(low.getByText("Page 1 of 2")).toBeVisible();
  await low.getByRole("button", { name: "Next page" }).click();
  await expect(low.locator("tbody tr")).toHaveCount(1); await expect(low.getByRole("button", { name: "Next page" })).toBeDisabled();
  await noHorizontalScroll(page);
  // Low stock = 12 → Elden Ring (12 keys) joins; saved for the store.
  await low.getByLabel("Low stock =").fill("abc"); await low.getByRole("button", { name: "Save" }).click();
  await expect(low.getByRole("alert")).toHaveText("Low stock: a whole number from 0 to 1000.");
  await low.getByLabel("Low stock =").fill("12"); await low.getByRole("button", { name: "Save" }).click();
  await expect(low.getByRole("status")).toHaveText("✓ Saved: low stock = 12 keys or fewer.");
  await low.getByRole("tab", { name: "Low stock (2)" }).click();
  await expect(low.locator("tbody tr")).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("region", { name: "Offers low on stock" }).getByRole("tab", { name: "Low stock (2)" })).toBeVisible();
  await expect(page.getByLabel("Low stock =")).toHaveValue("12");
  // Add keys → that offer's Add keys page. Add stock → New offer.
  await page.getByRole("region", { name: "Offers low on stock" }).getByRole("link", { name: "Add keys to Cyberpunk 2077" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add keys" })).toBeVisible();
  await expect(page.locator(".sl-fixed")).toContainText("Cyberpunk 2077 (PC) Steam Key GLOBAL");
  await page.goto("seller/");
  const add = page.getByRole("region", { name: "Add stock" });
  await expect(add.getByRole("link", { name: "Add keys to an offer" })).toHaveAttribute("href", /\/seller\/offers\/?$/);
  await add.getByRole("link", { name: "+ New offer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New offer" })).toBeVisible();
});

test("product requests: field errors, catalog match → Sell it (product filled in), send → PR number + My requests (Waiting / Added + Sell it / Rejected + reason), max 10 open", async ({ page, isMobile }) => {
  await seedSeller(page, { requests: [{ name: "Hades II", status: "added", productId: "key-doom-eternal-steam" }, { name: "Fake Game XYZ", status: "rejected", reason: "Not a real product" }] });
  await phone(page, isMobile);
  await page.goto("seller/offers/new/");
  await page.getByRole("link", { name: "Request new name" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Request a new product" })).toBeVisible();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Product name: 2–120 characters.")).toBeVisible();
  await page.getByLabel("Product name *").fill("Elden Ring");
  await page.getByLabel("Link to the product (store page, optional)").fill("http://example.com");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Link: a full https:// address (or leave it empty).")).toBeVisible();
  await page.getByLabel("Link to the product (store page, optional)").fill("");
  await page.getByRole("button", { name: "Send request" }).click(); // Elden Ring · Steam · GLOBAL is in the catalog
  await expect(page.getByText("This product is already in the catalog — sell it.")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: "Sell it ›" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "New offer" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Product name/ })).toHaveValue("Elden Ring (PC) Steam Key GLOBAL");
  await page.goBack();

  await expect(page.getByRole("heading", { level: 1, name: "Request a new product" })).toBeVisible();
  await page.getByLabel("Product name *").fill("Hollow Knight: Silksong");
  await page.getByLabel("Edition").fill("Standard");
  await page.getByLabel("Link to the product (store page, optional)").fill("https://store.steampowered.com/app/1030300");
  await page.getByLabel("Note for the admin (optional)").fill("I have 200 keys from the publisher.");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Request PR-" })).toContainText("✓ Request PR-1003 sent. We'll email you when it is added (or why not).");
  const rows = page.locator(".sl-req tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("PR-1003"); await expect(rows.first()).toContainText("Hollow Knight: Silksong · Steam · GLOBAL · Standard"); await expect(rows.first().locator(".chip")).toHaveText("Waiting");
  const added = page.locator(".sl-req tr", { hasText: "Hades II" });
  await expect(added.locator(".chip")).toHaveText("Added");
  await expect(added.getByRole("link", { name: "Sell it ›" })).toHaveAttribute("href", /product=key-doom-eternal-steam/);
  const rejected = page.locator(".sl-req tr", { hasText: "Fake Game XYZ" });
  await expect(rejected.locator(".chip")).toHaveText("Rejected"); await expect(rejected).toContainText("Not a real product");
  await expect(page.getByText("1 open of 10")).toBeVisible();
  await noHorizontalScroll(page);
  // Max 10 open: 9 more waiting → the 11th is refused.
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "{}"); const r = s.market.requests[0]; for (let i = 0; i < 9; i++) s.market.requests.push({ ...r, id: crypto.randomUUID(), seq: 2000 + i, status: "waiting", productId: null, reason: null }); localStorage.setItem(k, JSON.stringify(s)); }, K);
  await page.reload();
  await expect(page.getByText("10 open of 10")).toBeVisible();
  await page.getByLabel("Product name *").fill("Another Game 2027");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "open requests" })).toHaveText("You already have 10 open requests. Wait until we answer some of them.");
});
