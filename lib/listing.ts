// Listing pages (future task S2 + S3): one filter-driven page for search results, all games, genre / platform pages and hardware.
// State lives in the URL (?q=&sort=&min=&max=&country=&genre=FPS&platform=Steam …) so back button + shared links work.
// Filters: OR inside a group, AND between groups. Option counts are "facet" counts: products matching every other group.
import { regionWorks, upgradeGenres, type Product } from "./catalog";
import type { FilterView } from "./filters";
import { searchProducts } from "./search";

export type GroupId = "type" | "os" | "sale" | "platform" | "genre" | "region";
export type Group = { id: GroupId; label: string; values: (p: Product) => string[] };
export const onSale = (p: Product) => !!p.old && p.old > p.price;
// Sidebar order (after Price range + Country). Game-only groups have no values on hardware, so they hide there by themselves.
export const GROUPS: Group[] = [
  { id: "type", label: "Product type", values: (p) => [p.type ?? (p.kind === "hardware" ? "Hardware" : "Game")] },
  { id: "os", label: "Operating system", values: (p) => (p.os ? [p.os] : []) },
  { id: "sale", label: "Sale", values: (p) => (onSale(p) ? ["On sale"] : []) },
  { id: "platform", label: "Platform", values: (p) => (p.platform ? [p.platform] : []) },
  { id: "genre", label: "Genre", values: (p) => p.genres ?? [] },
  { id: "region", label: "Region", values: (p) => (p.region ? [p.region] : []) },
];

