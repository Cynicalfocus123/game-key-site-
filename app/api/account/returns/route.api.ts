import { createReturn, listReturns } from "@/lib/server/returns";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// GET → { returns } of the signed-in customer, newest first.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  return json({ returns: await listReturns(u.id) });
}

// POST { orderItemId, quantity, reason, message } → { ret }. Rules in lib/returns.ts (keys only while not revealed).
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (!b) return json({ error: "Bad request" }, 400);
  const r = await createReturn(u.id, { orderItemId: b.orderItemId as string, quantity: b.quantity as number, reason: b.reason as never, message: typeof b.message === "string" ? b.message : "" });
  return r.ok ? json({ ret: r.ret }) : json({ error: r.error }, r.status);
}
