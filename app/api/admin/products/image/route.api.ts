import { dataUrlBytes, IMAGE_MAX_BYTES, IMAGE_UPLOAD_LIMIT, PRODUCT_ERRORS } from "@/lib/products";
import { saveImage } from "@/lib/server/catalog";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// POST { dataUrl } (the editor's cropped 800 x 1000 WebP / JPEG) → { url: "/api/images/{id}" }. 30 uploads per 10 min per admin.
export async function POST(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  if (Number(req.headers.get("content-length") ?? 0) > IMAGE_MAX_BYTES * 1.4 + 1000) return json({ error: PRODUCT_ERRORS.imageBad }, 413);
  if (!(await hitLimit(`product-images:${r.user.id}`, IMAGE_UPLOAD_LIMIT.max, IMAGE_UPLOAD_LIMIT.windowMs))) return json({ error: PRODUCT_ERRORS.uploadLimit }, 429);
  let b: { dataUrl?: unknown } | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const bytes = typeof b?.dataUrl === "string" ? dataUrlBytes(b.dataUrl) : null;
  const url = bytes ? await saveImage(bytes, r.user.id) : null;
  return url ? json({ url }, 201) : json({ error: PRODUCT_ERRORS.imageBad }, 400);
}
