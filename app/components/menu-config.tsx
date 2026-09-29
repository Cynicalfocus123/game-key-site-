"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { DEFAULT_MENU, type MenuItem } from "@/lib/menu";

// Store menu (task D) for the header bar, drawer and footer: loaded once per page load and shared.
// Until it arrives (or when it fails) the default menu shows, so nothing waits on it.
let cache: MenuItem[] | null = null; let pending: Promise<void> | null = null;
const subs = new Set<(m: MenuItem[]) => void>();
function load() {
  pending ??= api.menu().then((m) => { if (m) { cache = m; subs.forEach((f) => f(m)); } }).catch(() => { /* default menu */ });
  return pending;
}
// Admin page calls this after a save so the header on screen shows the change.
export function reloadMenu() { pending = null; return load(); }

export function useMenu(): MenuItem[] {
  const [items, setItems] = useState<MenuItem[]>(cache ?? DEFAULT_MENU);
  useEffect(() => { subs.add(setItems); if (cache) setItems(cache); load(); return () => { subs.delete(setItems); }; }, []);
  return items;
}
