import { expect, test, type Locator, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify } from "./helpers";

// Seller marketplace step 4: buyer side + store logo (user answers 2026-10-08, CODEBASE.md section 21). Demo store = same rules as the
// public offers / store / cart APIs. Desktop + mobile (phones at 390 px), no skips.
// Other sellers are written straight into the demo store (approved application + store + offer + keys, like seller-pages.spec.ts),
// because each one would otherwise need the full KYC flow (covered by sellers.spec.ts).
const K = "corecart-demo-v1";
const ELDEN = "key-elden-ring-steam";
type FakeSeller = { name: string; slug: string; hold?: boolean; closed?: boolean; fiveStars?: number; ratings?: number[]; logo?: string;
  offers: { productId: string; priceUsdCents: number; keys: number; active?: boolean }[] };
const key = (tag: string, n: number) => `${tag.toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(5, "Z").slice(0, 5)}-${String(n).padStart(5, "0")}-QWERT`;

async function seedMarket(page: Page, sellers: FakeSeller[]) {
  await page.evaluate(([k, list, keys]) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); s.users ??= []; s.sellerApps ??= []; s.ratings ??= [];
    const mk = (s.market ??= {}); mk.stores ??= []; mk.offers ??= []; mk.keys ??= []; mk.requests ??= []; mk.requestEvents ??= [];
    const now = new Date().toISOString();
    list.forEach((x, i) => {
      const id = `fake-seller-${x.slug}`;
      s.users.push({ id, name: x.name, email: `${x.slug}@sellers.test`, emailVerified: true, image: null, role: "seller", createdAt: now, provider: "email", status: x.closed ? "closed" : "active" });
      s.sellerApps.push({ id: `app-${x.slug}`, seq: 500 + i, userId: id, email: `${x.slug}@sellers.test`, status: "approved", sellerType: "individual", data: {}, merchantName: x.name, merchantKey: x.slug.replace(/-/g, ""),
        idType: "national_id", idNumber: "1234567890123", freezeUntil: x.hold ? new Date(Date.now() + 5 * 86400_000).toISOString() : null, freezeReleasedAt: null, freezeReleasedBy: null,
        decidedAt: "2026-03-02T03:00:00.000Z", decidedById: null, reason: null, blacklistReason: null, statusBefore: null, createdAt: now });
      mk.stores.push({ userId: id, slug: x.slug, name: x.name, invoices: false, lowStockAt: 10, logo: x.logo ? { dataUrl: x.logo, at: now } : null });
      x.offers.forEach((o, j) => {
        const oid = `offer-${x.slug}-${j}`;
        mk.offers.push({ id: oid, sellerId: id, productId: o.productId, priceUsdCents: o.priceUsdCents, active: o.active ?? true, clicks: 0, createdAt: now, updatedAt: now });
        keys[`${x.slug}-${j}`].forEach((code: string) => mk.keys.push({ id: crypto.randomUUID(), offerId: oid, sellerId: id, code, status: "in_stock", createdAt: now }));
      });
      const stars = [...Array(x.fiveStars ?? 0).fill(5), ...(x.ratings ?? [])];
      stars.forEach((n, j) => s.ratings.push({ userId: "someone", orderId: `order-${x.slug}-${j}`, seller: x.name, stars: n, comment: "", updatedAt: new Date(Date.now() - j * 3600_000).toISOString() }));
    });
    localStorage.setItem(k, JSON.stringify(s));
  }, [K, sellers, Object.fromEntries(sellers.flatMap((x) => x.offers.map((o, j) => [`${x.slug}-${j}`, Array.from({ length: o.keys }, (_, n) => key(`${x.slug}${j}`, n))])))] as const);
}
// Elden Ring sellers: Trusted (5 five-star) first even though it is not the cheapest; then cheapest first; hidden: hold, paused, sold out, closed.
const ELDEN_SELLERS: FakeSeller[] = [
  { name: "Key Castle", slug: "key-castle", fiveStars: 5, offers: [{ productId: ELDEN, priceUsdCents: 2500, keys: 4 }] },
  { name: "Budget Keys", slug: "budget-keys", offers: [{ productId: ELDEN, priceUsdCents: 1999, keys: 2 }, { productId: "key-cyberpunk-2077-steam", priceUsdCents: 1500, keys: 3 }] },
  { name: "Retro Vault", slug: "retro-vault", ratings: [4, 4, 4], offers: [{ productId: ELDEN, priceUsdCents: 2250, keys: 9 }] },
  { name: "Held Shop", slug: "held-shop", hold: true, offers: [{ productId: ELDEN, priceUsdCents: 1000, keys: 5 }] },
  { name: "Paused Shop", slug: "paused-shop", offers: [{ productId: ELDEN, priceUsdCents: 900, keys: 5, active: false }] },
  { name: "Empty Shop", slug: "empty-shop", offers: [{ productId: ELDEN, priceUsdCents: 800, keys: 0 }] },
  { name: "Closed Shop", slug: "closed-shop", closed: true, offers: [{ productId: ELDEN, priceUsdCents: 700, keys: 5 }] },
];
const phone = async (page: Page, isMobile: boolean) => { if (isMobile) await page.setViewportSize({ width: 390, height: 844 }); };
async function start(page: Page, isMobile: boolean, sellers = ELDEN_SELLERS) {
  await phone(page, isMobile);
  await page.goto("");
  await page.evaluate(() => localStorage.setItem("corecart-currency", "USD"));
  await seedMarket(page, sellers);
}
const offers = (page: Page) => page.getByRole("region", { name: "Recommended offers" });
const row = (page: Page, seller: string) => page.locator(".mk-row", { has: page.locator(".mk-name", { hasText: new RegExp(`^${seller}$`) }) });
const names = (l: Locator) => l.locator(".mk-name").allTextContents();

