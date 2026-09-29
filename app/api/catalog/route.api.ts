import { allProducts } from "@/lib/catalog";
import { ensureCatalog } from "@/lib/server/catalog";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Public: published products (task B). The storefront, cart and search read this instead of the built-in seed.
export async function GET() {
  await ensureCatalog();
  return json({ products: allProducts() });
}
