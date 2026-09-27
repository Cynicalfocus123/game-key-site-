"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import { CurrencyDrawerRow, CurrencyDropdown, CurrencySheet } from "./currency-menu";
import { Price } from "./currency-provider";
import { useCart } from "./cart-provider";
import { CartHeaderButton } from "./cart-ui";

const drawerLevels: Record<string, string[]> = { root: ["Shop All", "PC Parts", "Computers", "Gaming", "Monitors", "Peripherals", "Storage", "Networking", "Digital Games", "Software", "PC Builder", "Brands", "Deals", "Clearance"], "PC Parts": ["Graphics Cards", "Processors", "Motherboards", "Memory", "Storage", "Power Supplies", "PC Cases", "Cooling", "Fans", "Accessories"], "Digital Games": ["PC Games", "Steam", "Xbox", "PlayStation", "Nintendo", "DLC", "Preorders", "New Releases", "Best Sellers", "On Sale", "Under $10", "Genres", "Publishers"] };

// Line icons (stroke = text colour). Shared with product cards / favorites later.
export const HeartIcon = ({ filled = false }: { filled?: boolean }) => <svg className="icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" /></svg>;
const UserIcon = () => <svg className="icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" /></svg>;

export default function SiteHeader() {
  const { user } = useAuth(); const { openGate } = useCart();
  // Signed out on desktop/tablet: "Sign in" opens the sign-in popup (split layout). Mobile keeps the /login page.
  const popupFor = (view: "signin" | "register") => (e: React.MouseEvent) => { if (user || !window.matchMedia("(min-width: 768px)").matches) return; e.preventDefault(); openGate(view); };
  const signInPopup = popupFor("signin");
  const [drawer, setDrawer] = useState(false); const [level, setLevel] = useState("root"); const drawerRef = useRef<HTMLElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const closeDrawer = useCallback(() => { setDrawer(false); setLevel("root"); setSheet(false); }, []);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key !== "Escape") return; if (sheet) setSheet(false); else closeDrawer(); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [closeDrawer, sheet]);
  useEffect(() => { document.body.style.overflow = drawer ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [drawer]);
  useEffect(() => { if (drawer) drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [drawer, level]);
  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => { if (event.key !== "Tab") return; const items = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>("button, a, input") ?? []).filter((el) => !el.closest("[inert]")); if (!items.length) return; const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } };
  const firstName = user?.name?.split(" ")[0];
  const accountHref = user ? "/account" : "/login";
  return <><header><div className="topbar"><span>Free shipping on orders over <Price thb={120000} /></span><span>Help & support</span></div><div className="header-main"><button className="mobile-menu" aria-label="Open products menu" onClick={() => setDrawer(true)}>☰</button><Link className="logo" href="/">core<span>cart</span></Link><label className="search"><span>⌕</span><input aria-label="Search products" placeholder="Search PC parts, games, laptops, software..." /></label><button className="utility location"><b>⌖</b><span>Deliver to<br/><strong>Bangkok, Thailand</strong></span></button><CurrencyDropdown /><Link className="utility desktop-utility" href={user ? "/account/orders" : "/login"}><b>□</b><span>Returns<br/><strong>& Orders</strong></span></Link>
    {/* Every device: ♡ Favorites · Cart · Profile, profile always right next to the cart. Text hides under 641px (icons only). */}
    <Link className="hdr-icon" href="/account/favorites" aria-label="Favorites" title="Favorites"><HeartIcon /></Link><CartHeaderButton />
    <div className="hdr-profile"><Link className={user ? "hdr-account" : "hdr-account out"} href={accountHref} onClick={signInPopup}><b><UserIcon /></b><span className="hdr-profile-text">{user ? <>Hello, {firstName}<br/><strong>Account</strong></> : "Sign in"}</span></Link>
      {!user && <><span className="hdr-sep" aria-hidden="true">|</span><Link className="hdr-register" href="/register" onClick={popupFor("register")}>Register</Link></>}</div></div><div className="mobile-location">⌖ Deliver to <strong>Bangkok, Thailand</strong></div><nav><button onClick={() => setDrawer(true)}>☰ <strong>Products</strong></button>{["PC Parts", "Computers", "Gaming", "Digital Games", "Deals", "PC Builder", "Brands", "Clearance"].map(x => <a href="#" key={x}>{x}</a>)}</nav></header>
  {drawer && <div className="drawer-wrap" role="presentation"><button className="backdrop" aria-label="Close products menu" onClick={closeDrawer}/><aside ref={drawerRef} onKeyDown={trapFocus} className="drawer" aria-label="Product categories" role="dialog" aria-modal="true"><div className="drawer-main" inert={sheet}><div className="drawer-top">{level !== "root" ? <button onClick={() => setLevel("root")}>← {level}</button> : <strong>Products</strong>}<button onClick={closeDrawer} aria-label="Close menu">×</button></div><ul>{drawerLevels[level].map(item => <li key={item}><button onClick={() => drawerLevels[item] ? setLevel(item) : closeDrawer()}>{item}{drawerLevels[item] && <span>›</span>}</button></li>)}</ul><CurrencyDrawerRow onOpen={() => setSheet(true)} /><div className="drawer-help">{user ? <><Link href="/account" onClick={closeDrawer}>Your account</Link> · <Link href="/account/orders" onClick={closeDrawer}>Orders</Link></> : <><Link href="/login" onClick={closeDrawer}>Sign in</Link> · <Link href="/register" onClick={closeDrawer}>Create account</Link></>}<br/>Need help choosing parts?<br/><a href="#">Talk to an expert</a></div></div><CurrencySheet open={sheet} onClose={() => setSheet(false)} /></aside></div>}</>;
}
