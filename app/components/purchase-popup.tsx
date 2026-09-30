"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { productById, type Product } from "@/lib/catalog";
import { api } from "@/lib/client/api";
import { catalogReady } from "@/lib/client/catalog";
import { countryName } from "@/lib/profile";
import { popupAllowedOn, POPUP_TIMING, timeAgo, type RecentPurchase } from "@/lib/purchase-popup";
import { assetPath } from "./cart-ui";

// "Someone just purchased" (wireframe approved 2026-09-30). Bottom-left card on desktop, one-line bar on phones (above the product page's
// sticky buy bar). One at a time, ~6 s each (hover / focus pauses), ~8 s gap, each purchase once per visitor, × hides it for this visit.
// Not on cart / checkout / payment / account / admin / sign-in pages. The feed only carries product, time and the buyer's account country.
const SEEN = "corecart-popup-seen"; const CLOSED = "corecart-popup-closed";
const readSeen = (): string[] => { try { const v = JSON.parse(localStorage.getItem(SEEN) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const addSeen = (id: string) => { try { localStorage.setItem(SEEN, JSON.stringify([...readSeen().filter((x) => x !== id), id].slice(-200))); } catch { /* storage blocked */ } };
const isClosed = () => { try { return sessionStorage.getItem(CLOSED) === "1"; } catch { return false; } };

type Shown = { p: RecentPurchase; product: Product };

export function PurchasePopup() {
  const path = usePathname() ?? "/";
  const allowed = popupAllowedOn(path);
  const [shown, setShown] = useState<Shown | null>(null); const [open, setOpen] = useState(false); const [closed, setClosed] = useState(true);
  const [bottom, setBottom] = useState<number | null>(null);
  const queue = useRef<RecentPurchase[]>([]); const busy = useRef(false); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setClosed(isClosed()); }, []);

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  // Show the next unseen purchase whose product is in the live catalog.
  const next = useCallback(async () => {
    if (busy.current || isClosed()) return;
    await catalogReady();
    const seen = new Set(readSeen());
    while (queue.current.length) {
      const p = queue.current.shift()!; if (seen.has(p.id)) continue;
      const product = productById(p.productId); if (!product) continue;
      busy.current = true; addSeen(p.id); setShown({ p, product }); setOpen(true);
      clear(); timer.current = setTimeout(hide, POPUP_TIMING.showMs);
      return;
    }
  }, []); // hide / setters only touch refs + state setters, so one stable callback is enough
  function hide() {
    clear(); setOpen(false);
    timer.current = setTimeout(() => { busy.current = false; setShown(null); next(); }, POPUP_TIMING.gapMs);
  }

  // Poll the feed while the tab is visible; new purchases join the queue (newest first).
  useEffect(() => {
    if (!allowed || closed) return;
    let stop = false;
    const load = async () => {
      if (stop || document.visibilityState !== "visible") return;
      const feed = await api.recentPurchases().catch(() => null); if (stop || !feed?.enabled) return;
      const seen = new Set(readSeen()); const queued = new Set(queue.current.map((x) => x.id));
      queue.current.push(...feed.purchases.filter((x) => !seen.has(x.id) && !queued.has(x.id)));
      next();
    };
    const first = setTimeout(load, POPUP_TIMING.firstMs); const poll = setInterval(load, POPUP_TIMING.pollMs);
    return () => { stop = true; clearTimeout(first); clearInterval(poll); };
  }, [allowed, closed, next]);

  // Leaving for a page without the popup hides it at once.
  useEffect(() => { if (!allowed) { clear(); busy.current = false; setOpen(false); setShown(null); } }, [allowed]);
  useEffect(() => () => clear(), []);

  // Phones: sit 12 px above a sticky bottom bar (product page buy bar) when one is on screen.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const bar = [...document.querySelectorAll<HTMLElement>(".pdp-sticky, .cart-sticky")].find((el) => getComputedStyle(el).display !== "none" && getComputedStyle(el).position === "fixed");
      setBottom(bar ? bar.getBoundingClientRect().height + 12 : null);
    };
    place(); window.addEventListener("resize", place); return () => window.removeEventListener("resize", place);
  }, [open, path]);

  // Favorites toast moves above the popup on phones while it shows (CSS reads --cc-popup-top). offsetTop = final place, not the slide-in.
  useEffect(() => {
    const root = document.documentElement;
    if (open && box.current) root.style.setProperty("--cc-popup-top", `${window.innerHeight - box.current.offsetTop}px`); else root.style.removeProperty("--cc-popup-top");
    root.toggleAttribute("data-cc-popup", open);
    return () => { root.style.removeProperty("--cc-popup-top"); root.removeAttribute("data-cc-popup"); };
  }, [open, bottom]);

  if (!allowed || closed || !shown) return null;
  const { p, product } = shown; const where = p.country ? ` (${countryName(p.country)})` : ""; const when = `${timeAgo(p.at)}${where}`;
  const close = () => { try { sessionStorage.setItem(CLOSED, "1"); } catch { /* storage blocked */ } clear(); setOpen(false); setClosed(true); };
  const pause = () => clear(); const resume = () => { if (open) { clear(); timer.current = setTimeout(hide, POPUP_TIMING.showMs); } };
  return <div ref={box} className={`pp-pop${open ? " show" : ""}`} role="status" aria-live="polite" style={bottom !== null ? { bottom } : undefined}
    onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume} aria-hidden={!open} data-testid="purchase-popup">
    <img src={assetPath(product.image)} alt="" width={56} height={70} />
    <div className="pp-text">
      <span className="pp-lbl">Someone just purchased<span className="pp-inline"> · {when}</span></span>
      <Link href={`/product?id=${encodeURIComponent(product.id)}`} tabIndex={open ? 0 : -1}>{product.name}</Link>
      <span className="pp-when">{when}</span>
    </div>
    <button type="button" className="pp-x" aria-label="Close purchase popup" tabIndex={open ? 0 : -1} onClick={close}>×</button>
  </div>;
}