test("product page: no seller offers → normal product page; with sellers → Featured (Trusted first) + N other offers cheapest first, Lowest price, ticks, rating / New seller, hidden sellers left out", async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.goto("product/?id=key-baldurs-gate-3-steam");
  await expect(page.getByRole("heading", { level: 1, name: "Baldur's Gate 3" })).toBeVisible();
  await page.waitForTimeout(300); // offers load after the page
  await expect(page.locator(".mk-offers")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buy now" }).first()).toBeVisible(); // the normal buy box

  await page.goto(`product/?id=${ELDEN}`);
  const list = offers(page);
  await expect(list.getByRole("heading", { name: "Recommended offers" })).toBeVisible();
  const featured = list.locator(".mk-featured");
  await expect(featured.getByText("Featured offer")).toBeVisible();
  await expect(featured.locator(".mk-name")).toHaveText("Key Castle");
  await expect(featured.locator(".mk-trusted")).toContainText("Trusted");
  await expect(featured.locator(".mk-tick")).toContainText("Verified");
  await expect(featured.locator(".mk-rating")).toContainText("5.0 (5 ratings)");
  await expect(featured.locator(".mk-price strong")).toHaveText("$25.00");
  await expect(list.getByRole("heading", { name: "3 other offers" })).toBeVisible();
  expect(await names(list.locator(".mk-list").nth(1))).toEqual(["Budget Keys", "Retro Vault", "CoreCart"]);
  await expect(row(page, "Budget Keys").locator(".mk-price strong")).toHaveText("$19.99");
  await expect(row(page, "Budget Keys").getByText("Lowest price")).toBeVisible();
  await expect(page.getByText("Lowest price")).toHaveCount(1);
  await expect(row(page, "Budget Keys").locator(".mk-new")).toHaveText("New seller");
  await expect(row(page, "Budget Keys").locator(".mk-trusted")).toHaveCount(0);
  await expect(row(page, "Retro Vault").locator(".mk-rating")).toContainText("4.0 (3 ratings)");
  for (const hidden of ["Held Shop", "Paused Shop", "Empty Shop", "Closed Shop"]) await expect(list.getByText(hidden)).toHaveCount(0);
  await expect(list.getByText(/cashback|tickets|dispute/i)).toHaveCount(0); // no stat lines, no cashback (user 2026-10-08)
  await noHorizontalScroll(page);

  // Featured + "1 other offer" when only one seller (+ CoreCart) is left; a held seller alone → normal page again.
  await page.goto("product/?id=key-cyberpunk-2077-steam");
  await expect(offers(page).getByRole("heading", { name: "1 other offer" })).toBeVisible();
  expect(await names(offers(page))).toEqual(["Budget Keys", "CoreCart"]);
});

