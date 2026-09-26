import { clearCart, getCart, mergeCart, setCartItem } from "@/lib/server/cart";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const MAX_MERGE = 50;
const body = async (req: Request) => { try { return await req.json(); } catch { return null; } };

export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  return json({ items: await getCart(u.id) });
}

// { productId, qty } sets one line; qty 0 removes it.
export async function PUT(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const b = await body(req);
  if (typeof b?.productId !== "string" || !Number.isFinite(Number(b?.qty))) return json({ error: "productId and qty required" }, 400);
  const items = await setCartItem(u.id, b.productId, Number(b.qty));
  return items ? json({ items }) : json({ error: "Product not found" }, 404);
}

// { items: [{ productId, qty }] } merges the guest cart after register/sign-in.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const b = await body(req);
  if (!Array.isArray(b?.items) || b.items.length > MAX_MERGE) return json({ error: "items required" }, 400);
  return json({ items: await mergeCart(u.id, b.items) });
}

export async function DELETE(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  return json({ items: await clearCart(u.id) });
}
