"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { cartCount, cartSubtotal, cleanCart, maxQty, productById, subscribeCatalog, type CartEntry } from "@/lib/catalog";
import { catalogReady } from "@/lib/client/catalog";
import { cleanPromoCode, livePromo, promoDiscount, scopeLabel, type PromoResult, type PublicPromo } from "@/lib/promo";
import { useAuth } from "./auth-provider";

// Guest cart: this browser's localStorage, exact items (id, title, platform, region, qty, THB price) so it survives reload + browser restart.
// Signed in: account cart (server `cart_item` table, or demo store). On sign-in the guest cart merges into the account cart, then clears.
const GUEST_KEY = "corecart-cart-v1";
const COUPON_KEY = "corecart-coupon";
const GONE_KEY = "corecart-coupon-gone"; // code a re-check removed, so every open tab shows the same note
const PING_KEY = "corecart-cart-ping"; // tells other tabs to reload the account cart
const DEMO_KEY = "corecart-demo-v1";
type GuestLine = CartEntry & { title: string; platform: string | null; region: string | null; thb: number };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const readGuest = () => { try { return cleanCart(JSON.parse(read(GUEST_KEY) || "[]")); } catch { return []; } };
const writeGuest = (items: CartEntry[]) => write(GUEST_KEY, items.length ? JSON.stringify(items.map((e): GuestLine => {
  const p = productById(e.productId)!; return { productId: p.id, qty: e.qty, title: p.name, platform: p.platform ?? null, region: p.region ?? null, thb: p.price };
})) : null);

