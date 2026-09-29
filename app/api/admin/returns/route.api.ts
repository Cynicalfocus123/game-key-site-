import { listAllReturns, updateReturn } from "@/lib/server/returns";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// GET → { returns } all customers, newest first (with customer email).
export async function GET(req: Request) {
  const r = await requireAdmin(req, "returns");
  if ("error" in r) return r.error;
  return json({ returns: await listAllReturns() });
}

// PATCH { id, status, note? } → status change (lib/returns.ts NEXT_STATUS). Rejecting needs a note.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "returns");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (typeof b?.id !== "string" || typeof b.status !== "string") return json({ error: "id and status required" }, 400);
  const res = await updateReturn(r.user.id, b.id, b.status, typeof b.note === "string" ? b.note : null);
  return res.ok ? json({ ok: true }) : json({ error: res.error }, res.status);
}
