import { ADMIN_PRODUCT_LIMIT, parseProduct, PRODUCT_ERRORS } from "@/lib/products";
import { adminProduct, adminProducts, deleteProduct, saveProduct } from "@/lib/server/catalog";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const body = async (req: Request) => { try { return await req.json() as unknown; } catch { return null; } };

// GET → { products } (drafts included, deleted left out). GET ?id= → { product }.
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const id = new URL(req.url).searchParams.get("id");
  if (id) { const p = await adminProduct(id); return p ? json({ product: p }) : json({ error: PRODUCT_ERRORS.notFound }, 404); }
  return json({ products: await adminProducts() });
}

// Writes: admin only + 120 per minute per admin.
async function write(req: Request, isNew: boolean) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  if (!(await hitLimit(`products:${r.user.id}`, ADMIN_PRODUCT_LIMIT.max, ADMIN_PRODUCT_LIMIT.windowMs))) return json({ error: PRODUCT_ERRORS.limit }, 429);
  const parsed = parseProduct(await body(req));
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const res = await saveProduct(parsed.product, isNew, r.user.id);
  return res.ok ? json({ product: res.product }, isNew ? 201 : 200) : json({ error: res.error }, res.status);
}
// POST → create. PATCH → update (same id).
export const POST = (req: Request) => write(req, true);
export const PATCH = (req: Request) => write(req, false);

// DELETE ?id= → status "deleted" (id stays reserved; order history keeps its names).
export async function DELETE(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  if (!(await hitLimit(`products:${r.user.id}`, ADMIN_PRODUCT_LIMIT.max, ADMIN_PRODUCT_LIMIT.windowMs))) return json({ error: PRODUCT_ERRORS.limit }, 429);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return (await deleteProduct(id, r.user.id)) ? json({ ok: true }) : json({ error: PRODUCT_ERRORS.notFound }, 404);
}
