import { lowStockOk, MARKET_ERRORS, OFFER_WRITE_LIMIT } from "@/lib/marketplace";
import { readBody, requireSeller, saveStore, sellerHome } from "@/lib/server/marketplace";
import { hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Seller dashboard home (approved sellers): store + tiles + sales hold.
export async function GET(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  return json({ home: await sellerHome(r.seller) });
}

// PATCH { invoices?: boolean, lowStockAt?: 0..1000 } → { store }
export async function PATCH(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  const b = await readBody(req, 4_000); if (!b) return json({ error: "Bad request" }, 400);
  if (b.invoices !== undefined && typeof b.invoices !== "boolean") return json({ error: "Bad request" }, 400);
  if (b.lowStockAt !== undefined && !lowStockOk(b.lowStockAt)) return json({ error: MARKET_ERRORS.lowStock }, 400);
  if (!(await hitLimit(`seller-write:${r.user.id}`, OFFER_WRITE_LIMIT.max, OFFER_WRITE_LIMIT.windowMs))) return json({ error: MARKET_ERRORS.writeLimit }, 429);
  return json({ store: await saveStore(r.seller, { invoices: b.invoices as boolean | undefined, lowStockAt: b.lowStockAt as number | undefined }) });
}
