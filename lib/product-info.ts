// Product page copy. SEED_COPY fills the seed products (lib/catalog.ts); after that the admin edits it on the product.
import type { Product } from "./catalog";

export type Info = { description: string; requirements?: [string, string][]; warranty?: string };
const pcMin = (cpu: string, ram: string, gpu: string, storage: string): [string, string][] => [["OS", "Windows 10 64-bit"], ["Processor", cpu], ["Memory", ram], ["Graphics", gpu], ["Storage", storage]];

export const SEED_COPY: Record<string, Info> = {
  "key-cyberpunk-2077-steam": { description: "Open-world action RPG set in Night City. Build your character, choose your path and explore a huge city full of side stories.", requirements: pcMin("Intel Core i7-6700 / Ryzen 5 1600", "12 GB RAM", "GeForce GTX 1060 6GB / Radeon RX 580", "70 GB SSD") },
  "key-elden-ring-steam": { description: "Action RPG in a vast fantasy world. Explore open fields and deep dungeons, fight hard bosses and build your own playstyle.", requirements: pcMin("Intel Core i5-8400 / Ryzen 3 3300X", "12 GB RAM", "GeForce GTX 1060 3GB / Radeon RX 580", "60 GB") },
  "key-baldurs-gate-3-steam": { description: "Story-rich party RPG. Gather your party, make choices that change the story and play solo or co-op.", requirements: pcMin("Intel Core i5-4690 / Ryzen 5 1500X", "8 GB RAM", "GeForce GTX 970 / Radeon RX 480", "150 GB SSD") },
  "key-black-myth-wukong-steam": { description: "Action RPG based on Journey to the West. Fast combat, big bosses and a mythic world. This ROW key does not work in East and Southeast Asia.", requirements: pcMin("Intel Core i5-8400 / Ryzen 5 1600", "16 GB RAM", "GeForce GTX 1060 6GB / Radeon RX 580", "130 GB SSD") },
  "hw-rtx-5070-ti-tuf": { description: "16 GB graphics card for high-refresh 1440p and 4K gaming, with a triple-fan cooler and a metal backplate.", warranty: "3-year manufacturer warranty" },
  "hw-ryzen-7-9800x3d": { description: "8-core, 16-thread desktop processor with 3D V-Cache for high frame rates in games. AM5 socket.", warranty: "3-year manufacturer warranty" },
  "hw-990-pro-2tb": { description: "PCIe 4.0 NVMe M.2 SSD with fast load times for games and large files.", warranty: "5-year manufacturer warranty" },
  "hw-vengeance-32gb-ddr5": { description: "32 GB (2 × 16 GB) DDR5 desktop memory kit with low-profile heat spreaders.", warranty: "Limited lifetime warranty" },
  "hw-msi-mag-27-qhd": { description: "27-inch 2560 × 1440 gaming monitor with a 180 Hz refresh rate and adaptive sync.", warranty: "3-year manufacturer warranty" },
  "hw-fractal-north": { description: "Mid-tower ATX case with a wood front panel, mesh airflow and room for large graphics cards.", warranty: "2-year manufacturer warranty" },
};
export const productInfo = (p: Product): Info => p.description ? { description: p.description, requirements: p.requirements?.length ? p.requirements : undefined, warranty: p.warranty || (p.kind === "hardware" ? "Manufacturer warranty" : undefined) }
  : SEED_COPY[p.id] ?? { description: p.kind === "game_key" ? "Digital game key, delivered instantly to your account after payment." : "PC hardware, shipped from Bangkok.", warranty: p.kind === "hardware" ? "Manufacturer warranty" : undefined };
