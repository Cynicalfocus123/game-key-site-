import { checkPromoInput, parsePromoInput } from "@/lib/promo";
import { createPromo, deletePromo, getPromo, listPromos, setPromoEnabled, updatePromo } from "@/lib/server/promo";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const body = async (req: Request) => { try { return await req.json() as Record<string, unknown>; } catch { return null; } };
const invalid = (errors: object) => json({ error: "Check the highlighted fields.", errors }, 400);

// GET → { promos } (not deleted, newest first). GET ?id= → { promo }.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "promo");
  if ("error" in r) return r.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ promos: await listPromos() });
  const promo = await getPromo(id);
  return promo ? json({ promo }) : json({ error: "Promo code not found" }, 404);
}

// POST PromoInput → { promo }. 400 { errors } per field.
export async function POST(req: Request) {
  const r = await requireAdmin(req, "promo");
  if ("error" in r) return r.error;
  const input = parsePromoInput(await body(req));
  if (!input) return json({ error: "Invalid promo code" }, 400);
  const errors = checkPromoInput(input);
  if (Object.keys(errors).length) return invalid(errors);
  const res = await createPromo(r.user.id, input);
  return res.ok ? json({ promo: res.promo }) : invalid({ [res.field]: res.error });
}

// PATCH { id, enabled } → enable / disable. PATCH { id, ...PromoInput } → full edit.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "promo");
  if ("error" in r) return r.error;
  const b = await body(req);
  if (typeof b?.id !== "string") return json({ error: "id required" }, 400);
  if (typeof b.enabled === "boolean" && b.code === undefined) return (await setPromoEnabled(b.id, b.enabled)) ? json({ ok: true }) : json({ error: "Promo code not found" }, 404);
  const input = parsePromoInput(b);
  if (!input) return json({ error: "Invalid promo code" }, 400);
  const errors = checkPromoInput(input);
  if (Object.keys(errors).length) return invalid(errors);
  const res = await updatePromo(b.id, input);
  if (res.ok) return json({ promo: res.promo });
  return "field" in res ? invalid({ [res.field as string]: res.error }) : json({ error: res.error }, 404);
}

// DELETE ?id= → hard delete while never used, soft delete after real orders used it.
export async function DELETE(req: Request) {
  const r = await requireAdmin(req, "promo");
  if ("error" in r) return r.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "id required" }, 400);
  return (await deletePromo(id)) ? json({ ok: true }) : json({ error: "Promo code not found" }, 404);
}
