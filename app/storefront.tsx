"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import SiteFooter from "./components/site-footer";
import SiteHeader from "./components/site-header";
import { Price } from "./components/currency-provider";
import { AddToCartButton } from "./components/cart-ui";
import { games, hardware, type Product } from "@/lib/catalog";

const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
// Products + prices (THB satang) live in lib/catalog.ts; <Price> converts to the visitor currency.
const categories = ["Graphics Cards", "Processors", "Motherboards", "Memory", "Storage", "Gaming PCs", "Gaming Laptops", "Monitors"];
const categoryImages = ["gpu-placeholder-01.jpg", "ram-placeholder-01.jpg", "gaming-pc-placeholder-01.jpg", "ram-placeholder-01.jpg", "ssd-placeholder-01.jpg", "gaming-pc-placeholder-01.jpg", "laptop-placeholder-01.jpg", "monitor-placeholder-01.jpg"];
const slides = [
  { eyebrow: "RTX 50 SERIES", title: "Upgrade your gaming PC.", text: "Next-generation graphics for play, create, and everything between.", action: "Shop GPUs", image: "/images/placeholders/hero-rtx-placeholder.png" },
  { eyebrow: "GAMING LAPTOP EVENT", title: "Performance goes anywhere.", text: "Save on RTX 5070 and 5080 gaming laptops this week.", action: "Shop laptops", image: "/images/placeholders/hero-laptop-placeholder.jpg" },
  { eyebrow: "PC BUILDER WEEK", title: "Build it your way.", text: "Start with compatible parts, finish with a PC you will love.", action: "Start building", image: "/images/placeholders/hero-builder-placeholder.jpg" },
  { eyebrow: "DIGITAL GAME DEALS", title: "More to play. Less to pay.", text: "Big PC and console games, delivered instantly.", action: "View game deals", image: "/images/placeholders/hero-games-placeholder.jpg" }
];
type QuickCategory = { name: string; icon: string; href: string };
const quickCategories: QuickCategory[] = [
  { name: "Steam", icon: "/images/placeholders/categories/steam-logo-placeholder.png", href: "#" },
  { name: "Xbox", icon: "/images/placeholders/categories/xbox-logo-placeholder.png", href: "#" },
  { name: "Sony", icon: "/images/placeholders/categories/sony-logo-placeholder.png", href: "#" },
  { name: "eGift Card", icon: "/images/placeholders/categories/egift.svg", href: "#" },
  { name: "Nintendo", icon: "/images/placeholders/categories/nintendo-logo-placeholder.png", href: "#" },
  { name: "Netflix", icon: "/images/placeholders/categories/netflix-logo-placeholder.png", href: "#" },
  { name: "Apple", icon: "/images/placeholders/categories/apple-logo-placeholder.png", href: "#" },
  { name: "Spotify", icon: "/images/placeholders/categories/spotify-logo-placeholder.png", href: "#" },
];
type Promo = { name: string; eyebrow: string; title: string; text: string; action: string; desktopImage: string; mobileImage: string; wide?: boolean };
const promos: Promo[] = [
  { name: "component-week", eyebrow: "PC COMPONENT WEEK", title: "Save on the parts that power your build.", text: "Special pricing on GPUs, CPUs, and SSDs.", action: "Shop deals", desktopImage: "/images/placeholders/promos/promo-wide-placeholder.jpg", mobileImage: "/images/placeholders/promos/promo-wide-placeholder.jpg", wide: true },
  { name: "game-sale", eyebrow: "DIGITAL GAME DEALS", title: "15% off select PC games.", text: "Instant delivery. Ready when you are.", action: "Shop games", desktopImage: "/images/placeholders/promos/promo-left-placeholder.jpg", mobileImage: "/images/placeholders/promos/promo-left-placeholder.jpg" },
  { name: "sale-promotions", eyebrow: "CORECART SAVINGS", title: "Sales and promotions.", text: "Fresh offers across hardware and software.", action: "View all", desktopImage: "/images/placeholders/promos/promo-right-placeholder.jpg", mobileImage: "/images/placeholders/promos/promo-right-placeholder.jpg" },
];
function ProductCard({ item }: { item: Product }) { const game = item.kind === "game_key"; return <article className={`product ${game ? "game" : ""}`}><div className="product-image"><Image src={assetPath(item.image)} alt={item.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 17vw" /></div><div className="product-copy"><h3>{item.name}</h3>{game ? <p className="meta">{item.platform} · {item.region}</p> : <p className="rating">★★★★★ <span>{item.rating}</span></p>}<div className="price">{game && <small>From </small>}<Price thb={item.price} /> {item.old && <del><Price thb={item.old} /></del>}</div><div className="product-bottom">{game ? <span className="stock">Instant delivery</span> : <><span className="stock">In Stock</span><span className="shipping">Free shipping</span></>} </div><AddToCartButton productId={item.id} /></div></article> }
function Section({ title, link, children }: { title: string; link?: string; children: React.ReactNode }) { return <section className="section"><div className="section-title"><h2>{title}</h2>{link && <a href="#">{link} <span aria-hidden="true">→</span></a>}</div>{children}</section> }
function QuickCategoryStrip() { const stripRef = useRef<HTMLDivElement>(null); const scroll = (distance: number) => stripRef.current?.scrollBy({ left: distance, behavior: "smooth" }); return <section className="quick-section" aria-label="Digital and service quick links"><div className="quick-nav"><button className="quick-arrow" aria-label="Scroll categories left" onClick={() => scroll(-280)}>←</button><div className="quick-track" ref={stripRef}>{quickCategories.map(category => <a className="quick-item" href={category.href} key={category.name}><Image src={assetPath(category.icon)} alt="" width={52} height={52}/><span>{category.name}</span></a>)}</div><button className="quick-arrow" aria-label="Scroll categories right" onClick={() => scroll(280)}>→</button></div></section> }
function PromoBanner({ promo }: { promo: Promo }) { return <a className={`promo-banner ${promo.wide ? "promo-wide" : ""}`} href="#"><div className="promo-image"><picture><source media="(max-width: 640px)" srcSet={assetPath(promo.mobileImage)}/><Image src={assetPath(promo.desktopImage)} alt="" fill sizes={promo.wide ? "(max-width: 640px) 100vw, 100vw" : "(max-width: 640px) 100vw, 50vw"}/></picture></div><div className="promo-copy"><p>{promo.eyebrow}</p><h3>{promo.title}</h3><span>{promo.text}</span><b>{promo.action} <span aria-hidden="true">→</span></b></div></a> }
function PromoBannerSection() { return <section className="promo-section" aria-labelledby="promo-heading"><div className="section-title"><h2 id="promo-heading">Featured promotions</h2><span className="quick-note">Limited-time offers</span></div><div className="promo-grid"><PromoBanner promo={promos[0]}/><PromoBanner promo={promos[1]}/><PromoBanner promo={promos[2]}/></div></section> }
export default function Storefront() {
  const [slide, setSlide] = useState(0); const [tab, setTab] = useState("Gaming Desktops"); const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { const key = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (t && (t.closest("input, textarea, select, [contenteditable='true']") || document.querySelector(".drawer-wrap"))) return; if (e.key === "ArrowRight") setSlide(s => (s + 1) % slides.length); if (e.key === "ArrowLeft") setSlide(s => (s + slides.length - 1) % slides.length); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  const startTimer = () => { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !timer.current) timer.current = setInterval(() => setSlide(s => (s + 1) % slides.length), 7000); }; const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => { startTimer(); return stopTimer; }, []);
  return <><SiteHeader />
  <main><section className="hero" onMouseEnter={stopTimer} onMouseLeave={startTimer}><div className="hero-image"><Image src={assetPath(slides[slide].image)} alt="" fill priority sizes="100vw" /></div><div className="hero-content"><p>{slides[slide].eyebrow}</p><h1>{slides[slide].title}</h1><span>{slides[slide].text}</span><button>{slides[slide].action} <b>→</b></button></div><div className="hero-controls"><button aria-label="Previous slide" onClick={() => setSlide(s => (s + slides.length - 1) % slides.length)}>←</button><div>{slides.map((_, i) => <button key={i} aria-label={`Show slide ${i + 1}`} aria-current={i === slide} className={i === slide ? "active" : ""} onClick={() => setSlide(i)} />)}</div><button aria-label="Next slide" onClick={() => setSlide(s => (s + 1) % slides.length)}>→</button></div></section>
  <QuickCategoryStrip />
  <Section title="Shop by category"><div className="categories">{categories.map((name, i) => <a href="#" key={name} className="category"><Image src={assetPath(`/images/placeholders/${categoryImages[i]}`)} alt="" fill sizes="(max-width: 640px) 40vw, 15vw"/><span>{name}</span></a>)}</div></Section>
  <PromoBannerSection />
  <Section title="Today's deals" link="See all deals"><div className="products">{hardware.slice(0, 5).map(x => <ProductCard item={x} key={x.name}/>)}</div></Section>
  <Section title="PC component deals" link="Shop components"><div className="products">{hardware.slice(1).map(x => <ProductCard item={x} key={x.name}/>)}</div></Section>
  <Section title="Digital game deals" link="View all games"><div className="products games">{games.map(x => <ProductCard item={x} key={x.name}/>)}</div></Section>
  <Section title="Gaming PCs & laptops"><div className="tabs" role="tablist">{["Gaming Desktops", "Gaming Laptops"].map(x => <button role="tab" aria-selected={tab === x} className={tab === x ? "selected" : ""} onClick={() => setTab(x)} key={x}>{x}</button>)}</div><div className="feature-row"><div><p>{tab === "Gaming Desktops" ? "READY TO SHIP" : "PORTABLE POWER"}</p><h3>{tab === "Gaming Desktops" ? "Built to run what you play." : "Play anywhere without compromise."}</h3><a href="#">Shop {tab.toLowerCase()} →</a></div><Image src={assetPath(tab === "Gaming Desktops" ? "/images/placeholders/hero-builder-placeholder.jpg" : "/images/placeholders/hero-laptop-placeholder.jpg")} alt="Gaming hardware" fill sizes="(max-width: 768px) 100vw, 50vw" /></div></Section>
  <Section title="Popular brands"><div className="brands">{["ASUS", "MSI", "AMD", "intel", "NVIDIA", "CORSAIR", "SAMSUNG"].map(x => <a href="#" key={x}>{x}</a>)}</div></Section>
  <Section title="Clearance & price drops" link="Shop clearance"><div className="products">{hardware.slice(0, 4).map(x => <ProductCard item={{...x, old: x.old || 669000}} key={x.name}/>)}</div></Section>
  <Section title="Recently viewed"><div className="products recent">{hardware.slice(2, 5).map(x => <ProductCard item={x} key={x.name}/>)}</div></Section></main>
  <SiteFooter /></>;
}