export const SORTS = [
  { id: "best", label: "Best match" }, // only with a search text
  { id: "popular", label: "Most popular" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "newest", label: "Date: newest first" },
  { id: "oldest", label: "Date: oldest first" },
  { id: "az", label: "Alphabet: A–Z" },
  { id: "za", label: "Alphabet: Z–A" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

// trending / isNew (task D): ?trending=1 / ?new=1 = products flagged "Trending now" / "New" in the product editor (menu links).
export type ListState = { q: string; sort: SortId; min: number | null; max: number | null; country: string; sel: Record<GroupId, string[]>; trending?: boolean; isNew?: boolean };
const emptySel = (): Record<GroupId, string[]> => ({ type: [], os: [], sale: [], platform: [], genre: [], region: [] });
const num = (v: string | null) => { if (!v) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };

export function parseState(params: URLSearchParams): ListState {
  const q = (params.get("q") ?? "").slice(0, 100);
  const sortRaw = params.get("sort"); const sort = (SORTS.find((s) => s.id === sortRaw)?.id ?? (q ? "best" : "popular")) as SortId;
  const sel = emptySel();
  for (const g of GROUPS) sel[g.id] = [...new Set(params.getAll(g.id).filter(Boolean).map((v) => v.slice(0, 60)))];
  sel.genre = upgradeGenres(sel.genre) ?? []; // old links (?genre=FPS) → new names
  return { q, sort: sort === "best" && !q ? "popular" : sort, min: num(params.get("min")), max: num(params.get("max")), country: (params.get("country") ?? "").toUpperCase().slice(0, 2), sel,
    trending: params.get("trending") === "1", isNew: params.get("new") === "1" };
}

export function stateQuery(s: ListState): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  for (const g of GROUPS) for (const v of s.sel[g.id]) p.append(g.id, v);
  if (s.min !== null) p.set("min", String(s.min));
  if (s.max !== null) p.set("max", String(s.max));
  if (s.country) p.set("country", s.country);
  if (s.trending) p.set("trending", "1");
  if (s.isNew) p.set("new", "1");
  if (s.sort !== (s.q ? "best" : "popular")) p.set("sort", s.sort);
  return p.toString();
}
export const filterCount = (s: ListState) => GROUPS.reduce((n, g) => n + s.sel[g.id].length, 0) + (s.min !== null || s.max !== null ? 1 : 0) + (s.country ? 1 : 0) + (s.trending ? 1 : 0) + (s.isNew ? 1 : 0);

// `priceMajor`: product price in the visitor currency (major units), so the price range matches the prices on screen.
// `view`: admin filter config (lib/filters.ts S4). Hidden groups are ignored; hidden / deleted values leave products and filters.
type Opts = { priceMajor: (p: Product) => number; view?: FilterView };
const groupOn = (o: Opts, id: GroupId | "country" | "price") => o.view?.group(id).shown ?? true;
const valuesOf = (g: Group, p: Product, o: Opts) => (o.view ? g.values(p).filter((v) => o.view!.shown(g.id, v)) : g.values(p));
function passes(p: Product, s: ListState, o: Opts, skip?: GroupId) {
  if (groupOn(o, "price") && s.min !== null && o.priceMajor(p) < s.min) return false;
  if (groupOn(o, "price") && s.max !== null && o.priceMajor(p) > s.max) return false;
  if (groupOn(o, "country") && s.country && regionWorks(p, s.country) === false) return false;
  if (s.trending && !p.trending) return false;
  if (s.isNew && !p.isNew) return false;
  return GROUPS.every((g) => g.id === skip || !groupOn(o, g.id) || !s.sel[g.id].length || valuesOf(g, p, o).some((v) => s.sel[g.id].includes(v)));
}

// Products for the page scope + search text (search keeps its best-match order for sort "best").
export const scoped = (base: Product[], q: string) => (q ? searchProducts(base, q) : base);

export function applyFilters(list: Product[], s: ListState, o: Opts): Product[] {
  const out = list.filter((p) => passes(p, s, o));
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name);
  const sorters: Record<SortId, ((a: Product, b: Product) => number) | null> = {
    best: null,
    popular: (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || byName(a, b),
    "price-asc": (a, b) => a.price - b.price || byName(a, b),
    "price-desc": (a, b) => b.price - a.price || byName(a, b),
    newest: (a, b) => (b.added ?? "").localeCompare(a.added ?? "") || byName(a, b),
    oldest: (a, b) => (a.added ?? "9999").localeCompare(b.added ?? "9999") || byName(a, b),
    az: byName,
    za: (a, b) => byName(b, a),
  };
  const sorter = sorters[s.sort];
  const sorted = sorter ? [...out].sort(sorter) : out;
  return [...sorted.filter((p) => !p.soldOut), ...sorted.filter((p) => p.soldOut)]; // sold out last
}

export type Facet = { value: string; label: string; count: number };
// Options per group with live counts. Options with 0 results are left out, except ones already picked (so they can be removed).
// Order: admin order when set (S4), else most results first. Hidden groups get no options.
export function facets(list: Product[], s: ListState, o: Opts): Record<GroupId, Facet[]> {
  const out = emptySel() as unknown as Record<GroupId, Facet[]>;
  for (const g of GROUPS) {
    if (!groupOn(o, g.id)) { out[g.id] = []; continue; }
    const counts = new Map<string, number>();
    for (const p of list) if (passes(p, s, o, g.id)) for (const v of new Set(valuesOf(g, p, o))) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const v of s.sel[g.id]) if (!counts.has(v) && (o.view?.shown(g.id, v) ?? true)) counts.set(v, 0);
    const pos = (v: string) => o.view?.position(g.id, v) ?? Number.MAX_SAFE_INTEGER;
    out[g.id] = [...counts].map(([value, count]) => ({ value, label: o.view?.label(g.id, value) ?? value, count }))
      .sort((a, b) => pos(a.value) - pos(b.value) || b.count - a.count || a.label.localeCompare(b.label));
  }
  return out;
}

// Page heading: "FPS games", "Steam games", "PC hardware", "Search results".
export function listingTitle(scope: "search" | "games" | "hardware", s: ListState, view?: FilterView) {
  if (scope === "search") return "Search results";
  if (scope === "hardware") return "PC hardware";
  const one = GROUPS.filter((g) => s.sel[g.id].length).map((g) => ({ g, v: s.sel[g.id] }));
  if (s.trending && !one.length && !s.isNew) return "Trending now";
  if (s.isNew && !one.length && !s.trending) return "New games";
  if (one.length === 1 && one[0].v.length === 1) {
    const { g } = one[0]; const v = [view?.label(g.id, one[0].v[0]) ?? one[0].v[0]];
    if (g.id === "genre" || g.id === "platform") return `${v[0]} games`;
    if (g.id === "sale") return "Games on sale";
    if (g.id === "region") return `${v[0]} game keys`;
    if (g.id === "type") return v[0] === "DLC" ? "DLC" : `${v[0]}s`;
  }
  // Random Steam Keys menu link: type Random key + platform Steam.
  if (one.length === 2 && s.sel.type.length === 1 && s.sel.type[0] === "Random key" && s.sel.platform.length === 1) {
    return `Random ${view?.label("platform", s.sel.platform[0]) ?? s.sel.platform[0]} keys`;
  }
  return "All games";
}
