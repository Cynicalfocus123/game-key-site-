"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, publicMarketApi } from "@/lib/client/api";
import { cartCount, cartSubtotal, cleanCart, lineKey, lineMax, maxQty, productById, subscribeCatalog, type CartEntry } from "@/lib/catalog";
import type { PublicOffer } from "@/lib/marketplace";
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
type GuestLine = CartEntry & { title: string; platform: string | null; region: string | null; thb: number }; // seller lines also keep offerId / unit / max / seller
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const readGuest = () => { try { return cleanCart(JSON.parse(read(GUEST_KEY) || "[]")); } catch { return []; } };
const writeGuest = (items: CartEntry[]) => write(GUEST_KEY, items.length ? JSON.stringify(items.map((e): GuestLine => {
  const p = productById(e.productId)!; return { ...e, productId: p.id, qty: e.qty, title: p.name, platform: p.platform ?? null, region: p.region ?? null, thb: p.price };
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
  // key = lineKey(entry): the product id for CoreCart's own stock, "product@offer" for a seller offer line (marketplace step 4).
  add: (productId: string) => AddResult; addOffer: (offer: PublicOffer) => AddResult; setQty: (key: string, qty: number) => void; remove: (key: string) => void; clear: () => void;
  offerNote: string | null; // a seller offer in the cart was paused / sold out / its price changed
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

  // Seller offer lines: today's price + keys left from the live offer; a gone offer drops out. note = what changed (shown on the cart).
  const quoteGuest = useCallback(async (list: CartEntry[]) => {
    const ids = list.flatMap((e) => (e.offerId ? [e.offerId] : [])); if (!ids.length) return list;
    const r = await publicMarketApi.quotes(ids); if (!r.ok) return list; // offline: keep what the browser has, the account / checkout checks again
    const q = new Map(r.quotes.map((x) => [x.offerId, x]));
    return cleanCart(list.flatMap((e) => { if (!e.offerId) return [e]; const x = q.get(e.offerId); return x && x.productId === e.productId ? [{ ...e, unit: x.unit, max: x.max, seller: x.seller }] : []; }));
  }, []);
  const [offerNote, setOfferNote] = useState<string | null>(null);
  const noteChanges = useCallback((before: CartEntry[], after: CartEntry[]) => {
    const was = before.filter((e) => e.offerId); if (!was.length) return;
    const now = new Map(after.map((e) => [lineKey(e), e]));
    const gone = was.filter((e) => !now.has(lineKey(e))); const moved = was.filter((e) => { const n = now.get(lineKey(e)); return n && (n.unit !== e.unit || n.qty < e.qty); });
    if (gone.length) setOfferNote(`${gone.length === 1 ? "A seller offer" : `${gone.length} seller offers`} in your cart ${gone.length === 1 ? "is" : "are"} no longer available and ${gone.length === 1 ? "was" : "were"} removed.`);
    else if (moved.length) setOfferNote("A seller changed the price or stock of an offer in your cart. Check the cart before you pay.");
  }, []);
  const load = useCallback(async () => {
    if (user === undefined) return;
    await catalogReady(); // admin-added products must be known before the guest cart is cleaned
    if (!user) { const g = readGuest(); const fresh = await quoteGuest(g); noteChanges(g, fresh); if (JSON.stringify(fresh) !== JSON.stringify(g)) writeGuest(fresh); itemsRef.current = fresh; setItems(fresh); setReady(true); return; }
    const guest = readGuest();
    const r = guest.length ? await api.mergeCart(guest) : await api.cart();
    if (r.ok) { if (guest.length) { writeGuest([]); write(PING_KEY, String(Date.now())); } noteChanges([...itemsRef.current, ...guest], r.items); itemsRef.current = r.items; setItems(r.items); }
    setReady(true);
  }, [user, quoteGuest, noteChanges]);
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
  const itemsKey = items.map((e) => `${lineKey(e)}:${e.qty}`).join(",");
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

  // line = the entry to write (a new seller offer line carries its price + seller), key = lineKey(line).
  const writeLine = useCallback((line: CartEntry, qty: number) => {
    const p = productById(line.productId); if (!p) return;
    const key = lineKey(line); const q = Math.min(Math.max(Math.floor(qty), 0), line.offerId ? lineMax(line) : maxQty(p)); const cur = itemsRef.current;
    const next = q === 0 ? cur.filter((e) => lineKey(e) !== key) : cur.some((e) => lineKey(e) === key) ? cur.map((e) => (lineKey(e) === key ? { ...e, qty: q } : e)) : [{ ...line, qty: q }, ...cur];
    itemsRef.current = next; setItems(next);
    if (!signedIn) { writeGuest(next); return; }
    const job = saving.current.get(key);
    if (job) { job.want = q; if (job.busy) return; }
    const me = job ?? { want: q, busy: false }; saving.current.set(key, me);
    (async () => {
      me.busy = true;
      try {
        for (;;) {
          const sent = me.want;
          const r = await api.setCartItem(line.productId, sent, line.offerId).catch(() => ({ ok: false as const, error: "Network error" })); // thrown = failed
          if (!r.ok) { // failed: stop, show the server's cart + a note (nothing half-saved stays on screen)
            saving.current.delete(key);
            const back = await api.cart().catch(() => ({ ok: false as const, error: "" })); if (back.ok && ![...saving.current.values()].some((j) => j.busy)) { itemsRef.current = back.items; setItems(back.items); }
            if (line.offerId && r.error === "This offer is no longer available.") setOfferNote("This seller offer is no longer available. It was not added."); // paused / sold out meanwhile
            else setSaveNote("We couldn't save your last cart change. The cart shows what is saved; try again.");
            return;
          }
          if (me.want !== sent) continue; // clicked again while this one was on its way: send the newest value
          saving.current.delete(key); setSaveNote(null);
          if (![...saving.current.values()].some((j) => j.busy)) { itemsRef.current = r.items; setItems(r.items); }
          write(PING_KEY, String(Date.now())); return;
        }
      } finally { me.busy = false; }
    })();
  }, [signedIn]);
  const setQty = useCallback((key: string, qty: number) => { const e = itemsRef.current.find((x) => lineKey(x) === key) ?? (productById(key) ? { productId: key, qty: 0 } : null); if (e) writeLine(e, qty); }, [writeLine]);
  const add = useCallback((productId: string): AddResult => {
    const p = productById(productId); const have = itemsRef.current.find((e) => e.productId === productId && !e.offerId)?.qty ?? 0;
    if (!p || have >= maxQty(p)) return "limit";
    writeLine({ productId, qty: 0 }, have + 1); setPopup("added"); return "added";
  }, [writeLine]);
  // Seller offer (product page "Buy now", marketplace step 4): one more key of that offer, no popup (the page goes to the cart).
  const addOffer = useCallback((o: PublicOffer): AddResult => {
    if (o.seller.own) return add(o.productId) === "added" ? (setPopup(null), "added") : "limit";
    const line: CartEntry = { productId: o.productId, qty: 0, offerId: o.id, unit: o.unit, max: o.max, seller: { slug: o.seller.slug, name: o.seller.name } };
    const have = itemsRef.current.find((e) => lineKey(e) === lineKey(line))?.qty ?? 0;
    if (have >= lineMax(line)) return "limit";
    setOfferNote(null); writeLine(line, have + 1); return "added";
  }, [add, writeLine]);
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
    items, ready, totals: cartTotals(items, activePromo), add, addOffer, setQty, remove: (key) => setQty(key, 0), clear, offerNote,
    coupon, applyCoupon, removeCoupon, couponNote, saveNote, popup, openPopup: (kind = "cart") => setPopup(kind), closePopup: () => setPopup(null),
    gate, openGate, closeGate: () => setGate(null), checkout,
  }), [items, ready, coupon, activePromo, couponNote, saveNote, add, addOffer, offerNote, setQty, clear, applyCoupon, removeCoupon, popup, gate, openGate, checkout]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart needs CartProvider");
  return ctx;
}
