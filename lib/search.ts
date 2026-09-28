// Product search (future task S1). Own small matcher, no library. Shared by the header dropdown and the listing page.
// Finds a product when the query:
// - uses numbers or Roman numerals ("gta 4" ↔ "IV", "part 2" ↔ "Part II"),
// - joins or splits words ("lastof" → "The Last of Us", "black myth" → "Black Myth: Wukong"),
// - uses initials ("gta" → "Grand Theft Auto"),
// - has words in any order, word starts ("cyber 20" → "Cyberpunk 2077") or one typo in a word of 4+ letters ("cyberpnuk", "elden rign").
// Also matches platform, region, genres, product type. Ranking: exact title > title starts with > all words in title >
// initials > joined title > other fields > typo. Sold out always after in stock; ties by popularity.
import type { Product } from "./catalog";

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
// Lower case, accents folded, ™ ® © and punctuation removed, Roman numerals I–XX → 1–20.
export function normalize(text: string): string[] {
  return text.replace(/[\u2122\u00ae\u00a9]/g, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean)
    .map((w) => { const n = ROMAN.indexOf(w); return n >= 0 ? String(n + 1) : w; });
}

// Edit distance ≤ 1 (one letter added, removed, changed, or two neighbours swapped).
function oneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; continue; }
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
const typoMatch = (q: string, words: string[]) => q.length >= 4 && words.some((w) => oneEdit(q, w) || (w.length > q.length && oneEdit(q, w.slice(0, q.length))));

type Indexed = { p: Product; name: string[]; nameJoined: string; initials: string; other: string[] };
const cache = new WeakMap<Product[], Indexed[]>();
function index(products: Product[]): Indexed[] {
  let out = cache.get(products);
  if (!out) {
    out = products.map((p) => { const name = normalize(p.name); return { p, name, nameJoined: name.join(""), initials: name.map((w) => w[0]).join(""), other: normalize([p.platform, p.region, p.type, ...(p.genres ?? []), p.kind === "game_key" ? "game key" : "hardware"].filter(Boolean).join(" ")) }; });
    cache.set(products, out);
  }
  return out;
}

// 0 = no match. Higher = better.
function score(it: Indexed, q: string[], qJoined: string): number {
  const starts = (words: string[]) => (w: string) => words.some((x) => x.startsWith(w));
  if (it.nameJoined === qJoined) return 1000;
  if (it.nameJoined.startsWith(qJoined)) return 800;
  if (q.every(starts(it.name))) return 600;
  if (q.every((w) => starts(it.name)(w) || (/^[a-z]{2,5}$/.test(w) && it.initials.includes(w)))) return 450;
  if (qJoined.length >= 3 && it.nameJoined.includes(qJoined)) return 500;
  const all = [...it.name, ...it.other];
  if (q.every(starts(all))) return 300;
  if (q.every((w) => starts(all)(w) || typoMatch(w, all))) return 150;
  return 0;
}

export const MIN_QUERY = 2;
// Matching products, best first. Empty or 1-character query → [].
export function searchProducts(products: Product[], query: string): Product[] {
  const q = normalize(query); const qJoined = q.join("");
  if (qJoined.length < MIN_QUERY) return [];
  return index(products).map((it) => ({ it, s: score(it, q, qJoined) })).filter((x) => x.s > 0)
    .sort((a, b) => Number(!!a.it.p.soldOut) - Number(!!b.it.p.soldOut) || b.s - a.s || (b.it.p.popularity ?? 0) - (a.it.p.popularity ?? 0))
    .map((x) => x.it.p);
}

// Discount percent for "-32%" labels (null when not on sale).
export const discountPercent = (p: Product) => (p.old && p.old > p.price ? Math.round(((p.old - p.price) / p.old) * 100) : null);
