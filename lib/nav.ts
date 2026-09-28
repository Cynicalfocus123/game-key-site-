// Store navigation targets (header bar, products drawer, home page, footer). Every item opens a real listing page
// (/games, /hardware, /search with filters in the URL). Items without matching products yet go to the closest listing.
const games = (q = "") => `/games${q ? `?${q}` : ""}`;
export const ON_SALE = "/search?sale=On+sale";
export const NAV_HREF: Record<string, string> = {
  "Shop All": "/search",
  "PC Parts": "/hardware", Computers: "/hardware", Gaming: "/hardware", Monitors: "/hardware", Peripherals: "/hardware", Storage: "/hardware", Networking: "/hardware",
  "Graphics Cards": "/hardware", Processors: "/hardware", Motherboards: "/hardware", Memory: "/hardware", "Power Supplies": "/hardware", "PC Cases": "/hardware",
  Cooling: "/hardware", Fans: "/hardware", Accessories: "/hardware", "PC Builder": "/hardware", Brands: "/hardware",
  "Digital Games": games(), "PC Games": games("os=Windows"), Steam: games("platform=Steam"), Xbox: games("platform=Xbox"), PlayStation: games("platform=PlayStation"),
  Sony: games("platform=PlayStation"), Nintendo: games("platform=Nintendo"), DLC: games("type=DLC"), Preorders: games("sort=newest"), "New Releases": games("sort=newest"),
  "Best Sellers": games(), "On Sale": games("sale=On+sale"), Genres: games(), Publishers: games(), Software: games("type=Software"), "eGift Card": games("type=Gift+card"),
  Deals: ON_SALE, Clearance: ON_SALE,
};
export const navHref = (label: string) => NAV_HREF[label] ?? `/search?q=${encodeURIComponent(label)}`;
// Drawer "Under ฿350" (about US$10): shown and filtered in the visitor currency (known issue fixed 2026-09-28).
export const UNDER_THB_MINOR = 35_000;
export const underHref = (maxMajor: number) => games(`max=${Math.ceil(maxMajor)}`);
