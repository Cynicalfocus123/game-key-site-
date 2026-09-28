// Support tickets (Handoff v8 C9–C11, Handoff v15 task 3): shared by the customer pages, the admin pages, the demo store and the server.
// New ticket = Subject (one of 4, id in category, label in subject) + Order number (typed text, order_ref) + Description.
// No attachments. Status: open (waiting for support) → answered (support replied) → closed. A customer reply (also on a closed ticket) makes it open again.
export type TicketStatus = "open" | "answered" | "closed";
export type TicketCategory = "order_issue" | "return_refund" | "general_support" | "questions";
export type TicketMessage = { id: string; fromSupport: boolean; author: string; body: string; createdAt: string };
export type Ticket = {
  id: string; number: number; category: TicketCategory; subject: string; status: TicketStatus;
  orderId: string | null; orderNumber: string | null; orderRef: string | null; keyId: string | null; keyName: string | null; keyRevealedAt: string | null;
  customerUnread: boolean; lastReplyAt: string; lastReplyBy: "customer" | "support"; createdAt: string;
  customerEmail?: string; customerName?: string; // admin only
};
export type TicketThread = Ticket & { messages: TicketMessage[] };
// keyId: hidden, only from "Report a problem" on a key (admin sees the key + revealed time).
export type NewTicket = { category: TicketCategory; orderRef: string; message: string; keyId: string | null };

// needsOrder: Order number required.
export const CATEGORIES: { id: TicketCategory; label: string; needsOrder: boolean }[] = [
  { id: "order_issue", label: "Order issue", needsOrder: true }, { id: "return_refund", label: "Return/refund", needsOrder: true },
  { id: "general_support", label: "General support", needsOrder: false }, { id: "questions", label: "Questions", needsOrder: false },
];
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c;
export const TICKET_STATUS: Record<TicketStatus, { label: string; chip: string }> = {
  open: { label: "Open", chip: "chip-amber" }, answered: { label: "Answered", chip: "chip-green" }, closed: { label: "Closed", chip: "chip" },
};
export const ORDER_REF_MAX = 40;
// Upper-case, no spaces. Accepts any order-like text (CC-12345678); the server links it to the customer's order when it matches.
export const cleanOrderRef = (s: unknown) => (typeof s === "string" ? s : "").trim().toUpperCase().replace(/\s+/g, "");
export const ORDER_REF_RE = /^[A-Z0-9][A-Z0-9-]*$/;
// Shown order: the typed number, else the linked order (tickets from before order_ref).
export const orderShown = (t: Pick<Ticket, "orderRef" | "orderNumber">) => t.orderRef ?? t.orderNumber;
export const BODY_MAX = 4000;
// New tickets per customer: 5 per hour (server: rate_limit table, demo: this browser).
export const NEW_TICKET_LIMIT = { max: 5, windowMs: 3600_000 };
export const TICKET_ERRORS = { limit: "You opened several tickets in the last hour. Add to an open ticket instead, or try again later." };
export const ticketNo = (n: number) => `#${n}`;

export function checkNewTicket(t: Partial<NewTicket>): string | null {
  const c = CATEGORIES.find((x) => x.id === t.category);
  if (!c) return "Choose a subject.";
  const ref = cleanOrderRef(t.orderRef);
  if (!ref && c.needsOrder && !t.keyId) return "Enter your order number.";
  if (ref && (ref.length > ORDER_REF_MAX || !ORDER_REF_RE.test(ref))) return "Enter a valid order number, e.g. CC-12345678.";
  return checkBody(t.message, "description");
}
// word: "message" for replies, "description" for a new ticket.
export function checkBody(body: string | undefined | null, word = "message"): string | null {
  const b = (body ?? "").trim();
  if (!b) return `Write a ${word}.`;
  if (b.length > BODY_MAX) return `${word[0].toUpperCase()}${word.slice(1)} is too long (max ${BODY_MAX} characters).`;
  return null;
}
// Admin status select (4b): any status; replies set it automatically.
export const isTicketStatus = (s: unknown): s is TicketStatus => s === "open" || s === "answered" || s === "closed";
