import { checkNewTicket, NEW_TICKET_LIMIT, TICKET_ERRORS } from "@/lib/tickets";
import { hitLimit } from "@/lib/server/rate-limit";
import { createTicket, customerClose, customerReply, getThread, listTickets, unreadTickets } from "@/lib/server/tickets";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const body = async (req: Request) => { try { return await req.json() as Record<string, unknown>; } catch { return null; } };

// GET → { tickets, unread }. GET ?id= → { ticket } with messages (marks support replies read). GET ?unread=1 → { unread } (dashboard badge).
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const q = new URL(req.url).searchParams;
  if (q.get("unread")) return json({ unread: await unreadTickets(u.id) });
  const id = q.get("id");
  if (id) { const t = await getThread(u.id, id); return t ? json({ ticket: t }) : json({ error: "Ticket not found" }, 404); }
  return json({ tickets: await listTickets(u.id), unread: await unreadTickets(u.id) });
}

// POST { category, subject, message, orderId?, keyId? } → { id }. 5 new tickets per hour per customer.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const b = await body(req); if (!b) return json({ error: "Bad request" }, 400);
  const input = { category: b.category as never, subject: String(b.subject ?? ""), message: String(b.message ?? ""), orderId: (b.orderId ?? null) as string | null, keyId: (b.keyId ?? null) as string | null };
  const error = checkNewTicket(input); if (error) return json({ error }, 400); // form errors do not use up the limit
  if (!(await hitLimit(`ticket:${u.id}`, NEW_TICKET_LIMIT.max, NEW_TICKET_LIMIT.windowMs))) return json({ error: TICKET_ERRORS.limit }, 429);
  const r = await createTicket(u.id, input);
  return r.ok ? json({ id: r.id }) : json({ error: r.error }, r.status);
}

// PATCH { id, reply } → add a message (ticket becomes open). PATCH { id, close: true } → close.
export async function PATCH(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const b = await body(req);
  if (typeof b?.id !== "string") return json({ error: "id required" }, 400);
  if (b.close === true) return (await customerClose(u.id, b.id)) ? json({ ok: true }) : json({ error: "Ticket not found" }, 404);
  const r = await customerReply(u.id, b.id, typeof b.reply === "string" ? b.reply : "");
  return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
}
