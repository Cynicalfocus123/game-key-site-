// Store menu (task D, user 2026-09-29): one admin-managed list for the header bar, the products drawer and the footer "Shop" column.
// Admin: /admin/categories (create, rename, delete, reorder, show / hide, one level of sub-items, link target, NEW badge).
// Pure rules shared by the demo store and the server (same checks, same errors). Delete = soft (deleted: true), like filters.
import { GENRES } from "./catalog";

export type MenuKind = "link" | "genres" | "under"; // genres = automatic genre submenu (admin genre list), under = "Under ฿350" in the visitor currency
export type MenuItem = { id: string; parent: string | null; label: string; href: string; kind: MenuKind; position: number; hidden: boolean; isNew: boolean; inBar: boolean; inFooter: boolean; deleted: boolean };
export type MenuInput = { label: string; href: string; kind: MenuKind; parent: string | null; isNew: boolean; inBar: boolean; inFooter: boolean };
export type MenuPatch = Partial<MenuInput> & { hidden?: boolean; move?: -1 | 1 };
export type MenuEdit = { ok: true; items: MenuItem[] } | { ok: false; error: string };

export const MENU_LABEL_MAX = 40;
export const MENU_HREF_MAX = 200;
export const MENU_MAX_ITEMS = 150;
export const MENU_KINDS: MenuKind[] = ["link", "genres", "under"];
export const MENU_WRITE_LIMIT = { max: 120, windowMs: 60_000 };
export const MENU_ERRORS = {
  label: `Name must be 1–${MENU_LABEL_MAX} characters.`,
  href: "Link must be a store path that starts with / (for example /games?platform=Steam).",
  parent: "A sub-item can only sit under a top-level item.",
  hasChildren: "Move or delete its sub-items first — only one level of sub-items is allowed.",
  genresTop: "The automatic Genres list can only be a top-level item.",
  tooMany: `The menu can hold at most ${MENU_MAX_ITEMS} items.`,
  notFound: "Menu item not found.",
  limit: "Too many changes. Wait a minute and try again.",
};

// Link targets offered in the admin (listing pages + filters). "Custom" lets the admin type any store path.
const games = (q = "") => `/games${q ? `?${q}` : ""}`;
export const RANDOM_STEAM_HREF = games("type=Random+key&platform=Steam");
export const MENU_TARGETS: { label: string; href: string }[] = [
  { label: "All games (All offers)", href: games() },
  { label: "On sale (any discounted game)", href: games("sale=On+sale") },
  { label: "Trending now (flagged products)", href: games("trending=1") },
  { label: "New (flagged products)", href: games("new=1") },
  { label: "Random Steam keys", href: RANDOM_STEAM_HREF },
  { label: "All random keys", href: games("type=Random+key") },
  { label: "Newest games (sorted)", href: games("sort=newest") },
  { label: "PC games (Windows)", href: games("os=Windows") },
  ...["Steam", "Xbox", "PlayStation", "Nintendo"].map((p) => ({ label: `Platform: ${p}`, href: games(`platform=${p}`) })),
  ...["DLC", "Software", "Gift card"].map((t) => ({ label: `Type: ${t}`, href: games(`type=${t.replace(" ", "+")}`) })),
  ...GENRES.map((g) => ({ label: `Genre: ${g}`, href: games(`genre=${encodeURIComponent(g).replace(/%20/g, "+")}`) })),
  { label: "PC hardware", href: "/hardware" },
  { label: "All products (search page)", href: "/search" },
  { label: "Deals (everything on sale)", href: "/search?sale=On+sale" },
];

