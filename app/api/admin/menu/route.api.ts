import { addMenuItem, deleteMenuItem, MENU_ERRORS, MENU_WRITE_LIMIT, parseMenuInput, parseMenuPatch, updateMenuItem, type MenuEdit, type MenuInput, type MenuItem } from "@/lib/menu";
import { editMenu, getMenu } from "@/lib/server/menu";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const body = async (req: Request) => { try { const b = await req.json(); return b && typeof b === "object" ? b as Record<string, unknown> : null; } catch { return null; } };

// Writes: admin only + 120 per minute per admin (app_rate_limit key menu:{adminId}). Every write returns the whole menu.
async function write(req: Request, edit: ((items: MenuItem[]) => MenuEdit) | string | null) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  if (!(await hitLimit(`menu:${r.user.id}`, MENU_WRITE_LIMIT.max, MENU_WRITE_LIMIT.windowMs))) return json({ error: MENU_ERRORS.limit }, 429);
  if (!edit) return json({ error: "Invalid request" }, 400);
  if (typeof edit === "string") return json({ error: edit }, 400);
  const res = await editMenu(r.user.id, edit);
  return res.ok ? json({ items: res.items }) : json({ error: res.error }, res.error === MENU_ERRORS.notFound ? 404 : 400);
}

// GET → { items } (every item, deleted ones flagged).
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  return json({ items: await getMenu() });
}

// POST { label, href, kind, parent, isNew, inBar, inFooter } → add an item (last in its level).
export async function POST(req: Request) {
  const b = await body(req);
  const p = b ? parseMenuInput(b, false) : null;
  return write(req, typeof p === "string" || !p ? p : (items) => addMenuItem(items, p as MenuInput, crypto.randomUUID()));
}

// PATCH { id, label?, href?, kind?, parent?, isNew?, inBar?, inFooter?, hidden?, move? } → one item.
export async function PATCH(req: Request) {
  const b = await body(req);
  if (!b || typeof b.id !== "string") return write(req, null);
  const p = parseMenuPatch(b);
  return write(req, typeof p === "string" ? p : Object.keys(p).length ? (items) => updateMenuItem(items, b.id as string, p) : null);
}

// DELETE ?id= → soft delete (its sub-items too).
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return write(req, id ? (items) => deleteMenuItem(items, id) : null);
}
