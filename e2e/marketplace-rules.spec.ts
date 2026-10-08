import { expect, test } from "@playwright/test";
import { SEED_PRODUCTS } from "../lib/catalog";
import { catalogMatch, checkKeyText, keyReport, linesText, markExisting, offerCounts, offerStatus, parseRequest, parseUsd, offerList, searchSellable, slugify, sortOffers, youReceive, type PublicOffer, type SellerOffer } from "../lib/marketplace";
import { checkLogo, logoInfo } from "../lib/seller-logo";

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

  test("store logo (step 4): WebP VP8 / VP8L / VP8X and AVIF sizes read from the bytes; limits 256–2048 px longest side, 1 MB; other files refused", () => {
    const riff = (chunk: string, body: number[]) => { const b = new Uint8Array(30 + 10); b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0); b.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8); b.set([...chunk].map((c) => c.charCodeAt(0)), 12); b.set(body, 20); return b; };
    // VP8 (lossy): start code 9d 01 2a at 23, 14-bit width / height (little endian) at 26 / 28.
    const vp8 = riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0x00, 0x02, 0x2c, 0x01]); // 512 × 300
    expect(logoInfo(vp8)).toEqual({ type: "webp", width: 512, height: 300 });
    // VP8L (lossless): 0x2f then 14-bit width-1 and height-1 packed.
    const w = 799, h = 299; const vp8l = riff("VP8L", [0x2f, w & 0xff, ((w >> 8) & 0x3f) | ((h & 0x3) << 6), (h >> 2) & 0xff, (h >> 10) & 0x0f]);
    expect(logoInfo(vp8l)).toEqual({ type: "webp", width: 800, height: 300 });
    // VP8X (extended): 24-bit width-1 at 24, height-1 at 27.
    const vp8x = riff("VP8X", [0, 0, 0, 0, 0xff, 0x01, 0, 0xff, 0x01, 0]); // 512 × 512
    expect(logoInfo(vp8x)).toEqual({ type: "webp", width: 512, height: 512 });
    // AVIF: ftyp avif + the largest ispe (a grid has a tile ispe too).
    const box = (type: string, body: number[]) => { const n = 8 + body.length; return [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255, ...[...type].map((c) => c.charCodeAt(0)), ...body]; };
    const ispe = (x: number, y: number) => box("ispe", [0, 0, 0, 0, x >>> 24, (x >> 16) & 255, (x >> 8) & 255, x & 255, y >>> 24, (y >> 16) & 255, (y >> 8) & 255, y & 255]);
    const avif = new Uint8Array([...box("ftyp", [..."avif"].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [..."mif1"].map((c) => c.charCodeAt(0)))), ...box("meta", [0, 0, 0, 0, ...ispe(256, 256), ...ispe(1024, 768)])]);
    expect(logoInfo(avif)).toEqual({ type: "avif", width: 1024, height: 768 });
    const heic = avif.slice(); heic.set([..."heic"].map((c) => c.charCodeAt(0)), 8); heic.set([..."mif1"].map((c) => c.charCodeAt(0)), 16);
    expect(logoInfo(heic)).toBeNull(); // HEIF but not AVIF
    expect(logoInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(0)]))).toBeNull(); // PNG
    expect(checkLogo(vp8)).toEqual({ ok: true, info: { type: "webp", width: 512, height: 300 } });
    expect(checkLogo(riff("VP8X", [0, 0, 0, 0, 0xfe, 0, 0, 0xfe, 0, 0]))).toEqual({ ok: false, error: "Logo is too small (255 × 255). The longest side must be at least 256 px." });
    expect(checkLogo(riff("VP8X", [0, 0, 0, 0, 0xff, 0x00, 0, 0x63, 0, 0]))).toMatchObject({ ok: true }); // 256 × 100: longest side counts, any shape
    expect(checkLogo(riff("VP8X", [0, 0, 0, 0, 0x00, 0x08, 0, 0xff, 0x01, 0]))).toEqual({ ok: false, error: "Logo is too big. Longest side up to 2048 px and up to 1 MB." }); // 2049 × 512
    const heavy = new Uint8Array(1024 * 1024 + 1); heavy.set(vp8);
    expect(checkLogo(heavy)).toEqual({ ok: false, error: "Logo is too big. Longest side up to 2048 px and up to 1 MB." });
    expect(checkLogo(new Uint8Array(10))).toEqual({ ok: false, error: "Use a WebP or AVIF file." });
  });

  test("buyer offer order (step 4): Trusted first, then lowest price; Featured = first; Lowest price = cheapest; CoreCart wins a full tie", () => {
    const seller = (name: string, trusted = false, own = false, avg?: number) => ({ slug: name.toLowerCase(), name, logo: null, verified: true, trusted, rating: avg ? { average: avg, count: 3 } : null, since: null, own });
    const o = (id: string, unit: number, s: PublicOffer["seller"]): PublicOffer => ({ id, productId: "p", seller: s, priceUsdCents: 100, unit, max: 5 });
    const list = [o("a", 900, seller("Cheap")), o("b", 1200, seller("Trusted", true)), o("c", 1000, seller("CoreCart", false, true)), o("d", 900, seller("Rated", false, false, 4.5)), o("e", 1000, seller("Zed"))];
    expect(sortOffers(list).map((x) => x.id)).toEqual(["b", "d", "a", "c", "e"]); // trusted; 900 rated before unrated; 1000 CoreCart before Zed
    const r = offerList(list);
    expect(r.featured?.id).toBe("b"); expect(r.others.map((x) => x.id)).toEqual(["d", "a", "c", "e"]); expect(r.lowestId).toBe("d");
    expect(offerList([o("x", 5, seller("Solo"))]).lowestId).toBeNull(); // one offer: no "Lowest price" tag
  });
});