// Default menu (Eneba-style top items + the old drawer lists). Stable ids so the demo and the server start the same.
type Seed = [id: string, label: string, href: string, extra?: Partial<MenuItem> & { children?: [string, string, string, Partial<MenuItem>?][] }];
const hw = "/hardware";
const SEED: Seed[] = [
  ["m-shop-all", "Shop All", "/search"],
  ["m-all-offers", "All offers", games(), { inBar: true }],
  ["m-on-sale", "On sale", games("sale=On+sale"), { inBar: true, inFooter: true }],
  ["m-random-steam", "Random Steam Keys", RANDOM_STEAM_HREF, { inBar: true }],
  ["m-trending", "Trending now", games("trending=1"), { inBar: true, isNew: true }],
  ["m-platforms", "Platforms", games(), { inBar: true, children: [
    ["m-pf-steam", "Steam", games("platform=Steam")], ["m-pf-xbox", "Xbox", games("platform=Xbox")], ["m-pf-playstation", "PlayStation", games("platform=PlayStation")],
    ["m-pf-nintendo", "Nintendo", games("platform=Nintendo")], ["m-pf-pc", "PC (Windows)", games("os=Windows")]] }],
  ["m-genres", "Genres", games(), { inBar: true, kind: "genres" }],
  ["m-digital-games", "Digital Games", games(), { inFooter: true, children: [
    ["m-dg-new", "New Releases", games("sort=newest")], ["m-dg-best", "Best Sellers", games()], ["m-dg-preorders", "Preorders", games("sort=newest")],
    ["m-dg-dlc", "DLC", games("type=DLC")], ["m-dg-software", "Software", games("type=Software")], ["m-dg-gift", "eGift Card", games("type=Gift+card")],
    ["m-dg-under", "Under ฿350", games("max=350"), { kind: "under" }], ["m-dg-publishers", "Publishers", games()]] }],
  ["m-pc-parts", "PC Parts", hw, { inBar: true, inFooter: true, children: ["Graphics Cards", "Processors", "Motherboards", "Memory", "Storage", "Power Supplies", "PC Cases", "Cooling", "Fans", "Accessories"]
    .map((l): [string, string, string] => [`m-pp-${l.toLowerCase().replace(/\s+/g, "-")}`, l, hw]) }],
  ["m-computers", "Computers", hw], ["m-gaming", "Gaming", hw, { inFooter: true }], ["m-monitors", "Monitors", hw], ["m-peripherals", "Peripherals", hw],
  ["m-storage", "Storage", hw], ["m-networking", "Networking", hw], ["m-pc-builder", "PC Builder", hw], ["m-brands", "Brands", hw],
  ["m-deals", "Deals", "/search?sale=On+sale", { inBar: true }], ["m-clearance", "Clearance", "/search?sale=On+sale"],
];
const base = (id: string, label: string, href: string, parent: string | null, position: number, extra?: Partial<MenuItem>): MenuItem =>
  ({ id, parent, label, href, kind: "link", position, hidden: false, isNew: false, inBar: false, inFooter: false, deleted: false, ...extra });
export const DEFAULT_MENU: MenuItem[] = SEED.flatMap(([id, label, href, extra], i) => {
  const { children, ...rest } = extra ?? {};
  return [base(id, label, href, null, i, rest), ...(children ?? []).map(([cid, cl, ch, ce], j) => base(cid, cl, ch, id, j, ce))];
});

// Storefront tree: visible items in admin order, one level of children.
export type MenuNode = MenuItem & { children: MenuItem[] };
const live = (items: MenuItem[]) => items.filter((i) => !i.deleted);
const byPos = (a: MenuItem, b: MenuItem) => a.position - b.position || a.label.localeCompare(b.label);
export function menuTree(items: MenuItem[], all = false): MenuNode[] {
  const list = live(items).filter((i) => all || !i.hidden);
  return list.filter((i) => !i.parent).sort(byPos).map((t) => ({ ...t, children: list.filter((c) => c.parent === t.id).sort(byPos) }));
}