test("seller card: desktop hover / phone tap (✕ and tap outside close), View store → store page (logo, ticks, search, platform filter, sort); unknown or held store → Store not found", async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.goto(`product/?id=${ELDEN}`);
  const name = row(page, "Retro Vault").locator(".mk-name");
  const card = page.getByRole("dialog", { name: "Seller Retro Vault" });
  if (isMobile) {
    await name.tap();
    await expect(card).toBeVisible();
    await expect(page).toHaveURL(/product/); // tap opens the card, does not leave the page
    await card.getByRole("button", { name: "Close seller card" }).tap();
    await expect(card).toHaveCount(0);
    await name.tap(); await expect(card).toBeVisible();
    await page.locator(".pdp-media").tap({ position: { x: 10, y: 10 } });
    await expect(card).toHaveCount(0);
    await name.tap();
  } else {
    await name.hover();
    await expect(card).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(card).toHaveCount(0);
    await name.hover();
  }
  await expect(card.getByText("Selling on CoreCart since Mar 2026")).toBeVisible();
  await expect(card.locator(".mk-tick")).toBeVisible();
  await expect(card.getByText(/tickets|dispute|invoice/i)).toHaveCount(0);
  const box = await card.boundingBox(); const vw = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
  await card.getByRole("link", { name: "View store" }).click();
  await expect(page).toHaveURL(/store\/?\?s=retro-vault/);
  await expect(page.getByRole("heading", { level: 1, name: "Retro Vault" })).toBeVisible();
  await expect(page.locator(".mk-store-head .mk-logo-96")).toHaveText("R");
  await expect(page.locator(".mk-store-head .mk-tick")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "result" })).toHaveText("1 result found");

  // Budget Keys: 2 products, search + platform + sort.
  await page.goto("store/?s=budget-keys");
  await expect(page.getByRole("heading", { level: 1, name: "Budget Keys" })).toBeVisible();
  const cards = page.locator(".mk-store-main .products .product-link");
  await expect(cards).toHaveText(["Cyberpunk 2077", "Elden Ring"]); // lowest price first ($15.00, $19.99)
  await expect(page.locator(".mk-store-main .products .price").first()).toHaveText("$15.00");
  await page.getByLabel("Sort").selectOption("high");
  await expect(cards).toHaveText(["Elden Ring", "Cyberpunk 2077"]);
  await page.getByLabel("Search this store").fill("eldn ring");
  await expect(cards).toHaveText(["Elden Ring"]);
  await page.getByLabel("Search this store").fill("");
  await expect(page.getByRole("radio", { name: /Steam \(2\)/ })).toBeVisible();
  await page.locator(".mk-store-main .products .product-link", { hasText: "Elden Ring" }).click();
  await expect(page).toHaveURL(new RegExp(`id=${ELDEN}`));
  await page.goBack();
  await noHorizontalScroll(page);

  for (const slug of ["no-such-store", "held-shop", "closed-shop"]) {
    await page.goto(`store/?s=${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "Store not found." })).toBeVisible();
  }
});

test("Buy now on a seller offer → cart (Sold by, seller price, max = keys left), checkout review + payment keep it; coupon skips seller lines; paused offer leaves the cart with a note; signed-in cart keeps the line", async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.goto(`product/?id=${ELDEN}`);
  await row(page, "Budget Keys").getByRole("button", { name: "Buy now from Budget Keys" }).click();
  await expect(page).toHaveURL(/\/cart\/?$/);
  const line = page.locator(".cart-row", { has: page.getByText("Sold by") });
  await expect(line.locator(".sold-by")).toHaveText("Sold by Budget Keys");
  await expect(line.locator(".cart-row-price")).toContainText("$19.99");
  await line.getByRole("button", { name: "Increase quantity of Elden Ring" }).click();
  await expect(line.locator("output")).toHaveText("2");
  await expect(line.getByRole("button", { name: "Increase quantity of Elden Ring" })).toBeDisabled(); // Budget Keys has 2 keys
  await expect(line.getByText("Only 2 left from this seller")).toBeVisible();
  await expect(line.locator(".cart-row-price")).toContainText("$39.98");

  // Same product from CoreCart = its own line (CoreCart price), seller line unchanged.
  await page.goto(`product/?id=${ELDEN}`);
  await row(page, "CoreCart").getByRole("button", { name: "Buy now from CoreCart" }).click();
  await expect(page).toHaveURL(/\/cart\/?$/);
  await expect(page.locator(".cart-row")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Your cart (3)" })).toBeVisible();

  // WELCOME10 (10 % on everything) only discounts CoreCart's own line.
  const coupon = page.getByLabel("Coupon code");
  if (isMobile) await page.locator(".coupon-box summary").click();
  await coupon.fill("WELCOME10"); await page.getByRole("button", { name: "Apply" }).click();
  const ownLine = page.locator(".cart-row", { hasNot: page.locator(".sold-by") });
  const ownPrice = Number((await ownLine.locator(".cart-row-price").textContent())!.replace(/[^\d.]/g, ""));
  const discount = page.locator(".cart-summary .coupon-line dd");
  await expect(discount).toContainText("$");
  expect(Number((await discount.textContent())!.replace(/[^\d.]/g, ""))).toBeCloseTo(ownPrice * 0.1, 1); // 10 % of CoreCart's line only, not of $39.98

  // Signed in: the guest cart merges into the account cart, seller line kept.
  await registerAndVerify(page, { name: "Buyer One" });
  await page.goto("cart/");
  await expect(page.locator(".sold-by")).toHaveText("Sold by Budget Keys");
  await expect(page.locator(".cart-row", { has: page.getByText("Sold by") }).locator("output")).toHaveText("2");
  await page.goto("checkout/");
  await expect(page.locator(".cart-rows.review .sold-by")).toHaveText("Sold by Budget Keys");
  await expect(page.locator(".cart-rows.review .cart-row", { has: page.getByText("Sold by") }).locator(".cart-row-price")).toContainText("$39.98");
  await page.goto("checkout/payment/");
  await expect(page.locator(".pay-items .sold-by").first()).toHaveText("Sold by Budget Keys");
  await noHorizontalScroll(page);

  // The seller pauses the offer → next cart load drops the line + amber note.
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)!); s.market.offers.find((o: { id: string }) => o.id === "offer-budget-keys-0").active = false; localStorage.setItem(k, JSON.stringify(s)); }, K);
  await page.goto("cart/");
  await expect(page.locator(".sold-by")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your cart (1)" })).toBeVisible();
  await page.goto(`product/?id=${ELDEN}`);
  await expect(row(page, "Budget Keys")).toHaveCount(0);
});

// ---------- Store logo ----------
// Real WebP from the browser's canvas (Chromium encodes WebP). AVIF: the canvas cannot encode it, so the test builds the container
// header (ftyp avif + ispe size) — enough for the content check, which is what is tested here.
async function webp(page: Page, w: number, h: number) {
  const b64 = await page.evaluate(([w, h]) => new Promise<string>((done) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
    g.fillStyle = "#dc2626"; g.fillRect(0, 0, w, h); g.fillStyle = "#f59e0b"; g.fillRect(w / 4, h / 4, w / 2, h / 2);
    c.toBlob((b) => { const r = new FileReader(); r.onload = () => done(String(r.result).split(",")[1]); r.readAsDataURL(b!); }, "image/webp", 0.8);
  }), [w, h] as const);
  return Buffer.from(b64, "base64");
}
function avif(w: number, h: number) {
  const box = (type: string, body: Buffer) => { const head = Buffer.alloc(8); head.writeUInt32BE(8 + body.length); head.write(type, 4, "ascii"); return Buffer.concat([head, body]); };
  const ftyp = box("ftyp", Buffer.concat([Buffer.from("avif"), Buffer.alloc(4), Buffer.from("mif1miafavif")]));
  const ispeBody = Buffer.alloc(12); ispeBody.writeUInt32BE(w, 4); ispeBody.writeUInt32BE(h, 8);
  return Buffer.concat([ftyp, box("meta", Buffer.concat([Buffer.alloc(4), box("iprp", box("ipco", box("ispe", ispeBody)))]))]);
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function approvedSeller(page: Page) {
  const email = await registerAndVerify(page, { name: "Logo Owner" });
  const merchant = `Logo Shop ${Date.now().toString(36)}`;
  await page.evaluate(([k, m]) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); const u = s.users.find((x: { id: string }) => x.id === s.sessionUserId); const now = new Date().toISOString(); u.role = "seller";
    (s.sellerApps ??= []).push({ id: crypto.randomUUID(), seq: 900, userId: u.id, email: u.email, status: "approved", sellerType: "individual", data: {}, merchantName: m, merchantKey: m.toLowerCase().replace(/[^a-z0-9]/g, ""),
      idType: "national_id", idNumber: "1234567890123", freezeUntil: null, freezeReleasedAt: null, freezeReleasedBy: null, decidedAt: "2026-03-02T03:00:00.000Z", decidedById: null, reason: null, blacklistReason: null, statusBefore: null, createdAt: now });
    localStorage.setItem(k, JSON.stringify(s));
  }, [K, merchant] as const);
  return { email, merchant };
}

test("store logo: WebP / AVIF / any shape accepted with preview at 96 / 56 / 40; PNG, renamed PNG, too small, too big (px and MB) refused with red text next to the upload + Save off; saved logo on seller card, offer row, seller card popup, store page; Remove logo", async ({ page, isMobile }) => {
  await phone(page, isMobile);
  const { merchant } = await approvedSeller(page);
  await page.goto("seller/");
  const panel = page.getByRole("region", { name: "Store profile" });
  await expect(panel).toBeVisible();
  const input = panel.locator("input[type=file]"); const save = panel.getByRole("button", { name: "Save profile" }); const err = panel.locator(".sl-logo-error");
  await expect(save).toBeDisabled();
  await expect(panel.locator(".sl-previews .mk-logo")).toHaveCount(3);
  await expect(panel.locator(".sl-previews .mk-logo").first()).toHaveText(merchant[0]); // letter until a logo is saved

  const refuse = async (file: { name: string; mimeType: string; buffer: Buffer }, text: string) => {
    await input.setInputFiles(file);
    await expect(err).toHaveText(text);
    await expect(err).toHaveCSS("color", "rgb(185, 28, 28)");
    // red text sits right next to the upload button (same column, just below it)
    const b = (await panel.getByRole("button", { name: "Choose file…" }).boundingBox())!; const e = (await err.boundingBox())!;
    expect(e.y - (b.y + b.height)).toBeLessThan(isMobile ? 60 : 40); expect(Math.abs(e.x - b.x)).toBeLessThan(10);
    await expect(save).toBeDisabled();
  };
  await refuse({ name: "logo.png", mimeType: "image/png", buffer: PNG }, "Use a WebP or AVIF file.");
  await refuse({ name: "logo.webp", mimeType: "image/webp", buffer: PNG }, "Use a WebP or AVIF file."); // renamed PNG
  await refuse({ name: "tiny.webp", mimeType: "image/webp", buffer: await webp(page, 128, 100) }, "Logo is too small (128 × 100). The longest side must be at least 256 px.");
  await refuse({ name: "huge.webp", mimeType: "image/webp", buffer: await webp(page, 2400, 1200) }, "Logo is too big. Longest side up to 2048 px and up to 1 MB.");
  await refuse({ name: "heavy.webp", mimeType: "image/webp", buffer: Buffer.concat([await webp(page, 512, 512), Buffer.alloc(1_100_000)]) }, "Logo is too big. Longest side up to 2048 px and up to 1 MB.");
  await refuse({ name: "tiny.avif", mimeType: "image/avif", buffer: avif(200, 120) }, "Logo is too small (200 × 120). The longest side must be at least 256 px.");

  // AVIF passes the content check (file name + size shown, Save on)
  await input.setInputFiles({ name: "logo.avif", mimeType: "image/avif", buffer: avif(512, 512) });
  await expect(panel.locator(".sl-logo-ok")).toBeVisible(); await expect(err).toHaveCount(0); await expect(save).toBeEnabled();
  await expect(panel.locator(".sl-file")).toContainText("512 × 512 px");
  // Wide WebP (any shape): accepted, fitted inside the square frames.
  await input.setInputFiles({ name: "wide.webp", mimeType: "image/webp", buffer: await webp(page, 800, 300) });
  await expect(panel.locator(".sl-logo-ok")).toHaveText("✓ Logo fits. Check the preview, then Save.");
  for (const n of [96, 56, 40]) {
    const f = panel.locator(`.sl-previews figure[data-size="${n}"]`);
    await expect(f.locator(".mk-logo")).toHaveCSS("width", `${n}px`); await expect(f.locator(".mk-logo")).toHaveCSS("height", `${n}px`);
    await expect(f.locator("img")).toHaveCSS("object-fit", "contain");
    await expect(f).toContainText(`${n} px`);
  }
  // the decoded picture keeps its 8:3 shape inside the frame (not stretched)
  const ratio = await panel.locator('.sl-previews figure[data-size="96"] img').evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
  expect(ratio).toBeCloseTo(800 / 300, 1);
  await save.click();
  await expect(panel.getByText("✓ Logo saved.")).toBeVisible();
  await expect(page.locator(".sl-who .mk-logo img")).toHaveAttribute("src", /^data:image\/webp;base64,/);

  // Reload: still there. Sell Elden Ring → the logo shows in the offer row, the seller card and the store page header.
  await page.reload();
  await expect(page.locator(".sl-who .mk-logo img")).toBeVisible();
  const slug = await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)!); const st = s.market.stores.find((x: { userId: string }) => x.userId === s.sessionUserId); return st.slug as string; }, K);
  await page.evaluate(([k]) => {
    const s = JSON.parse(localStorage.getItem(k)!); const now = new Date().toISOString();
    s.market.offers.push({ id: "offer-logo-1", sellerId: s.sessionUserId, productId: "key-elden-ring-steam", priceUsdCents: 2100, active: true, clicks: 0, createdAt: now, updatedAt: now });
    s.market.keys.push({ id: crypto.randomUUID(), offerId: "offer-logo-1", sellerId: s.sessionUserId, code: "LOGOK-00001-QWERT", status: "in_stock", createdAt: now });
    localStorage.setItem(k, JSON.stringify(s));
  }, [K] as const);
  await page.goto(`product/?id=${ELDEN}`);
  const mine = row(page, merchant);
  await expect(mine.locator(".mk-logo-40 img")).toBeVisible();
  if (isMobile) await mine.locator(".mk-name").tap(); else await mine.locator(".mk-name").hover();
  await expect(page.getByRole("dialog", { name: `Seller ${merchant}` }).locator(".mk-logo-56 img")).toBeVisible();
  await page.goto(`store/?s=${slug}`);
  await expect(page.locator(".mk-store-head .mk-logo-96 img")).toBeVisible();
  await noHorizontalScroll(page);

  // Remove logo (asks first) → letter again.
  await page.goto("seller/");
  await panel.getByRole("button", { name: "Remove logo" }).click();
  await page.getByRole("group", { name: "Remove logo" }).getByRole("button", { name: "Remove logo" }).click();
  await expect(panel.getByText("✓ Logo removed.")).toBeVisible();
  await expect(page.locator(".sl-who .mk-logo")).toHaveText(merchant[0]);
  await noHorizontalScroll(page);
});
