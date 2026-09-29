import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { categoryLabel, checkBody, checkNewTicket, cleanOrderRef, type NewTicket, type Ticket, type TicketCategory, type TicketMessage, type TicketStatus, type TicketThread } from "@/lib/tickets";
import { db } from "./db";
import { sendTemplate } from "./email";
import { orderItems, orderKey, orders, ticket, ticketMessage, user } from "./db/schema";

const keyItem = alias(orderItems, "key_item");
const select = { t: ticket, orderNumber: orders.number, keyName: keyItem.name, keyRevealedAt: orderKey.revealedAt, email: user.email, name: user.name };
type Row = { t: typeof ticket.$inferSelect; orderNumber: string | null; keyName: string | null; keyRevealedAt: Date | null; email: string | null; name: string | null };
export const toTicket = ({ t, ...x }: Row, admin = false): Ticket => ({
  id: t.id, number: t.number, category: t.category as TicketCategory, subject: t.subject, status: t.status as TicketStatus,
  orderId: t.orderId, orderNumber: x.orderNumber, orderRef: t.orderRef, keyId: t.keyId, keyName: x.keyName, keyRevealedAt: x.keyRevealedAt?.toISOString() ?? null,
  customerUnread: t.customerUnread, lastReplyAt: t.lastReplyAt.toISOString(), lastReplyBy: t.lastReplyBy as "customer" | "support", createdAt: t.createdAt.toISOString(),
  ...(admin ? { customerEmail: x.email ?? "Deleted user", customerName: x.name ?? "" } : {}),
});
export const ticketBase = () => db.select(select).from(ticket).leftJoin(orders, eq(orders.id, ticket.orderId)).leftJoin(orderKey, eq(orderKey.id, ticket.keyId))
  .leftJoin(keyItem, eq(keyItem.id, orderKey.orderItemId)).leftJoin(user, eq(user.id, ticket.userId));
export async function ticketMessages(ticketId: string, customerName: string): Promise<TicketMessage[]> {
  const rows = await db.select().from(ticketMessage).where(eq(ticketMessage.ticketId, ticketId)).orderBy(asc(ticketMessage.createdAt));
  return rows.map((m) => ({ id: m.id, fromSupport: m.fromSupport, author: m.fromSupport ? "CoreCart support" : customerName, body: m.body, createdAt: m.createdAt.toISOString() }));
}

export async function listTickets(userId: string) {
  return (await ticketBase().where(eq(ticket.userId, userId)).orderBy(desc(ticket.lastReplyAt))).map((r) => toTicket(r));
}
export async function unreadTickets(userId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(ticket).where(and(eq(ticket.userId, userId), eq(ticket.customerUnread, true)));
  return Number(r?.n ?? 0);
}
// Opening the thread marks support replies as read.
export async function getThread(userId: string, id: string): Promise<TicketThread | null> {
  const [r] = await ticketBase().where(and(eq(ticket.id, id), eq(ticket.userId, userId))).limit(1);
  if (!r) return null;
  if (r.t.customerUnread) await db.update(ticket).set({ customerUnread: false }).where(eq(ticket.id, id));
  return { ...toTicket(r), customerUnread: false, messages: await ticketMessages(id, r.name ?? "") };
}