// Checks (same text in demo + server).
const safeHref = (h: string) => h.length <= MENU_HREF_MAX && /^\/(?!\/)[^\s<>"'\\]*$/.test(h);
export function parseMenuInput(b: Record<string, unknown>, partial: boolean): Partial<MenuInput> | string {
  const out: Partial<MenuInput> = {};
  if (b.label !== undefined || !partial) { const l = typeof b.label === "string" ? b.label.trim().replace(/\s+/g, " ") : ""; if (!l || l.length > MENU_LABEL_MAX) return MENU_ERRORS.label; out.label = l; }
  if (b.kind !== undefined || !partial) { const k = b.kind ?? "link"; if (!MENU_KINDS.includes(k as MenuKind)) return "Invalid request"; out.kind = k as MenuKind; }
  if (b.href !== undefined || !partial) { const h = typeof b.href === "string" ? b.href.trim() : ""; if (!safeHref(h)) return MENU_ERRORS.href; out.href = h; }
  if (b.parent !== undefined || !partial) { if (b.parent !== null && b.parent !== "" && typeof b.parent !== "string") return "Invalid request"; out.parent = b.parent ? (b.parent as string) : null; }
  for (const k of ["isNew", "inBar", "inFooter"] as const) if (b[k] !== undefined || !partial) { if (b[k] !== undefined && typeof b[k] !== "boolean") return "Invalid request"; out[k] = b[k] === true; }
  return out;
}
export function parseMenuPatch(b: Record<string, unknown>): MenuPatch | string {
  const p = parseMenuInput(b, true); if (typeof p === "string") return p;
  const out: MenuPatch = { ...p };
  if (b.hidden !== undefined) { if (typeof b.hidden !== "boolean") return "Invalid request"; out.hidden = b.hidden; }
  if (b.move !== undefined) { if (b.move !== 1 && b.move !== -1) return "Invalid request"; out.move = b.move; }
  return out;
}

// Parent rules: only top-level items can hold sub-items; an item with sub-items stays top-level; Genres (automatic) stays top-level.
function checkPlace(items: MenuItem[], self: MenuItem): string | null {
  if (!self.parent) return null;
  const p = items.find((i) => i.id === self.parent && !i.deleted);
  if (!p || p.parent || p.id === self.id) return MENU_ERRORS.parent;
  if (p.kind === "genres") return MENU_ERRORS.parent;
  if (live(items).some((i) => i.parent === self.id)) return MENU_ERRORS.hasChildren;
  if (self.kind === "genres") return MENU_ERRORS.genresTop;
  return null;
}
const siblings = (items: MenuItem[], parent: string | null) => live(items).filter((i) => i.parent === parent).sort(byPos);
const renumber = (items: MenuItem[], parent: string | null) => { const order = siblings(items, parent); return items.map((i) => { const n = order.indexOf(i); return n < 0 ? i : { ...i, position: n }; }); };

export function addMenuItem(items: MenuItem[], input: MenuInput, id: string): MenuEdit {
  if (live(items).length >= MENU_MAX_ITEMS) return { ok: false, error: MENU_ERRORS.tooMany };
  const pos = siblings(items, input.parent).length;
  const item: MenuItem = { id, ...input, inBar: input.parent ? false : input.inBar, inFooter: input.parent ? false : input.inFooter, position: pos, hidden: false, deleted: false };
  const err = checkPlace(items, item); if (err) return { ok: false, error: err };
  return { ok: true, items: [...items, item] };
}

export function updateMenuItem(items: MenuItem[], id: string, patch: MenuPatch): MenuEdit {
  const old = items.find((i) => i.id === id && !i.deleted); if (!old) return { ok: false, error: MENU_ERRORS.notFound };
  const { move, ...rest } = patch;
  let next: MenuItem = { ...old, ...rest };
  if (next.parent) next = { ...next, inBar: false, inFooter: false };
  if (next.parent !== old.parent || next.kind !== old.kind) { const err = checkPlace(items, next); if (err) return { ok: false, error: err }; }
  let list = items.map((i) => (i.id === id ? next : i));
  if (next.parent !== old.parent) { // moved to another level: goes last there, both levels renumbered
    list = list.map((i) => (i.id === id ? { ...i, position: siblings(items, next.parent).length } : i));
    list = renumber(renumber(list, old.parent), next.parent);
  }
  if (move) {
    const order = siblings(list, next.parent); const at = order.findIndex((i) => i.id === id); const to = at + move;
    if (to >= 0 && to < order.length) { const swapped = [...order]; [swapped[at], swapped[to]] = [swapped[to], swapped[at]]; list = list.map((i) => { const n = swapped.indexOf(i); return n < 0 ? i : { ...i, position: n }; }); }
  }
  return { ok: true, items: list };
}

// Soft delete; its sub-items go with it.
export function deleteMenuItem(items: MenuItem[], id: string): MenuEdit {
  const old = items.find((i) => i.id === id && !i.deleted); if (!old) return { ok: false, error: MENU_ERRORS.notFound };
  const gone = new Set([id, ...items.filter((i) => i.parent === id).map((i) => i.id)]);
  return { ok: true, items: renumber(items.map((i) => (gone.has(i.id) ? { ...i, deleted: true, hidden: true } : i)), old.parent) };
}
