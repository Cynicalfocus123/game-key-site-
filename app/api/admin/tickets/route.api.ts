import { isTicketStatus } from "@/lib/tickets";
import { hitLimit } from "@/lib/server/rate-limit";
import { adminReply, adminSetStatus, adminThread, listAllTickets } from "@/lib/server/tickets";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// GET → { tickets } all customers (newest reply first). GET ?id= → { ticket } with messages and customer. Opening changes nothing.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "tickets");
  if ("error" in r) return r.error;
  const id = new URL(req.url).searchParams.get("id");
  if (id) { const t = await adminThread(id); return t ? json({ ticket: t }) : json({ error: "Ticket not found" }, 404); }
  return json({ tickets: await listAllTickets() });
}

// PATCH { id, reply } → support reply (status answered, customer unread, email). PATCH { id, status } → set status.
// 120 writes / min per admin (app_rate_limit key ticket-admin:).
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "tickets");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  if (typeof b?.id !== "string") return json({ error: "id required" }, 400);
  if (!(await hitLimit(`ticket-admin:${r.user.id}`, 120, 60_000))) return json({ error: "Too many changes. Wait a minute and try again." }, 429);
  if ("status" in b) {
    if (!isTicketStatus(b.status)) return json({ error: "Unknown status" }, 400);
    return (await adminSetStatus(b.id, b.status)) ? json({ ok: true }) : json({ error: "Ticket not found" }, 404);
  }
  const res = await adminReply(r.user.id, b.id, typeof b.reply === "string" ? b.reply : "");
  return res.ok ? json({ ok: true }) : json({ error: res.error }, res.status);
}
