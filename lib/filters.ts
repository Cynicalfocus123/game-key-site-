// Admin filter manager (future task S4). Shared by the demo store, the server and the storefront (no server imports).
// Options keep the catalog value as their id (`value`, used in URLs like ?genre=FPS) and a display `label` the admin can rename.
// Until the catalog DB exists, catalog values are merged in as options; admin-added values have 0 products (shown in admin only).
import { allProducts, regionWorks, type Product } from "./catalog";
import { COUNTRY_CODES } from "./currency/currencies";
import { GROUPS, type GroupId } from "./listing";
import { countryName } from "./profile";

export type FilterGroupId = GroupId | "country" | "price";
export type FilterGroupInfo = { id: FilterGroupId; label: string; noun: string; canAdd: boolean; canDelete: boolean; hasOptions: boolean };
// Admin page order (approved wireframe).
export const FILTER_GROUPS: FilterGroupInfo[] = [
  { id: "genre", label: "Genres", noun: "genre", canAdd: true, canDelete: true, hasOptions: true },
  { id: "platform", label: "Platforms", noun: "platform", canAdd: true, canDelete: true, hasOptions: true },
  { id: "region", label: "Regions", noun: "region", canAdd: true, canDelete: true, hasOptions: true },
  { id: "type", label: "Product types", noun: "product type", canAdd: true, canDelete: true, hasOptions: true },
  { id: "os", label: "Operating systems", noun: "operating system", canAdd: true, canDelete: true, hasOptions: true },
  { id: "country", label: "Countries", noun: "country", canAdd: false, canDelete: false, hasOptions: true }, // fixed list (currency countries): hide / rename / order only
  { id: "sale", label: "Sale", noun: "sale option", canAdd: false, canDelete: false, hasOptions: true }, // one option "On sale" (user 2026-09-27)
  { id: "price", label: "Price range", noun: "", canAdd: false, canDelete: false, hasOptions: false }, // max stays typed by the shopper
];
export const groupInfo = (id: string) => FILTER_GROUPS.find((g) => g.id === id);
export const isFilterGroup = (id: unknown): id is FilterGroupId => typeof id === "string" && !!groupInfo(id);

export type FilterOption = { id: string; group: FilterGroupId; value: string; label: string; hidden: boolean; position: number; deleted: boolean };
export type FilterGroupCfg = { id: FilterGroupId; shown: boolean; startOpen: boolean };
export type FilterConfig = { groups: FilterGroupCfg[]; options: FilterOption[] };
export type OptionPatch = { label?: string; hidden?: boolean; move?: -1 | 1 };
export type GroupPatch = { shown?: boolean; startOpen?: boolean };
export const LABEL_MAX = 40;
export const ADMIN_WRITE_LIMIT = { max: 120, windowMs: 60_000 }; // per admin, all filter writes

// Catalog values per group, most used first (country: A–Z by name).
const keys = () => allProducts.filter((p) => p.kind === "game_key");
export function productCount(group: FilterGroupId, value: string, products: Product[] = allProducts) {
  if (group === "country") return products.filter((p) => p.kind === "game_key" && regionWorks(p, value) !== false).length;
  const g = GROUPS.find((x) => x.id === group);
  return g ? products.filter((p) => g.values(p).includes(value)).length : 0;
}
export function catalogOptions(group: FilterGroupId): { value: string; label: string }[] {
  if (group === "price") return [];
  if (group === "country") return COUNTRY_CODES.map((c) => ({ value: c, label: countryName(c) })).sort((a, b) => a.label.localeCompare(b.label));
  if (group === "sale") return [{ value: "On sale", label: "On sale" }];
  const g = GROUPS.find((x) => x.id === group)!;
  const counts = new Map<string, number>();
  for (const p of group === "type" ? allProducts : keys()) for (const v of new Set(g.values(p))) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value]) => ({ value, label: value }));
}

export const defaultGroup = (id: FilterGroupId): FilterGroupCfg => ({ id, shown: true, startOpen: true });
// Catalog values not stored yet are appended after the stored ones (keeps admin order; new catalog values go last).
export function mergeCatalog(cfg: FilterConfig, newId: () => string): FilterConfig {
  const groups = FILTER_GROUPS.map((g) => cfg.groups.find((x) => x.id === g.id) ?? defaultGroup(g.id));
  const options = [...cfg.options];
  for (const g of FILTER_GROUPS) {
    let pos = Math.max(-1, ...options.filter((o) => o.group === g.id).map((o) => o.position));
    for (const c of catalogOptions(g.id)) if (!options.some((o) => o.group === g.id && o.value === c.value)) options.push({ id: newId(), group: g.id, value: c.value, label: c.label, hidden: false, position: ++pos, deleted: false });
  }
  return { groups, options };
}

