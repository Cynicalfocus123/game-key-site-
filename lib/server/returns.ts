import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { checkNewReturn, checkStatusChange, eligibility, NOT_ELIGIBLE, returnNumber, type NewReturn, type ReturnReason, type ReturnRequest, type ReturnStatus } from "@/lib/returns";
import { emailMoney } from "@/lib/emails";
import { paymentLabel } from "@/lib/orders";
import { db } from "./db";
import { sendTemplate } from "./email";
import { orderItems, orderKey, orders, returnRequest, user } from "./db/schema";

const select = { r: returnRequest, orderNumber: orders.number, itemName: orderItems.name, kind: orderItems.kind, platform: orderItems.platform, email: user.email };
type Row = { r: typeof returnRequest.$inferSelect; orderNumber: string; itemName: string; kind: string; platform: string | null; email: string | null };
const toReturn = ({ r, ...x }: Row, admin = false): ReturnRequest => ({
  id: r.id, number: r.number, orderId: r.orderId, orderNumber: x.orderNumber, orderItemId: r.orderItemId, itemName: x.itemName, kind: x.kind, platform: x.platform,
  quantity: r.quantity, reason: r.reason as ReturnReason, message: r.message, status: r.status as ReturnStatus, adminNote: r.adminNote,
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), ...(admin ? { customerEmail: x.email ?? "Deleted user" } : {}),
});
const base = () => db.select(select).from(returnRequest).innerJoin(orders, eq(orders.id, returnRequest.orderId)).innerJoin(orderItems, eq(orderItems.id, returnRequest.orderItemId)).leftJoin(user, eq(user.id, returnRequest.userId));

export async function listReturns(userId: string) {
  return (await base().where(eq(returnRequest.userId, userId)).orderBy(desc(returnRequest.createdAt))).map((r) => toReturn(r));
}
export async function listAllReturns() {
  return (await base().orderBy(desc(returnRequest.createdAt)).limit(1000)).map((r) => toReturn(r, true));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Units of a line held by returns that are not rejected.
const heldUnits = async (tx: Tx, itemId: string) => Number((await tx.select({ n: sql<number>`coalesce(sum(${returnRequest.quantity}), 0)` }).from(returnRequest)
  .where(and(eq(returnRequest.orderItemId, itemId), ne(returnRequest.status, "rejected"))))[0]?.n ?? 0);
const keyCounts = async (tx: Tx, itemId: string) => {
  const [c] = await tx.select({ all: sql<number>`count(*)`, unrevealed: sql<number>`count(*) filter (where ${orderKey.revealedAt} is null)` }).from(orderKey).where(eq(orderKey.orderItemId, itemId));
  return { keyCount: Number(c?.all ?? 0), unrevealedKeys: Number(c?.unrevealed ?? 0) };
};

// The order line row is locked (FOR UPDATE) so two parallel requests cannot both take the same units.
export async function createReturn(userId: string, input: Partial<NewReturn>): Promise<{ ok: true; ret: ReturnRequest } | { ok: false; error: string; status: number }> {
  if (typeof input.orderItemId !== "string") return { ok: false, error: "orderItemId required", status: 400 };
  const itemId = input.orderItemId;
  const res = await db.transaction(async (tx) => {
    const [line] = await tx.select({ item: orderItems, order: orders }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.id, itemId), eq(orders.userId, userId))).for("update");
    if (!line) return { ok: false as const, error: "Order item not found", status: 404 };
    const orderCreatedAt = line.order.createdAt.toISOString();
    const e = eligibility({ kind: line.item.kind, quantity: line.item.quantity, orderStatus: line.order.status, orderCreatedAt, heldUnits: await heldUnits(tx, itemId), ...(await keyCounts(tx, itemId)) });
    if (!e.ok) return { ok: false as const, error: NOT_ELIGIBLE[e.why], status: 409 };
    const error = checkNewReturn(input, line.item.kind, orderCreatedAt, e.max);
    if (error) return { ok: false as const, error, status: 400 };
    const id = crypto.randomUUID();
    await tx.insert(returnRequest).values({ id, number: returnNumber(), userId, orderId: line.order.id, orderItemId: itemId, quantity: input.quantity!, reason: input.reason!, message: (input.message ?? "").trim() });
    return { ok: true as const, id };
  });
  if (!res.ok) return res;
  const [row] = await base().where(eq(returnRequest.id, res.id)).limit(1);
  await mailReturn(res.id);
  return { ok: true, ret: toReturn(row) };
}

// Email task: requested → "received", approved / rejected → answer (with the admin note), refunded → "refund issued" (amount = line price × units).
async function mailReturn(id: string) {
  try {
    const [x] = await db.select({ r: returnRequest, number: orders.number, currency: orders.currency, method: orders.paymentMethod, item: orderItems.name, unit: orderItems.unitPriceCents, email: user.email, name: user.name })
      .from(returnRequest).innerJoin(orders, eq(orders.id, returnRequest.orderId)).innerJoin(orderItems, eq(orderItems.id, returnRequest.orderItemId)).innerJoin(user, eq(user.id, returnRequest.userId))
      .where(eq(returnRequest.id, id)).limit(1);
    if (!x) return;
    const st = x.r.status;
    if (st === "refunded") await sendTemplate(x.email, "refund", { name: x.name, returnNumber: x.r.number, orderNumber: x.number, item: `${x.item} × ${x.r.quantity}`, amount: emailMoney(x.unit * x.r.quantity, x.currency), to: paymentLabel(x.method) });
    else if (st === "requested" || st === "approved" || st === "rejected")
      await sendTemplate(x.email, "returnUpdate", { name: x.name, state: st === "requested" ? "received" : st, returnNumber: x.r.number, orderNumber: x.number, item: x.item, quantity: x.r.quantity, note: st === "requested" ? null : x.r.adminNote });
  } catch (e) { console.error("[CoreCart email] return", e); }
}

export async function updateReturn(adminId: string, id: string, status: string, note: string | null): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const res = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(returnRequest).where(eq(returnRequest.id, id)).for("update");
    if (!r) return { ok: false as const, error: "Return not found", status: 404 };
    const error = checkStatusChange(r.status as ReturnStatus, status, note);
    if (error) return { ok: false as const, error, status: 400 };
    await tx.update(returnRequest).set({ status, adminNote: note?.trim() || r.adminNote, handledBy: adminId, updatedAt: new Date() }).where(eq(returnRequest.id, id));
    return { ok: true as const };
  });
  if (res.ok) await mailReturn(id);
  return res;
}

// Key reveal guard: a unit held by a return cannot be shown. Allowed while unrevealed keys of the line > held units.
export async function revealBlocked(userId: string, keyId: string) {
  const [k] = await db.select({ itemId: orderKey.orderItemId }).from(orderKey).where(and(eq(orderKey.id, keyId), eq(orderKey.userId, userId), isNull(orderKey.revealedAt))).limit(1);
  if (!k) return false; // already revealed (showing again is fine) or not found (handled by the caller)
  return db.transaction(async (tx) => (await keyCounts(tx, k.itemId)).unrevealedKeys - (await heldUnits(tx, k.itemId)) < 1);
}
