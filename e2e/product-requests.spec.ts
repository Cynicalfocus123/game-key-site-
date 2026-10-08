import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { noHorizontalScroll, registerAndVerify, signInDemoAdmin } from "./helpers";
import { outbox, signInAs, signOutDemo } from "./seller-helpers";

// Seller marketplace step 3: admin Product requests /admin/product-requests (wireframe screen 7, section "products").
// Demo store = same rules as the admin API. Desktop + mobile (phones at 390 px), no skips.
// Sellers are written straight into the demo store (same records the KYC approve step leaves; the full KYC flow is sellers.spec.ts):
// seller A registers for real, B and C are copies of A with their own id / email / store.
const K = "corecart-demo-v1";
const PHOTO = path.join(process.cwd(), "public/images/placeholders/game-placeholder-03.jpg");
type Req = { seq: number; seller: "A" | "B" | "C"; name: string; platform?: string; region?: string; edition?: string; link?: string; note?: string; status?: string; productId?: string; reason?: string; daysAgo: number };
const REQUESTS: Req[] = [
  { seq: 1001, seller: "A", name: "Hollow Knight: Silksong", edition: "Standard", link: "https://store.steampowered.com/app/1030300", note: "I have 200 keys from the publisher.", daysAgo: 4 },
  { seq: 1002, seller: "B", name: "hollow knight silksong", daysAgo: 3 }, // same product, other spelling
  { seq: 1003, seller: "C", name: "Hollow Knight: Silksong", platform: "Xbox", daysAgo: 2 }, // same name, other platform
  { seq: 1004, seller: "B", name: "Hades II", region: "Europe", daysAgo: 1 },
  { seq: 1005, seller: "A", name: "Doom Eternal Deluxe", status: "added", productId: "key-doom-eternal-steam", daysAgo: 9 },
  { seq: 1006, seller: "C", name: "Fake Game XYZ", status: "rejected", reason: "Not a real product", daysAgo: 8 },
];

async function seed(page: Page) {
  const a = await registerAndVerify(page, { name: "Anna Seller" });
  const tag = Date.now().toString(36);
  const emails = await page.evaluate(([k, reqs, t]) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}"); const base = s.users.find((x: { id: string }) => x.id === s.sessionUserId); const now = new Date().toISOString();
    const make = (key: string, name: string, store: string) => {
      const u = key === "A" ? base : { ...base, id: crypto.randomUUID(), name, email: `${key.toLowerCase()}.${t}@example.com` };
      if (key !== "A") s.users.push(u);
      u.role = "seller"; const apps = (s.sellerApps ??= []);
      apps.push({ id: crypto.randomUUID(), seq: 200 + apps.length, userId: u.id, email: u.email, status: "approved", sellerType: "individual", data: {}, merchantName: store, merchantKey: store.toLowerCase().replace(/[^a-z0-9]/g, ""),
        idType: "national_id", idNumber: "1234567890123", freezeUntil: null, freezeReleasedAt: null, freezeReleasedBy: null, decidedAt: "2026-03-02T03:00:00.000Z", decidedById: null, reason: null, blacklistReason: null, statusBefore: null, createdAt: now });
      return { id: u.id, email: u.email, store };
    };
    const who = { A: make("A", "Anna Seller", `Pro Gamers ${t}`), B: make("B", "Bea Seller", `KeyShop TH ${t}`), C: make("C", "Chai Seller", `Game Hub ${t}`) };
    const mk = (s.market ??= {}); mk.stores ??= []; mk.offers ??= []; mk.keys ??= []; mk.requests ??= []; mk.requestEvents ??= [];
    for (const w of Object.values(who)) mk.stores.push({ userId: w.id, slug: w.store.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: w.store, invoices: false, lowStockAt: 10 });
    for (const r of reqs) {
      const id = crypto.randomUUID(); const at = new Date(Date.now() - r.daysAgo * 86400_000).toISOString(); const status = r.status ?? "waiting";
      mk.requests.push({ id, seq: r.seq, sellerId: who[r.seller].id, nameKey: r.name.toLowerCase(), name: r.name, platform: r.platform ?? "Steam", region: r.region ?? "Global", edition: r.edition ?? "", link: r.link ?? "", note: r.note ?? "",
        status, productId: r.productId ?? null, reason: r.reason ?? null, createdAt: at, decidedAt: status === "waiting" ? null : now, decidedBy: null });
      mk.requestEvents.push({ requestId: id, adminId: null, action: "sent", detail: "", createdAt: at });
    }
    localStorage.setItem(k, JSON.stringify(s));
    return { A: who.A.email, B: who.B.email, C: who.C.email, storeA: who.A.store, storeB: who.B.store };
  }, [K, REQUESTS, tag] as const);
  expect(emails.A).toBe(a);
  return emails;
}
const phone = async (page: Page, isMobile: boolean) => { if (isMobile) await page.setViewportSize({ width: 390, height: 844 }); };
// Admin sidebar link (desktop) or the "Admin section" select (phones).
async function openRequests(page: Page, isMobile: boolean) {
  await signOutDemo(page);
  await signInDemoAdmin(page);
  if (isMobile) await page.getByRole("combobox", { name: "Admin section" }).selectOption({ label: "Product requests" });
  else await page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Product requests" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Product requests" })).toBeVisible();
}
const row = (page: Page, n: string) => page.locator(`tr[data-request="${n}"]`);
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });

