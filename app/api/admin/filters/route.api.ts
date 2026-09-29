import { addOption, ADMIN_WRITE_LIMIT, deleteOption, FILTER_ERRORS, isFilterGroup, parseGroupPatch, parseOptionPatch, updateGroup, updateOption, type FilterConfig } from "@/lib/filters";
import { editFilters, getFilters } from "@/lib/server/filters";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const body = async (req: Request) => { try { return await req.json() as Record<string, unknown>; } catch { return null; } };
type Edit = { ok: true; cfg: FilterConfig } | { ok: false; error: string };

// Writes: admin only + 120 per minute per admin (app_rate_limit key filters:{adminId}).
async function write(req: Request, edit: (b: Record<string, unknown>) => ((c: FilterConfig) => Edit) | null, b?: Record<string, unknown> | null) {
  const r = await requireAdmin(req, "filters");
  if ("error" in r) return r.error;
  if (!(await hitLimit(`filters:${r.user.id}`, ADMIN_WRITE_LIMIT.max, ADMIN_WRITE_LIMIT.windowMs))) return json({ error: FILTER_ERRORS.limit }, 429);
  const fn = b ? edit(b) : null;
  if (!fn) return json({ error: "Invalid request" }, 400);
  const res = await editFilters(r.user.id, fn);
  return res.ok ? json({ config: res.cfg }) : json({ error: res.error }, res.error === FILTER_ERRORS.notFound ? 404 : 400);
}

// GET → { config } (groups + every option, deleted ones flagged).
export async function GET(req: Request) {
  const r = await requireAdmin(req, "filters");
  if ("error" in r) return r.error;
  return json({ config: await getFilters() });
}

// POST { group, label } → add a value.
export async function POST(req: Request) {
  return write(req, (b) => (isFilterGroup(b.group) && typeof b.label === "string" ? (c) => addOption(c, b.group as never, b.label as string, crypto.randomUUID()) : null), await body(req));
}

// PATCH { id, label?, hidden?, move? } → one value. PATCH { group, shown?, startOpen? } → the whole group.
export async function PATCH(req: Request) {
  return write(req, (b) => {
    if (typeof b.id === "string") { const p = parseOptionPatch(b); return Object.keys(p).length ? (c) => updateOption(c, b.id as string, p) : null; }
    if (isFilterGroup(b.group)) { const p = parseGroupPatch(b); return Object.keys(p).length ? (c) => ({ ok: true, cfg: updateGroup(c, b.group as never, p) }) : null; }
    return null;
  }, await body(req));
}

// DELETE ?id= → soft delete (Countries + Sale cannot be deleted, only hidden).
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return write(req, () => (id ? (c) => deleteOption(c, id) : null), id ? {} : null);
}
