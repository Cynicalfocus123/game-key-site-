"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { DEFAULT_VIEW, filterView, type FilterConfig, type FilterView } from "@/lib/filters";

// Admin filter config (future task S4) for the storefront: loaded once per page load, shared by every card + listing.
// Until it arrives (or when it fails) the catalog defaults apply, so nothing waits on it.
let cache: FilterConfig | null = null; let pending: Promise<void> | null = null;
const subs = new Set<(c: FilterConfig | null) => void>();
function load() {
  pending ??= api.filters().then((c) => { cache = c; subs.forEach((f) => f(c)); }).catch(() => { /* defaults */ });
  return pending;
}
// Admin page calls this after a save so the storefront parts on screen use the new labels.
export function reloadFilterConfig() { pending = null; return load(); }

export function useFilterConfig() {
  const [cfg, setCfg] = useState<FilterConfig | null>(cache);
  useEffect(() => { subs.add(setCfg); load(); return () => { subs.delete(setCfg); }; }, []);
  return cfg;
}
export function useFilterView(): FilterView {
  const cfg = useFilterConfig();
  return useMemo(() => (cfg ? filterView(cfg) : DEFAULT_VIEW), [cfg]);
}
