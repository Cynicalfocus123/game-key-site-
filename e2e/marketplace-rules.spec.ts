import { expect, test } from "@playwright/test";
import { SEED_PRODUCTS } from "../lib/catalog";
import { catalogMatch, checkKeyText, keyReport, linesText, markExisting, offerCounts, offerStatus, parseRequest, parseUsd, searchSellable, slugify, youReceive, type SellerOffer } from "../lib/marketplace";

// Seller marketplace step 1 (2026-10-08): shared rules used by the demo store, the server API and the pages. Pure functions, no screen.
// The screens that use them get their own desktop + mobile tests in step 2+; the server paths go into scripts/smoke-server.mjs (sellers-market).
test.describe("Marketplace rules", () => {
  test.beforeEach(({ isMobile }) => { test.skip(isMobile, "Pure logic (no screen): runs once on desktop. Screens using these rules are tested on desktop + mobile in the seller page specs."); });

  test("key text: format per platform, duplicates and wrong lines by line number", () => {
    const c = checkKeyText(["AAAAA-BBBBB-CCCCC", "ddddd-eeeee-fffff", "AAAAA-BBBBB-CCCCC", "12345", "", "key", "GGGGG-HHHHH-JJJJJ,extra"].join("\n"), "Steam");
    expect(c.ok.map((k) => k.line)).toEqual([1, 2, 7]);
    expect(c.ok[1].code).toBe("DDDDD-EEEEE-FFFFF"); // upper-cased
    expect(c.duplicates).toEqual([{ line: 3, first: 1 }]);
    expect(c.invalid).toEqual([{ line: 4, text: "12345" }]);
    expect(c.format).toEqual({ name: "Steam", example: "XXXXX-XXXXX-XXXXX" });
    expect(checkKeyText("AAAA-BBBB-CCCC", "PlayStation").ok).toHaveLength(1);
    expect(checkKeyText("AAAAA-BBBBB-CCCCC", "PlayStation").invalid).toHaveLength(1);
    expect(checkKeyText("AAAAA-BBBBB-CCCCC-DDDDD-EEEEE", "Xbox").ok).toHaveLength(1);
    expect(checkKeyText("SOME-OTHER-KEY-1", "Ubisoft Connect").ok).toHaveLength(1); // general rule
    const many = Array.from({ length: 1001 }, (_, i) => `AAAAA-BBBBB-${String(i).padStart(5, "0")}`).join("\n");
    expect(checkKeyText(many, "Steam").tooMany).toBe(true);
    expect(checkKeyText(many.split("\n").slice(0, 1000).join("\n"), "Steam").tooMany).toBe(false);
  });

  test("already in CoreCart moves lines out; report never carries key text", () => {
    const c = markExisting(checkKeyText("AAAAA-BBBBB-CCCCC\nDDDDD-EEEEE-FFFFF", "Steam"), (code) => code.startsWith("DDDDD"));
    expect(c.ok.map((k) => k.line)).toEqual([1]); expect(c.existing).toEqual([2]);
    const r = keyReport(c);
    expect(r.okCount).toBe(1); expect(r.okLines).toEqual([1]);
    expect(JSON.stringify(r)).not.toContain("AAAAA");
    expect(linesText([3, 4, 5, 6, 7, 8, 9, 10])).toBe("lines 3, 4, 5, 6, 7, 8 and 2 more");
    expect(linesText([4])).toBe("line 4");
  });

  test("USD price, status, counts, you receive", () => {
    expect(parseUsd("28.12")).toBe(2812); expect(parseUsd("$1,000")).toBe(100000); expect(parseUsd("0.05")).toBeNull(); expect(parseUsd("10000.01")).toBeNull(); expect(parseUsd("1.234")).toBeNull();
    expect(offerStatus(true, 3)).toBe("active"); expect(offerStatus(true, 0)).toBe("sold_out"); expect(offerStatus(false, 9)).toBe("paused");
    const o = (status: SellerOffer["status"], stock: number) => ({ status, stock }) as SellerOffer;
    expect(offerCounts([o("active", 120), o("sold_out", 0), o("paused", 58)])).toEqual({ all: 3, active: 1, paused: 1, soldOut: 1, keysInStock: 178 });
    expect(youReceive(2812)).toBeNull(); // commission pending
    expect(youReceive(10000, 1000)).toBe(9000);
  });

  test("requests: form checks, catalog match (sell it), search, slugs", () => {
    const bad = parseRequest({ name: "x", platform: "Atari", region: "Mars", link: "http://a.b" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["link", "name", "platform", "region"]);
    const good = parseRequest({ name: " Hollow  Knight: Silksong ", platform: "Steam", region: "Global", edition: "", link: "https://store.steampowered.com/app/1030300", note: "I have 200 keys" });
    expect(good.ok && good.input.name).toBe("Hollow Knight: Silksong");
    expect(catalogMatch(SEED_PRODUCTS, { name: "elden ring", platform: "Steam", region: "Global", edition: "" })?.id).toBe("key-elden-ring-steam");
    expect(catalogMatch(SEED_PRODUCTS, { name: "Elden Ring", platform: "Xbox", region: "Global", edition: "" })).toBeNull();
    expect(catalogMatch(SEED_PRODUCTS, { name: "Hollow Knight: Silksong", platform: "Steam", region: "Global", edition: "" })).toBeNull();
    expect(searchSellable(SEED_PRODUCTS, "elden rign")[0]?.id).toBe("key-elden-ring-steam"); // same matcher as the header (1 typo)
    expect(searchSellable(SEED_PRODUCTS, "rtx").every((p) => p.kind === "game_key")).toBe(true); // hardware never sellable
    expect(slugify("Pro Gamers!")).toBe("pro-gamers"); expect(slugify("CoreCart")).toBe("seller-corecart"); expect(slugify("ร้านเกม")).toBe("seller-store");
  });
});
