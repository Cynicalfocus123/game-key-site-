// Game keys (Handoff v8 C5–C8): shared by the keys library, key detail, print page and activation guides.
// One record per key unit (an order line with quantity 3 has 3 keys). The code is only sent to the browser after "Reveal key".
export type GameKey = {
  id: string; orderId: string; orderNumber: string; orderItemId: string; name: string; platform: string | null; region: string | null;
  priceMinor: number; currency: string; createdAt: string; revealedAt: string | null; code: string | null;
};
export const KEYS_PER_PAGE = 20;
export const maskedKey = "•••••-•••••-•••••";

// Activation guides (/help/activate/{slug}). `url` = the platform's own redeem page (the key is never put in the URL).
export type Guide = { slug: string; name: string; url: string; site: string; worksOn: string; steps: string[] };
export const GUIDES: Guide[] = [
  { slug: "steam", name: "Steam", url: "https://store.steampowered.com/account/registerkey", site: "store.steampowered.com", worksOn: "Windows PC",
    steps: ["Install Steam and sign in to your Steam account.", "Open the Games menu and choose \"Activate a Product on Steam…\".", "Accept the Steam Subscriber Agreement.", "Enter your key exactly as shown and select Next.", "The game appears in your Library. Select Install to download it."] },
  { slug: "xbox", name: "Xbox", url: "https://redeem.microsoft.com", site: "redeem.microsoft.com", worksOn: "Xbox Series X|S, Xbox One, Windows PC",
    steps: ["Go to redeem.microsoft.com and sign in with your Microsoft account.", "Enter the 25-character code and select Next.", "Confirm the item and select Confirm.", "On your console, open My games & apps to install it."] },
  { slug: "playstation", name: "PlayStation", url: "https://store.playstation.com", site: "store.playstation.com", worksOn: "PlayStation 5, PlayStation 4",
    steps: ["Sign in to PlayStation Store with your PlayStation account.", "Open your avatar menu and choose Redeem codes.", "Enter the code and select Redeem.", "Download the content from your Game Library."] },
  { slug: "nintendo", name: "Nintendo", url: "https://ec.nintendo.com/redeem", site: "ec.nintendo.com", worksOn: "Nintendo Switch",
    steps: ["On Nintendo Switch, open Nintendo eShop and choose the user.", "Select Enter Code in the left menu.", "Enter the 16-character code and select OK.", "Confirm; the download starts automatically."] },
  { slug: "ea", name: "EA app", url: "https://www.ea.com/ea-app", site: "ea.com", worksOn: "Windows PC",
    steps: ["Install the EA app and sign in to your EA account.", "Open the menu (☰) and choose Redeem code.", "Enter the code and select Next.", "The game appears in your Library, ready to download."] },
  { slug: "ubisoft", name: "Ubisoft Connect", url: "https://store.ubisoft.com", site: "ubisoft.com", worksOn: "Windows PC",
    steps: ["Install Ubisoft Connect and sign in to your Ubisoft account.", "Open the menu (☰) and choose Activate a key.", "Enter the key and select Activate.", "Find the game under Games and select Download."] },
];
const aliases: Record<string, string> = { steam: "steam", xbox: "xbox", microsoft: "xbox", playstation: "playstation", psn: "playstation", nintendo: "nintendo", ea: "ea", "ea app": "ea", origin: "ea", ubisoft: "ubisoft", "ubisoft connect": "ubisoft", uplay: "ubisoft" };
export const guideFor = (platform: string | null | undefined) => GUIDES.find((g) => g.slug === aliases[(platform ?? "").trim().toLowerCase()]) ?? null;

// Library search: product name or order ID, case-insensitive. Filter: all | new (not revealed) | revealed.
export type KeyFilter = "all" | "new" | "revealed";
export function filterKeys(keys: GameKey[], q: string, filter: KeyFilter) {
  const t = q.trim().toLowerCase();
  return keys.filter((k) => (filter === "all" || (filter === "new" ? !k.revealedAt : Boolean(k.revealedAt)))
    && (!t || k.name.toLowerCase().includes(t) || k.orderNumber.toLowerCase().includes(t)));
}