// Checks (same text in demo + server).
export const FILTER_ERRORS = {
  label: `Name must be 1–${LABEL_MAX} characters.`,
  taken: "That name is already in this group.",
  noAdd: "Values cannot be added to this group.",
  noDelete: "Values in this group cannot be deleted. Hide them instead.",
  notFound: "Filter value not found.",
  limit: "Too many changes. Wait a minute and try again.",
} as const;
export const cleanLabel = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
export function checkLabel(label: string, group: FilterGroupId, options: FilterOption[], exceptId?: string): string | null {
  if (!label || label.length > LABEL_MAX) return FILTER_ERRORS.label;
  const k = label.toLowerCase();
  if (options.some((o) => o.group === group && !o.deleted && o.id !== exceptId && (o.label.toLowerCase() === k || o.value.toLowerCase() === k))) return FILTER_ERRORS.taken;
  return null;
}
export function parseOptionPatch(b: Record<string, unknown>): OptionPatch {
  const p: OptionPatch = {};
  if (typeof b.label === "string") p.label = cleanLabel(b.label);
  if (typeof b.hidden === "boolean") p.hidden = b.hidden;
  if (b.move === 1 || b.move === -1) p.move = b.move;
  return p;
}
export function parseGroupPatch(b: Record<string, unknown>): GroupPatch {
  const p: GroupPatch = {};
  if (typeof b.shown === "boolean") p.shown = b.shown;
  if (typeof b.startOpen === "boolean") p.startOpen = b.startOpen;
  return p;
}

// Pure edits on a config (demo store). The server does the same steps in SQL.
type Edit = { ok: true; cfg: FilterConfig } | { ok: false; error: string };
export const liveOptions = (cfg: FilterConfig, group: FilterGroupId) => cfg.options.filter((o) => o.group === group && !o.deleted).sort((a, b) => a.position - b.position);
export function addOption(cfg: FilterConfig, group: FilterGroupId, rawLabel: string, newId: string): Edit {
  if (!groupInfo(group)?.canAdd) return { ok: false, error: FILTER_ERRORS.noAdd };
  const label = cleanLabel(rawLabel); const error = checkLabel(label, group, cfg.options);
  if (error) return { ok: false, error };
  const position = Math.max(-1, ...cfg.options.filter((o) => o.group === group).map((o) => o.position)) + 1;
  const old = cfg.options.find((o) => o.group === group && o.deleted && o.value.toLowerCase() === label.toLowerCase()); // deleted before → bring it back
  const options = old ? cfg.options.map((o) => (o === old ? { ...o, label, hidden: false, deleted: false, position } : o))
    : [...cfg.options, { id: newId, group, value: label, label, hidden: false, position, deleted: false }];
  return { ok: true, cfg: { ...cfg, options } };
}
export function updateOption(cfg: FilterConfig, id: string, patch: OptionPatch): Edit {
  const o = cfg.options.find((x) => x.id === id && !x.deleted);
  if (!o) return { ok: false, error: FILTER_ERRORS.notFound };
  let next = { ...o };
  if (patch.label !== undefined) { const error = checkLabel(patch.label, o.group, cfg.options, o.id); if (error) return { ok: false, error }; next.label = patch.label; }
  if (patch.hidden !== undefined) next.hidden = patch.hidden;
  let options = cfg.options.map((x) => (x.id === id ? next : x));
  if (patch.move) {
    const list = liveOptions({ ...cfg, options }, o.group); const i = list.findIndex((x) => x.id === id); const j = i + patch.move;
    if (j >= 0 && j < list.length) {
      const other = list[j]; const [pa, pb] = [next.position, other.position === next.position ? next.position + patch.move : other.position];
      next = { ...next, position: pb };
      options = options.map((x) => (x.id === id ? next : x.id === other.id ? { ...x, position: pa } : x));
    }
  }
  return { ok: true, cfg: { ...cfg, options } };
}
export function deleteOption(cfg: FilterConfig, id: string): Edit {
  const o = cfg.options.find((x) => x.id === id && !x.deleted);
  if (!o) return { ok: false, error: FILTER_ERRORS.notFound };
  if (!groupInfo(o.group)?.canDelete) return { ok: false, error: FILTER_ERRORS.noDelete };
  return { ok: true, cfg: { ...cfg, options: cfg.options.map((x) => (x.id === id ? { ...x, deleted: true, hidden: true } : x)) } };
}
export function updateGroup(cfg: FilterConfig, id: FilterGroupId, patch: GroupPatch): FilterConfig {
  return { ...cfg, groups: cfg.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) };
}

// Storefront view: hidden / deleted values leave the filters (a deleted value = products lose it), labels + order from admin.
export type FilterView = { group: (id: FilterGroupId) => FilterGroupCfg; shown: (g: FilterGroupId, value: string) => boolean; label: (g: FilterGroupId, value: string) => string; position: (g: FilterGroupId, value: string) => number | null };
export function filterView(cfg: FilterConfig | null): FilterView {
  const byKey = new Map((cfg?.options ?? []).map((o) => [`${o.group}\u0000${o.value}`, o]));
  const get = (g: FilterGroupId, v: string) => byKey.get(`${g}\u0000${v}`);
  return {
    group: (id) => cfg?.groups.find((g) => g.id === id) ?? defaultGroup(id),
    shown: (g, v) => { const o = get(g, v); return !o || (!o.hidden && !o.deleted); },
    label: (g, v) => get(g, v)?.label ?? (g === "country" ? countryName(v) : v),
    position: (g, v) => get(g, v)?.position ?? null,
  };
}
export const DEFAULT_VIEW = filterView(null);
