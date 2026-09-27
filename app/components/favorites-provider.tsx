"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { cleanFavorites, MAX_FAVORITES, productById } from "@/lib/catalog";
import { useAuth } from "./auth-provider";
import { HeartIcon } from "./icons";

// Favorites (♡). Guest: this browser's localStorage. Signed in: account list (server `favorite` table or demo store).
// On sign-in the guest list merges into the account list, then clears. Every tab stays live through `storage` events.
const GUEST_KEY = "corecart-favorites-v1";
const OLD_KEY = "corecart-saved"; // cart page "save for later" before favorites existed
const PING_KEY = "corecart-fav-ping";
const DEMO_KEY = "corecart-demo-v1";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const parse = (v: string | null) => { try { return cleanFavorites(JSON.parse(v || "[]")); } catch { return []; } };
const readGuest = () => cleanFavorites([...parse(read(GUEST_KEY)), ...parse(read(OLD_KEY))]);
const writeGuest = (ids: string[]) => { write(GUEST_KEY, ids.length ? JSON.stringify(ids) : null); write(OLD_KEY, null); };

type Ctx = { ids: string[]; ready: boolean; has: (id: string) => boolean; toggle: (id: string) => boolean; remove: (id: string) => void; message: string };
const FavoritesContext = createContext<Ctx | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]); const [ready, setReady] = useState(false);
  const [message, setMessage] = useState(""); const idsRef = useRef(ids); idsRef.current = ids;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const signedIn = Boolean(user);

  const load = useCallback(async () => {
    if (user === undefined) return;
    if (!user) { setIds(readGuest()); setReady(true); return; }
    const guest = readGuest();
    const r = guest.length ? await api.mergeFavorites(guest) : await api.favorites();
    if (r.ok) { if (guest.length) { writeGuest([]); write(PING_KEY, String(Date.now())); } setIds(r.ids); }
    setReady(true);
  }, [user]);
  useEffect(() => { load(); }, [load, user?.id]);
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === GUEST_KEY || e.key === PING_KEY || e.key === DEMO_KEY) load(); };
    window.addEventListener("storage", on); return () => window.removeEventListener("storage", on);
  }, [load]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const say = (text: string) => { setMessage(text); clearTimeout(timer.current); timer.current = setTimeout(() => setMessage(""), 2500); };
  const set = useCallback((id: string, on: boolean) => {
    const cur = idsRef.current;
    const next = on ? (cur.includes(id) || cur.length >= MAX_FAVORITES ? cur : [id, ...cur]) : cur.filter((x) => x !== id);
    idsRef.current = next; setIds(next);
    say(on ? "Saved to favorites" : "Removed from favorites");
    if (!signedIn) { writeGuest(next); return; }
    (on ? api.addFavorite(id) : api.removeFavorite(id)).then((r) => { if (r.ok) { setIds(r.ids); write(PING_KEY, String(Date.now())); } });
  }, [signedIn]);
  const toggle = useCallback((id: string) => { if (!productById(id)) return false; const on = !idsRef.current.includes(id); set(id, on); return on; }, [set]);

  const value = useMemo<Ctx>(() => ({ ids, ready, has: (id) => ids.includes(id), toggle, remove: (id) => set(id, false), message }), [ids, ready, toggle, set, message]);
  return <FavoritesContext.Provider value={value}>{children}
    <div className={`fav-toast${message ? " show" : ""}`} role="status" aria-live="polite">{message && <><span aria-hidden="true">♥</span> {message}</>}</div>
  </FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites needs FavoritesProvider");
  return ctx;
}

// ♡ button. "title" = square outlined 44px next to the product title; "card" = small corner button on product cards; "row" = cart / list rows.
export function FavoriteButton({ productId, name, variant = "row" }: { productId: string; name: string; variant?: "title" | "card" | "row" }) {
  const { has, toggle } = useFavorites(); const on = has(productId);
  return <button type="button" className={`fav-btn fav-v-${variant}${on ? " is-on" : ""}`} aria-pressed={on} aria-label={on ? `Remove ${name} from favorites` : `Save ${name} to favorites`} title={on ? "Saved to favorites" : "Save to favorites"} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(productId); }}>
    <HeartIcon filled={on} />{variant === "title" && <span className="sr-only">{on ? "Saved" : "Save"}</span>}
  </button>;
}
