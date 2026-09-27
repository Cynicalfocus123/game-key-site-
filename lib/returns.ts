// Returns & Orders (Handoff v14 task 2): shared rules for the customer form, the demo store and the server.
// One return request = one order line + quantity. Refund is a manual admin note until payments exist.
export type ReturnStatus = "requested" | "approved" | "rejected" | "refunded";
export type ReturnReason = "damaged" | "wrong_item" | "not_as_described" | "changed_mind" | "key_unused" | "other";
export type ReturnRequest = {
  id: string; number: string; orderId: string; orderNumber: string; orderItemId: string; itemName: string; kind: string; platform: string | null;
  quantity: number; reason: ReturnReason; message: string; status: ReturnStatus; adminNote: string | null; createdAt: string; updatedAt: string;
  customerEmail?: string; // admin list only
};
export type NewReturn = { orderItemId: string; quantity: number; reason: ReturnReason; message: string };

export const CHANGE_MIND_DAYS = 14;
export const MESSAGE_MAX = 1000;
export const NOTE_MAX = 500;
const REASONS: { id: ReturnReason; label: string; kinds: ("game_key" | "hardware")[] }[] = [
  { id: "key_unused", label: "Key not revealed – no longer needed", kinds: ["game_key"] },
  { id: "damaged", label: "Damaged", kinds: ["hardware"] },
  { id: "wrong_item", label: "Wrong item", kinds: ["game_key", "hardware"] },
  { id: "not_as_described", label: "Not as described", kinds: ["hardware"] },
  { id: "changed_mind", label: `Changed my mind (within ${CHANGE_MIND_DAYS} days)`, kinds: ["hardware"] },
  { id: "other", label: "Other", kinds: ["game_key", "hardware"] },
];
export const reasonLabel = (r: string) => REASONS.find((x) => x.id === r)?.label ?? r;
const kindOf = (kind: string) => (kind === "game_key" ? "game_key" : "hardware");
const daysSince = (iso: string, now: number) => (now - new Date(iso).getTime()) / 86400_000;
// Reasons offered for a line. "Changed my mind" only while the order is inside the 14-day window.
export const reasonsFor = (kind: string, orderCreatedAt: string, now = Date.now()) =>
  REASONS.filter((r) => r.kinds.includes(kindOf(kind)) && (r.id !== "changed_mind" || daysSince(orderCreatedAt, now) <= CHANGE_MIND_DAYS));

export const STATUS_LABEL: Record<ReturnStatus, string> = { requested: "Requested", approved: "Approved", rejected: "Rejected", refunded: "Refunded" };
export const STATUS_CHIP: Record<ReturnStatus, string> = { requested: "chip-amber", approved: "chip-blue", rejected: "chip-grey", refunded: "chip-green" };
// Admin moves: Requested → Approved | Rejected; Approved → Refunded | Rejected. Rejected and Refunded are final.
export const NEXT_STATUS: Record<ReturnStatus, ReturnStatus[]> = { requested: ["approved", "rejected"], approved: ["refunded", "rejected"], rejected: [], refunded: [] };
// Units that still count against the line (a rejected request frees them again).
export const holdsUnits = (s: ReturnStatus) => s !== "rejected";

// What the customer may return from one order line.
// Keys: only units whose code was never shown. Hardware: any unit not already in a return. Refunded / cancelled orders: nothing.
export type LineFacts = { kind: string; quantity: number; orderStatus: string; orderCreatedAt: string; unrevealedKeys: number; keyCount: number; heldUnits: number };
export type Eligibility = { ok: true; max: number } | { ok: false; why: "order" | "revealed" | "requested" | "no_keys" };
export function eligibility(f: LineFacts): Eligibility {
  if (!["paid", "completed"].includes(f.orderStatus)) return { ok: false, why: "order" };
  if (kindOf(f.kind) === "game_key") {
    if (!f.keyCount) return { ok: false, why: "no_keys" };
    const max = f.unrevealedKeys - f.heldUnits;
    if (max > 0) return { ok: true, max };
    return { ok: false, why: f.unrevealedKeys > 0 ? "requested" : "revealed" };
  }
  const max = f.quantity - f.heldUnits;
  return max > 0 ? { ok: true, max } : { ok: false, why: "requested" };
}
export const NOT_ELIGIBLE: Record<Exclude<Eligibility, { ok: true }>["why"], string> = {
  order: "This order cannot be returned.",
  revealed: "Not eligible for return: the key was shown.",
  requested: "A return is already requested for this item.",
  no_keys: "Keys are not delivered yet.",
};

export const RETURN_HOLD = "This key is part of a return request, so it cannot be shown.";

// Form check (client, demo and server). Returns an error message or null.
export function checkNewReturn(input: Partial<NewReturn>, kind: string, orderCreatedAt: string, max: number, now = Date.now()): string | null {
  if (!Number.isInteger(input.quantity) || (input.quantity ?? 0) < 1) return "Choose how many to return.";
  if ((input.quantity ?? 0) > max) return max === 1 ? "You can return 1 unit of this item." : `You can return up to ${max} units of this item.`;
  if (!reasonsFor(kind, orderCreatedAt, now).some((r) => r.id === input.reason)) return "Choose a reason.";
  const msg = (input.message ?? "").trim();
  if (input.reason === "other" && !msg) return "Tell us more about the problem.";
  if (msg.length > MESSAGE_MAX) return `Message is too long (max ${MESSAGE_MAX} characters).`;
  return null;
}
// Admin status change check. Rejecting needs a note the customer can read.
export function checkStatusChange(from: ReturnStatus, to: string, note: string | null | undefined): string | null {
  if (!NEXT_STATUS[from].includes(to as ReturnStatus)) return `Cannot change a ${STATUS_LABEL[from].toLowerCase()} return to ${to}.`;
  if (to === "rejected" && !(note ?? "").trim()) return "Add a note that tells the customer why.";
  if ((note ?? "").length > NOTE_MAX) return `Note is too long (max ${NOTE_MAX} characters).`;
  return null;
}
const RT_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const returnNumber = () => `RT-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => RT_CHARS[b % 32]).join("")}`;
