import { emptyCounts, KEY_ERRORS, KEY_UPLOAD_LIMIT, KEYS_PER_UPLOAD, parseKeyText } from "@/lib/key-inventory";
import { ensureCatalog } from "@/lib/server/catalog";
import { addKeys, isGameKeyProduct, keyCounts, listKeys, removeKey } from "@/lib/server/key-inventory";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// GET ?productId= → { counts, keys } (last 4 characters only). GET (no id) → { counts: { productId: counts } } for the products list.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  await ensureCatalog();
  const id = new URL(req.url).searchParams.get("productId");
  if (!id) return json({ counts: await keyCounts() });
  const kind = await isGameKeyProduct(id); if (kind === null) return json({ error: KEY_ERRORS.notFound }, 404);
  return json({ inventory: { counts: (await keyCounts(id))[id] ?? emptyCounts(), keys: await listKeys(id) } });
}

// POST { productId, text, batch? } → { added, duplicates, invalid }. 30 uploads per 10 min per admin.
export async function POST(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const productId = typeof b?.productId === "string" ? b.productId : ""; const text = typeof b?.text === "string" ? b.text : "";
  const batch = typeof b?.batch === "string" && b.batch.trim() ? b.batch.trim() : null;
  if (batch && batch.length > 40) return json({ error: KEY_ERRORS.batch }, 400);
  const kind = await isGameKeyProduct(productId); if (kind === null) return json({ error: KEY_ERRORS.notFound }, 404); if (!kind) return json({ error: KEY_ERRORS.notKey }, 400);
  const parsed = parseKeyText(text.slice(0, 200_000));
  if (!parsed.codes.length) return json({ error: KEY_ERRORS.empty, invalid: parsed.invalid }, 400);
  if (parsed.codes.length > KEYS_PER_UPLOAD) return json({ error: KEY_ERRORS.tooMany }, 400);
  if (!(await hitLimit(`product-keys:${r.user.id}`, KEY_UPLOAD_LIMIT.max, KEY_UPLOAD_LIMIT.windowMs))) return json({ error: KEY_ERRORS.limit }, 429);
  const res = await addKeys(productId, parsed.codes, batch, r.user.id);
  if (!res.ok) return json({ error: res.error }, 500);
  return json({ result: { added: res.added, duplicates: res.duplicates + parsed.duplicates, invalid: parsed.invalid } }, 201);
}

// DELETE ?productId=&keyId= → removes an available key (reserved / sold keys stay for the order history).
export async function DELETE(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  const q = new URL(req.url).searchParams;
  const res = await removeKey(q.get("productId") ?? "", q.get("keyId") ?? "");
  return res.ok ? json({ ok: true }) : json({ error: res.error }, res.error === KEY_ERRORS.notAvailable ? 409 : 404);
}
