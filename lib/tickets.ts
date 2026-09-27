// Support tickets (Handoff v8 C9–C11, Handoff v14 tasks 3 + 4): shared by the customer pages, the admin pages, the demo store and the server.
// No attachments. Status: open (waiting for support) → answered (support replied) → closed. A customer reply (also on a closed ticket) makes it open again.
export type TicketStatus = "open" | "answered" | "closed";
export type TicketCategory = "order" | "key" | "payment" | "account" | "other";
export type TicketMessage = { id: string; fromSupport: boolean; author: string; body: string; createdAt: string };
export type Ticket = {
  id: string; number: number; category: TicketCategory; subject: string; status: TicketStatus;
  orderId: string | null; orderNumber: string | null; keyId: string | null; keyName: string | null; keyRevealedAt: string | null;
  customerUnread: boolean; lastReplyAt: string; lastReplyBy: "customer" | "support"; createdAt: string;
  customerEmail?: string; customerName?: string; // admin only
};
export type TicketThread = Ticket & { messages: TicketMessage[] };
export type NewTicket = { category: TicketCategory; subject: string; message: string; orderId: string | null; keyId: string | null };

export const CATEGORIES: { id: TicketCategory; label: string }[] = [
  { id: "order", label: "Order problem" }, { id: "key", label: "Key invalid or used" }, { id: "payment", label: "Payment" }, { id: "account", label: "Account" }, { id: "other", label: "Other" },
];
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c;
export const TICKET_STATUS: Record<TicketStatus, { label: string; chip: string }> = {
  open: { label: "Open", chip: "chip-amber" }, answered: { label: "Answered", chip: "chip-green" }, closed: { label: "Closed", chip: "chip" },
};
export const SUBJECT_MAX = 120;
export const BODY_MAX = 4000;
// New tickets per customer: 5 per hour (server: rate_limit table, demo: this browser).
export const NEW_TICKET_LIMIT = { max: 5, windowMs: 3600_000 };
export const TICKET_ERRORS = { limit: "You opened several tickets in the last hour. Add to an open ticket instead, or try again later." };
export const ticketNo = (n: number) => `#${n}`;

export function checkNewTicket(t: Partial<NewTicket>): string | null {
  if (!CATEGORIES.some((c) => c.id === t.category)) return "Choose a category.";
  const subject = (t.subject ?? "").trim();
  if (!subject) return "Enter a subject.";
  if (subject.length > SUBJECT_MAX) return `Subject is too long (max ${SUBJECT_MAX} characters).`;
  return checkBody(t.message);
}
export function checkBody(body: string | undefined | null): string | null {
  const b = (body ?? "").trim();
  if (!b) return "Write a message.";
  if (b.length > BODY_MAX) return `Message is too long (max ${BODY_MAX} characters).`;
  return null;
}
// Admin status select (4b): any status; replies set it automatically.
export const isTicketStatus = (s: unknown): s is TicketStatus => s === "open" || s === "answered" || s === "closed";
