"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { cartTotals, cleanCart, findCoupon, maxQty, productById, type CartEntry } from "@/lib/catalog";
import { useAuth } from "./auth-provider";

// Guest cart: this browser's localStorage, exact items (id, title, platform, region, qty, THB price) so it survives reload + browser restart.
// Signed in: account cart (server `cart_item` table, or demo store). On sign-in the guest cart merges into the account cart, then clears.
const GUEST_KEY = "corecart-cart-v1";
const COUPON_KEY = "corecart-coupon";
const PING_KEY = "corecart-cart-ping"; // tells other tabs to reload the account cart
const DEMO_KEY = "corecart-demo-v1";
type GuestLine = CartEntry & { title: string; platform: string | null; region: string | null; thb: number };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const readGuest = () => { try { return cleanCart(JSON.parse(read(GUEST_KEY) || "[]")); } catch { return []; } };
const writeGuest = (items: CartEntry[]) => write(GUEST_KEY, items.length ? JSON.stringify(items.map((e): GuestLine => {
  const p = productById(e.productId)!; return { productId: p.id, qty: e.qty, title: p.name, platform: p.platform ?? null, region: p.region ?? null, thb: p.price };
})) : null);

export type GateView = "choice" | "register" | "signin" | "check-email";
export type AddResult = "added" | "limit";
export type PopupKind = "added" | "cart"; // "added" after Add to cart, "cart" when reopened from the cart icon
type Ctx = {
  items: CartEntry[]; ready: boolean; totals: ReturnType<typeof cartTotals>;
  add: (productId: string) => AddResult; setQty: (productId: string, qty: number) => void; remove: (productId: string) => void; clear: () => void;
  coupon: string | null; applyCoupon: (code: string) => boolean; removeCoupon: () => void;
  popup: PopupKind | null; openPopup: (kind?: PopupKind) => void; closePopup: () => void;
  gate: { view: GateView; next: string | null } | null; openGate: (view: GateView, next?: string | null) => void; closeGate: () => void;
  checkout: () => void;
};
const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); const router = useRouter();
  const [items, setItems] = useState<CartEntry[]>([]); const [ready, setReady] = useState(false);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupKind | null>(null);
  const [gate, setGate] = useState<Ctx["gate"]>(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const signedIn = Boolean(user);

  const load = useCallback(async () => {
    if (user === undefined) return;
    if (!user) { setItems(readGuest()); setReady(true); return; }
    const guest = readGuest();
    const r = guest.length ? await api.mergeCart(guest) : await api.cart();
    if (r.ok) { if (guest.length) { writeGuest([]); write(PING_KEY, String(Date.now())); } setItems(r.items); }
    setReady(true);
  }, [user]);
  useEffect(() => { load(); }, [load, user?.id]);
  useEffect(() => { setCoupon(findCoupon(read(COUPON_KEY))?.code ?? null); }, []);
  // Live count in every tab.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === GUEST_KEY || e.key === PING_KEY || e.key === DEMO_KEY) load();
      if (e.key === COUPON_KEY) setCoupon(findCoupon(e.newValue)?.code ?? null);
    };
    window.addEventListener("storage", on); return () => window.removeEventListener("storage", on);
  }, [load]);

  const setQty = useCallback((productId: string, qty: number) => {
    const p = productById(productId); if (!p) return;
    const q = Math.min(Math.max(Math.floor(qty), 0), maxQty(p)); const cur = itemsRef.current;
    const next = q === 0 ? cur.filter((e) => e.productId !== productId) : cur.some((e) => e.productId === productId) ? cur.map((e) => (e.productId === productId ? { ...e, qty: q } : e)) : [{ productId, qty: q }, ...cur];
    itemsRef.current = next; setItems(next);
    if (!signedIn) { writeGuest(next); return; }
    api.setCartItem(productId, q).then((r) => { if (r.ok) { setItems(r.items); write(PING_KEY, String(Date.now())); } });
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
  const applyCoupon = useCallback((code: string) => { const c = findCoupon(code); if (!c) return false; setCoupon(c.code); write(COUPON_KEY, c.code); return true; }, []);
  const removeCoupon = useCallback(() => { setCoupon(null); write(COUPON_KEY, null); }, []);
  const openGate = useCallback((view: GateView, next: string | null = null) => { setPopup(null); setGate({ view, next }); }, []);
  const checkout = useCallback(() => {
    setPopup(null);
    if (user?.emailVerified) router.push("/checkout"); else setGate({ view: "choice", next: "/checkout" });
  }, [user, router]);

  const value = useMemo<Ctx>(() => ({
    items, ready, totals: cartTotals(items, coupon), add, setQty, remove: (id) => setQty(id, 0), clear,
    coupon, applyCoupon, removeCoupon, popup, openPopup: (kind = "cart") => setPopup(kind), closePopup: () => setPopup(null),
    gate, openGate, closeGate: () => setGate(null), checkout,
  }), [items, ready, coupon, add, setQty, clear, applyCoupon, removeCoupon, popup, gate, openGate, checkout]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart needs CartProvider");
  return ctx;
}