test("list: Waiting / Added / Rejected with counts, seller ✓, product asked, link / note, same-name grouping, history; Reject needs a reason → seller email + Rejected tab", async ({ page, isMobile }) => {
  const who = await seed(page);
  await phone(page, isMobile);
  await openRequests(page, isMobile);
  await expect(tab(page, "Waiting")).toHaveText("Waiting4"); await expect(tab(page, "Added")).toHaveText("Added1"); await expect(tab(page, "Rejected")).toHaveText("Rejected1");
  await expect(page.locator(".pr-table tbody tr[data-request]")).toHaveCount(4);
  await expect(page.locator(".pr-table tbody tr[data-request]").first()).toHaveAttribute("data-request", "PR-1004"); // newest first
  const r1 = row(page, "PR-1001");
  await expect(r1).toContainText(who.storeA); await expect(r1.getByLabel("Verified seller")).toBeVisible(); await expect(r1).toContainText(who.A);
  await expect(r1).toContainText("Hollow Knight: Silksong"); await expect(r1).toContainText("Steam · GLOBAL · Standard");
  await expect(r1.getByRole("link", { name: "store.steampowered.com" })).toHaveAttribute("href", "https://store.steampowered.com/app/1030300");
  await expect(r1).toContainText("“I have 200 keys from the publisher.”");
  await expect(r1).toContainText("2 sellers"); await expect(r1).toContainText("Also PR-1002"); await expect(r1).toContainText("+1 on another platform / region");
  await expect(row(page, "PR-1003")).toContainText("1 seller"); await expect(row(page, "PR-1003")).toContainText("+2 on another platform / region");
  await expect(row(page, "PR-1004")).toContainText("Steam · EUROPE"); await expect(row(page, "PR-1004").locator("td").nth(3)).toHaveText("—");
  await expect(r1.getByRole("link", { name: "Add product… PR-1001" })).toHaveAttribute("href", /\/admin\/products\/edit\/?\?request=/);
  await noHorizontalScroll(page);

  // History
  await r1.getByRole("button", { name: "History (1) PR-1001" }).click();
  const hist = page.getByRole("region", { name: "History of PR-1001" });
  await expect(hist.locator("li")).toHaveCount(1); await expect(hist).toContainText("Sent by the seller"); await expect(hist).toContainText("Seller");
  await r1.getByRole("button", { name: "History (1) PR-1001" }).click();
  await expect(hist).toHaveCount(0);

  // Reject: reason required (3–300), only this request closes.
  await row(page, "PR-1004").getByRole("button", { name: "Reject… PR-1004" }).click();
  const rej = page.getByRole("group", { name: "Reject PR-1004" });
  await rej.getByRole("button", { name: "Confirm reject" }).click();
  await expect(rej.getByRole("alert")).toHaveText("Write a reason (3–300 characters). The seller sees it.");
  await rej.getByLabel("Reason (required, the seller sees it)").fill("We cannot sell EUROPE keys of this game yet.");
  await expect(rej).toContainText("44 / 300");
  await noHorizontalScroll(page);
  await rej.getByRole("button", { name: "Confirm reject" }).click();
  await expect(page.getByRole("status").filter({ hasText: "PR-1004 rejected." })).toHaveText("PR-1004 rejected. The seller was emailed the reason.");
  await expect(tab(page, "Waiting")).toHaveText("Waiting3"); await expect(tab(page, "Rejected")).toHaveText("Rejected2");
  await expect(row(page, "PR-1004")).toHaveCount(0);
  const mail = (await outbox(page)).filter((m) => m.template === "requestRejected");
  expect(mail).toHaveLength(1); expect(mail[0].to).toBe(who.B); expect(mail[0].subject).toBe("Request PR-1004 was not added");
  expect(mail[0].html).toContain("We cannot sell EUROPE keys of this game yet."); expect(mail[0].html).toContain("Hades II · Steam · EUROPE");

  await tab(page, "Rejected").click();
  await expect(page).toHaveURL(/tab=rejected/);
  const r4 = row(page, "PR-1004");
  await expect(r4.locator(".chip")).toHaveText("Rejected"); await expect(r4).toContainText("We cannot sell EUROPE keys of this game yet."); await expect(r4).toContainText("admin@corecart.demo");
  await expect(r4.getByRole("button", { name: /^Reject/ })).toHaveCount(0);
  await r4.getByRole("button", { name: "History (2) PR-1004" }).click();
  await expect(page.getByRole("region", { name: "History of PR-1004" }).locator("li").nth(1)).toContainText("Rejected: We cannot sell EUROPE keys of this game yet.");
  await expect(page.getByRole("region", { name: "History of PR-1004" }).locator("li").nth(1)).toContainText("admin@corecart.demo");
  await page.reload(); // tab kept in the address
  await expect(tab(page, "Rejected")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".pr-table tbody tr[data-request]")).toHaveCount(2);

  // Seller B sees the reason on My requests.
  await signInAs(page, who.B);
  await page.goto("seller/requests/");
  const mine = page.locator(".sl-req tr", { hasText: "Hades II" });
  await expect(mine.locator(".chip")).toHaveText("Rejected"); await expect(mine).toContainText("We cannot sell EUROPE keys of this game yet.");
});

