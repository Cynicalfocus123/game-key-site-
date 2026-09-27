import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { checkBody, checkNewTicket, type NewTicket, type Ticket, type TicketCategory, type TicketMessage, type TicketStatus, type TicketThread } from "@/lib/tickets";
import { db } from "./db";
import { orderItems, orderKey, orders, ticket, ticketMessage, user } from "./db/schema";

const keyItem = alias(orderItems, "key_item");
const select = { t: ticket, orderNumber: orders.number, keyName: keyItem.name, keyRevealedAt: orderKey.revealedAt, email: user.email, name: user.name };
type Row = { t: typeof ticket.$inferSelect; orderNumber: string | null; keyName: string | null; keyRevealedAt: Date | null; email: string | null; name: string | null };
export const toTicket = ({ t, ...x }: Row, admin = false): Ticket => ({
  id: t.id, number: t.number, category: t.category as TicketCategory, subject: t.subject, status: t.status as TicketStatus,
  orderId: t.orderId, orderNumber: x.orderNumber, keyId: t.keyId, keyName: x.keyName, keyRevealedAt: x.keyRevealedAt?.toISOString() ?? null,
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

// Order and key must belong to the customer. A key sets its own order.
export async function createTicket(userId: string, input: Partial<NewTicket>): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const error = checkNewTicket(input); if (error) return { ok: false, error, status: 400 };
  let orderId = typeof input.orderId === "string" && input.orderId ? input.orderId : null;
  const keyId = typeof input.keyId === "string" && input.keyId ? input.keyId : null;
  if (keyId) {
    const [k] = await db.select({ orderId: orderItems.orderId }).from(orderKey).innerJoin(orderItems, eq(orderItems.id, orderKey.orderItemId)).where(and(eq(orderKey.id, keyId), eq(orderKey.userId, userId))).limit(1);
    if (!k) return { ok: false, error: "Key not found", status: 404 };
    orderId = k.orderId;
  } else if (orderId) {
    const [o] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
    if (!o) return { ok: false, error: "Order not found", status: 404 };
  }
  const id = crypto.randomUUID(); const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(ticket).values({ id, userId, category: input.category!, subject: input.subject!.trim(), orderId, keyId, lastReplyAt: now, lastReplyBy: "customer", createdAt: now });
    await tx.insert(ticketMessage).values({ id: crypto.randomUUID(), ticketId: id, authorId: userId, fromSupport: false, body: input.message!.trim(), createdAt: now });
  });
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