// Totals with the applied promo code. The discount only counts eligible lines; issue = code applied but nothing to discount yet.
export type CartCoupon = { code: string; promo: PublicPromo; scope: string | null; issue: PromoResult["issue"] };
export function cartTotals(entries: CartEntry[], promo: PublicPromo | null) {
  const subtotal = cartSubtotal(entries); const r = promo ? promoDiscount(promo, entries) : null; const discount = r?.discount ?? 0;
  const coupon: CartCoupon | null = promo && r ? { code: promo.code, promo, scope: promo.appliesTo === "all" ? null : scopeLabel(promo), issue: r.issue } : null;
  return { count: cartCount(entries), subtotal, discount, total: subtotal - discount, coupon };
}
export type ApplyResult = { ok: true } | { ok: false; error: string; minOrder?: number };
export type GateView = "choice" | "register" | "signin" | "check-email";
export type AddResult = "added" | "limit";
export type PopupKind = "added" | "cart"; // "added" after Add to cart, "cart" when reopened from the cart icon
type Ctx = {
  items: CartEntry[]; ready: boolean; totals: ReturnType<typeof cartTotals>;
  add: (productId: string) => AddResult; setQty: (productId: string, qty: number) => void; remove: (productId: string) => void; clear: () => void;
  coupon: string | null; applyCoupon: (code: string) => Promise<ApplyResult>; removeCoupon: () => void;
  couponNote: string | null; // amber "Code X is no longer valid." after a re-check removed it
  saveNote: string | null; // R4: a signed-in cart save failed; the cart now shows what the server has
  popup: PopupKind | null; openPopup: (kind?: PopupKind) => void; closePopup: () => void;
  gate: { view: GateView; next: string | null } | null; openGate: (view: GateView, next?: string | null) => void; closeGate: () => void;
  checkout: () => void;
};
const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); const router = useRouter();
  const [items, setItems] = useState<CartEntry[]>([]); const [ready, setReady] = useState(false);
  const [coupon, setCoupon] = useState<string | null>(null); const [promo, setPromo] = useState<PublicPromo | null>(null);
  const [couponNote, setCouponNote] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  // R4: signed-in saves go out ONE AT A TIME per product; clicks made meanwhile only change `want`, and the loop sends the newest
  // value next, so the last click is what the server keeps. Server replies are shown only when no save is still waiting.
  const saving = useRef(new Map<string, { want: number; busy: boolean }>());
  const [popup, setPopup] = useState<PopupKind | null>(null);
  const [gate, setGate] = useState<Ctx["gate"]>(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const signedIn = Boolean(user);

  const load = useCallback(async () => {
    if (user === undefined) return;
    await catalogReady(); // admin-added products must be known before the guest cart is cleaned
    if (!user) { setItems(readGuest()); setReady(true); return; }
    const guest = readGuest();
    const r = guest.length ? await api.mergeCart(guest) : await api.cart();
    if (r.ok) { if (guest.length) { writeGuest([]); write(PING_KEY, String(Date.now())); } setItems(r.items); }
    setReady(true);
  }, [user]);
  useEffect(() => { load(); }, [load, user?.id]);
  // Catalog changed (admin removed / unpublished a product or lowered stock): drop or cap those lines on screen.
  useEffect(() => subscribeCatalog(() => setItems((cur) => { const next = cleanCart(cur); return JSON.stringify(next) === JSON.stringify(cur) ? cur : next; })), []);
  // Applied code: re-checked with the server on load, tab focus, other-tab changes and cart changes. Expired / disabled / deleted → removed + amber note.
  const recheck = useCallback(async (code: string | null) => {
    if (!code) { setPromo(null); return; }
    const r = await api.validatePromo(code);
    if (read(COUPON_KEY) !== code) return; // changed meanwhile
    if (r.ok) { setPromo(r.promo); return; }
    if (r.gone) { write(GONE_KEY, code); write(COUPON_KEY, null); setCoupon(null); setPromo(null); setCouponNote(`Code ${code} is no longer valid.`); }
  }, []);
  useEffect(() => { const c = read(COUPON_KEY); setCoupon(c); recheck(c); }, [recheck]);
  useEffect(() => {
    const again = () => { if (document.visibilityState !== "hidden") recheck(read(COUPON_KEY)); };
    window.addEventListener("focus", again); document.addEventListener("visibilitychange", again);
    return () => { window.removeEventListener("focus", again); document.removeEventListener("visibilitychange", again); };
  }, [recheck]);
  // Cart changes: debounced re-check (the discount itself is recalculated locally right away).
  const itemsKey = items.map((e) => `${e.productId}:${e.qty}`).join(",");
  useEffect(() => { if (!coupon) return; const t = setTimeout(() => recheck(coupon), 400); return () => clearTimeout(t); }, [itemsKey, coupon, recheck]);
  // Expiry passes while the page is open: drop it without waiting for the next check.
  useEffect(() => {
    if (!promo?.expiresAt) return;
    const ms = Date.parse(promo.expiresAt) - Date.now(); if (ms > 2 ** 31 - 1) return;
    const t = setTimeout(() => recheck(promo.code), Math.max(ms, 0) + 50); return () => clearTimeout(t);
  }, [promo, recheck]);
  // Live count in every tab.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === GUEST_KEY || e.key === PING_KEY || e.key === DEMO_KEY) load();
      if (e.key === COUPON_KEY) { setCoupon(e.newValue); setCouponNote(!e.newValue && e.oldValue && read(GONE_KEY) === e.oldValue ? `Code ${e.oldValue} is no longer valid.` : null); recheck(e.newValue); }
      if (e.key === DEMO_KEY) recheck(read(COUPON_KEY)); // demo admin changed codes in another tab
    };
    window.addEventListener("storage", on); return () => window.removeEventListener("storage", on);
  }, [load, recheck]);

  const setQty = useCallback((productId: string, qty: number) => {
    const p = productById(productId); if (!p) return;
    const q = Math.min(Math.max(Math.floor(qty), 0), maxQty(p)); const cur = itemsRef.current;
    const next = q === 0 ? cur.filter((e) => e.productId !== productId) : cur.some((e) => e.productId === productId) ? cur.map((e) => (e.productId === productId ? { ...e, qty: q } : e)) : [{ productId, qty: q }, ...cur];
    itemsRef.current = next; setItems(next);
    if (!signedIn) { writeGuest(next); return; }
    const job = saving.current.get(productId);
    if (job) { job.want = q; if (job.busy) return; }
    const me = job ?? { want: q, busy: false }; saving.current.set(productId, me);
    (async () => {
      me.busy = true;
      try {
        for (;;) {
          const sent = me.want;
          const r = await api.setCartItem(productId, sent).catch(() => ({ ok: false as const, error: "Network error" })); // thrown = failed
          if (!r.ok) { // failed: stop, show the server's cart + a note (nothing half-saved stays on screen)
            saving.current.delete(productId);
            const back = await api.cart().catch(() => ({ ok: false as const, error: "" })); if (back.ok && ![...saving.current.values()].some((j) => j.busy)) { itemsRef.current = back.items; setItems(back.items); }
            setSaveNote("We couldn't save your last cart change. The cart shows what is saved; try again."); return;
          }
          if (me.want !== sent) continue; // clicked again while this one was on its way: send the newest value
          saving.current.delete(productId); setSaveNote(null);
          if (![...saving.current.values()].some((j) => j.busy)) { itemsRef.current = r.items; setItems(r.items); }
          write(PING_KEY, String(Date.now())); return;
        }
      } finally { me.busy = false; }
    })();
  }, [signedIn]);
  const add = useCallback((productId: string): AddResult => {
    const p = productById(productId); const have = itemsRef.current.find((e) => e.productId === productId)?.qty ?? 0;
    if (!p || have >= maxQty(p)) return "limit";
    setQty(productId, have + 1); setPopup("added"); return "added";
  }, [setQty]);
  const clear = useCallback(() => {
    setItems([]); itemsRef.current = [];
    if (!signedIn) writeGuest([]); else api.clearCart().then(() => write(PING_KEY, String(Date.now())));
  }, [signedIn]);
  const applyCoupon = useCallback(async (input: string): Promise<ApplyResult> => {
    const code = cleanPromoCode(input); if (!code) return { ok: false, error: "Enter a code." };
    const r = await api.validatePromo(code);
    if (!r.ok) return { ok: false, error: r.error };
    if (r.promo.minSubtotal && cartSubtotal(itemsRef.current) < r.promo.minSubtotal) return { ok: false, error: "Minimum order", minOrder: r.promo.minSubtotal };
    setCouponNote(null); setCoupon(r.promo.code); setPromo(r.promo); write(GONE_KEY, null); write(COUPON_KEY, r.promo.code); return { ok: true };
  }, []);
  const removeCoupon = useCallback(() => { setCoupon(null); setPromo(null); setCouponNote(null); write(GONE_KEY, null); write(COUPON_KEY, null); }, []);
  const activePromo = promo && coupon === promo.code && livePromo(promo) ? promo : null;
  const openGate = useCallback((view: GateView, next: string | null = null) => { setPopup(null); setGate({ view, next }); }, []);
  const checkout = useCallback(() => {
    setPopup(null);
    if (user?.emailVerified) router.push("/checkout"); else setGate({ view: "choice", next: "/checkout" });
  }, [user, router]);

  const value = useMemo<Ctx>(() => ({
    items, ready, totals: cartTotals(items, activePromo), add, setQty, remove: (id) => setQty(id, 0), clear,
    coupon, applyCoupon, removeCoupon, couponNote, saveNote, popup, openPopup: (kind = "cart") => setPopup(kind), closePopup: () => setPopup(null),
    gate, openGate, closeGate: () => setGate(null), checkout,
  }), [items, ready, coupon, activePromo, couponNote, saveNote, add, setQty, clear, applyCoupon, removeCoupon, popup, gate, openGate, checkout]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart needs CartProvider");
  return ctx;
}
