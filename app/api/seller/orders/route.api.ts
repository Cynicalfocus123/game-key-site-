import { isSaleTab } from "@/lib/admin-orders";
import { requireSeller } from "@/lib/server/marketplace";
import { sellerSales } from "@/lib/server/admin-orders";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Seller Orders: only this seller's order lines (masked buyer name, never email / address / order total). GET ?q=&tab=&from=&to=&page= → { data }.
export async function GET(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  const p = new URL(req.url).searchParams; const tab = p.get("tab");
  return json({ data: await sellerSales(r.user.id, { q: p.get("q") ?? "", tab: isSaleTab(tab) ? tab : "all", from: p.get("from") ?? "", to: p.get("to") ?? "", page: Number(p.get("page")) || 1 }) });
}
