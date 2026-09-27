import { addFavorite, getFavorites, mergeFavoriteList, removeFavorite } from "@/lib/server/favorites";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const MAX_MERGE = 200;
const body = async (req: Request) => { try { return await req.json(); } catch { return null; } };

// GET → { ids } newest first.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  return json({ ids: await getFavorites(u.id) });
}

// PUT { productId } saves one product.
export async function PUT(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const b = await body(req);
  if (typeof b?.productId !== "string") return json({ error: "productId required" }, 400);
  const ids = await addFavorite(u.id, b.productId);
  return ids ? json({ ids }) : json({ error: "Product not found" }, 404);
}

// DELETE ?productId= removes one product.
export async function DELETE(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return json({ error: "productId required" }, 400);
  return json({ ids: await removeFavorite(u.id, productId) });
}

// POST { ids } merges the guest favorites after register/sign-in.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const b = await body(req);
  if (!Array.isArray(b?.ids) || b.ids.length > MAX_MERGE) return json({ error: "ids required" }, 400);
  return json({ ids: await mergeFavoriteList(u.id, b.ids) });
}