test("Link to existing: catalog search (published game keys), closes every waiting request for the same product (not other platforms), emails each seller Sell it ›", async ({ page, isMobile }) => {
  const who = await seed(page);
  await phone(page, isMobile);
  await openRequests(page, isMobile);
  await row(page, "PR-1002").getByRole("button", { name: "Link to existing… PR-1002" }).click();
  const box = page.getByRole("group", { name: "Link PR-1002 to an existing product" });
  await expect(box).toContainText("This also closes PR-1001 (same product) and emails 2 sellers.");
  await expect(box.getByRole("searchbox", { name: "Search the catalog" })).toHaveValue("hollow knight silksong");
  await expect(box.getByRole("button", { name: "Confirm link" })).toBeDisabled();
  await box.getByRole("searchbox", { name: "Search the catalog" }).fill("elden ring"); // same matcher as the store header
  await box.getByRole("radio", { name: /^Elden Ring \(PC\) Steam Key GLOBAL/ }).check();
  await noHorizontalScroll(page);
  await box.getByRole("button", { name: "Confirm link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "linked to" })).toHaveText("PR-1002, PR-1001 linked to Elden Ring (PC) Steam Key GLOBAL. Sellers emailed.");
  await expect(tab(page, "Waiting")).toHaveText("Waiting2"); await expect(tab(page, "Added")).toHaveText("Added3");
  await expect(row(page, "PR-1003")).toBeVisible(); // Xbox request stays open
  await expect(row(page, "PR-1003")).toContainText("1 seller"); await expect(row(page, "PR-1003")).not.toContainText("another platform");

  const mails = (await outbox(page)).filter((m) => m.template === "requestAdded");
  expect(mails.map((m) => m.to).sort()).toEqual([who.A, who.B].sort());
  for (const m of mails) { expect(m.html).toContain("seller/offers/new?product=key-elden-ring-steam"); expect(m.html).toContain("Sell it ›"); expect(m.html).toContain("Elden Ring (PC) Steam Key GLOBAL"); }
  expect(mails.find((m) => m.to === who.A)!.subject).toBe("Request PR-1001: Elden Ring (PC) Steam Key GLOBAL is in the catalog");

  await tab(page, "Added").click();
  const r1 = row(page, "PR-1001");
  await expect(r1.locator(".chip")).toHaveText("Added"); await expect(r1.getByRole("link", { name: "key-elden-ring-steam" })).toBeVisible(); await expect(r1).toContainText("admin@corecart.demo");
  await r1.getByRole("button", { name: "History (2) PR-1001" }).click();
  await expect(page.getByRole("region", { name: "History of PR-1001" }).locator("li").nth(1)).toContainText("Linked to an existing product: Elden Ring (PC) Steam Key GLOBAL (key-elden-ring-steam) · with PR-1002");
  await noHorizontalScroll(page);

  // Seller A: Added + Sell it › opens New offer with the product.
  await signInAs(page, who.A);
  await page.goto("seller/requests/");
  const mine = page.locator(".sl-req tr", { hasText: "Hollow Knight: Silksong" });
  await expect(mine.locator(".chip")).toHaveText("Added");
  await mine.getByRole("link", { name: "Sell it ›" }).click();
  await expect(page.getByRole("combobox", { name: /Product name/ })).toHaveValue("Elden Ring (PC) Steam Key GLOBAL");
});

test("Add product… opens the editor filled from the request (game key only); Published save → Added for the request + email; Draft save → request stays Waiting", async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  const who = await seed(page);
  await phone(page, isMobile);
  await openRequests(page, isMobile);
  await row(page, "PR-1004").getByRole("link", { name: "Add product… PR-1004" }).click();
  const form = page.locator("form.prod-editor");
  await expect(form.getByRole("status").filter({ hasText: "From seller request" })).toContainText("PR-1004");
  await expect(form.getByRole("status").filter({ hasText: "From seller request" })).toContainText("Hades II · Steam · EUROPE");
  await expect(form.getByLabel("Name", { exact: true })).toHaveValue("Hades II");
  await expect(form.getByLabel("Platform", { exact: true })).toHaveValue("Steam");
  await expect(form.locator("#p-region")).toHaveValue("Europe");
  await expect(form.getByRole("radio", { name: "Hardware" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "‹ Product requests" })).toBeVisible();
  await form.locator("#p-price-in").fill("690");
  await form.locator('input[type="file"]').setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this image" }).click();
  await expect(page.getByText("Image ready (800 × 1000)")).toBeVisible();
  await page.getByRole("radio", { name: "Published (in the store)" }).check();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Product requests" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Hades II saved." })).toHaveText("Hades II saved. PR-1004 added. Seller emailed.");
  await expect(tab(page, "Waiting")).toHaveText("Waiting3");
  const id = (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").market.requests.find((r: { seq: number }) => r.seq === 1004).productId, K)) as string;
  expect(id).toMatch(/^key-hades-ii/);
  const mail = (await outbox(page)).filter((m) => m.template === "requestAdded");
  expect(mail).toHaveLength(1); expect(mail[0].to).toBe(who.B); expect(mail[0].html).toContain(`seller/offers/new?product=${id}`);

  // Draft: product saved, request stays Waiting (sellers cannot sell drafts) with an amber note.
  await row(page, "PR-1003").getByRole("link", { name: "Add product… PR-1003" }).click();
  await expect(form.getByLabel("Platform", { exact: true })).toHaveValue("Xbox");
  await form.locator("#p-price-in").fill("500");
  await form.locator('input[type="file"]').setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Use this image" }).click();
  await expect(page.getByText("Image ready (800 × 1000)")).toBeVisible();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved as a draft" })).toContainText("The request stays Waiting: publish the product, then use Link to existing.");
  await expect(tab(page, "Waiting")).toHaveText("Waiting3");
  await expect(row(page, "PR-1003").locator(".chip")).toHaveText("Waiting");
  await noHorizontalScroll(page);

  // An answered request cannot be opened in the editor again.
  const pr4 = (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").market.requests.find((r: { seq: number }) => r.seq === 1004).id, K)) as string;
  await page.goto(`admin/products/edit/?request=${pr4}`);
  await expect(page.getByRole("alert").filter({ hasText: "PR-1004" })).toHaveText("PR-1004 was already answered (added).");
});
