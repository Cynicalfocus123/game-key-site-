import { recentPurchases } from "@/lib/server/purchase-popup";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Public: purchase popup feed { enabled, purchases: [{ id, productId, at, country }] }. Product id, time and the buyer's account country only.
export async function GET() {
  return json(await recentPurchases());
}
