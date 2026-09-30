import { parsePopupSettings, POPUP_ERRORS, POPUP_WRITE_LIMIT } from "@/lib/purchase-popup";
import { allProductIds, popupHistory, popupSettings, savePopupSettings } from "@/lib/server/purchase-popup";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Purchase popup settings (admin section "Products + key inventory"). GET → { settings, history }.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  return json({ settings: await popupSettings(), history: await popupHistory() });
}

// PUT { enabled, hidden: productId[] } → saved + audited (unchanged = no audit row). 30 writes / min per admin.
export async function PUT(req: Request) {
  const r = await requireAdmin(req, "products");
  if ("error" in r) return r.error;
  if (!(await hitLimit(`popup:${r.user.id}`, POPUP_WRITE_LIMIT.max, POPUP_WRITE_LIMIT.windowMs))) return json({ error: POPUP_ERRORS.limit }, 429);
  const body = await req.json().catch(() => null);
  const ids = await allProductIds();
  const p = parsePopupSettings(body, (id) => ids.has(id));
  if (typeof p === "string") return json({ error: p }, 400);
  await savePopupSettings(r.user.id, p);
  return json({ settings: await popupSettings(), history: await popupHistory() });
}