// Key (from "Report a problem") must belong to the customer and sets its order. A typed order number that matches one of the customer's orders links it (order_id);
// any other text is kept as typed in order_ref for the admin.
// Email excerpt of a message (the full thread is on the ticket page).
const excerpt = (body: string) => { const t = body.trim(); return t.length > 600 ? `${t.slice(0, 600)}…` : t; };
export async function createTicket(userId: string, input: Partial<NewTicket>): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const error = checkNewTicket(input); if (error) return { ok: false, error, status: 400 };
  let orderRef = cleanOrderRef(input.orderRef) || null; let orderId: string | null = null;
  const keyId = typeof input.keyId === "string" && input.keyId ? input.keyId : null;
  if (keyId) {
    const [k] = await db.select({ orderId: orderItems.orderId, number: orders.number }).from(orderKey).innerJoin(orderItems, eq(orderItems.id, orderKey.orderItemId)).innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderKey.id, keyId), eq(orderKey.userId, userId))).limit(1);
    if (!k) return { ok: false, error: "Key not found", status: 404 };
    orderRef ??= k.number; if (orderRef === k.number) orderId = k.orderId;
  }
  if (orderRef && !orderId) {
    const [o] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.number, orderRef), eq(orders.userId, userId))).limit(1);
    orderId = o?.id ?? null;
  }
  const id = crypto.randomUUID(); const now = new Date();
  const number = await db.transaction(async (tx) => {
    const [t] = await tx.insert(ticket).values({ id, userId, category: input.category!, subject: categoryLabel(input.category!), orderId, orderRef, keyId, lastReplyAt: now, lastReplyBy: "customer", createdAt: now }).returning({ number: ticket.number });
    await tx.insert(ticketMessage).values({ id: crypto.randomUUID(), ticketId: id, authorId: userId, fromSupport: false, body: input.message!.trim(), createdAt: now });
    return t.number;
  });
  const [u] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  await sendTemplate(u?.email, "ticketCreated", { name: u?.name ?? "", number, subject: categoryLabel(input.category!), excerpt: excerpt(input.message!), ticketId: id });
  return { ok: true, id };
}

// Customer reply: always makes the ticket open again (also a closed one).
export async function customerReply(userId: string, id: string, body: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const error = checkBody(body); if (error) return { ok: false, error, status: 400 };
  const [t] = await db.select({ id: ticket.id }).from(ticket).where(and(eq(ticket.id, id), eq(ticket.userId, userId))).limit(1);
  if (!t) return { ok: false, error: "Ticket not found", status: 404 };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(ticketMessage).values({ id: crypto.randomUUID(), ticketId: id, authorId: userId, fromSupport: false, body: body.trim(), createdAt: now });
    await tx.update(ticket).set({ status: "open", lastReplyAt: now, lastReplyBy: "customer" }).where(eq(ticket.id, id));
  });
  return { ok: true };
}
export async function customerClose(userId: string, id: string) {
  const r = await db.update(ticket).set({ status: "closed" }).where(and(eq(ticket.id, id), eq(ticket.userId, userId))).returning({ id: ticket.id });
  return r.length > 0;
}

// Admin (Handoff v8 C11, 4b). Admin reply → answered + customer_unread + email (terminal without a Resend key). Opening a thread as admin changes nothing.
export async function listAllTickets() {
  return (await ticketBase().orderBy(desc(ticket.lastReplyAt)).limit(1000)).map((r) => toTicket(r, true));
}
export async function adminThread(id: string): Promise<TicketThread | null> {
  const [r] = await ticketBase().where(eq(ticket.id, id)).limit(1);
  return r ? { ...toTicket(r, true), messages: await ticketMessages(id, r.name ?? "") } : null;
}
export async function adminReply(adminId: string, id: string, body: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const error = checkBody(body); if (error) return { ok: false, error, status: 400 };
  const [r] = await ticketBase().where(eq(ticket.id, id)).limit(1);
  if (!r) return { ok: false, error: "Ticket not found", status: 404 };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(ticketMessage).values({ id: crypto.randomUUID(), ticketId: id, authorId: adminId, fromSupport: true, body: body.trim(), createdAt: now });
    await tx.update(ticket).set({ status: "answered", customerUnread: true, lastReplyAt: now, lastReplyBy: "support" }).where(eq(ticket.id, id));
  });
  await sendTemplate(r.email, "ticketReply", { name: r.name ?? "", number: r.t.number, subject: r.t.subject, excerpt: excerpt(body), ticketId: id });
  return { ok: true };
}
export async function adminSetStatus(id: string, status: TicketStatus) {
  const r = await db.update(ticket).set({ status }).where(eq(ticket.id, id)).returning({ id: ticket.id });
  return r.length > 0;
}
