import { reasonOk, SELL_ERRORS, SELLER_ADMIN_LIMIT, SELLER_TABS, type SellerAction, type SellerTab } from "@/lib/sellers";
import { hitLimit } from "@/lib/server/rate-limit";
import { adminSellerDetail, adminSellerList, sellerDecision } from "@/lib/server/sellers";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const ACTIONS: SellerAction[] = ["approve", "reject", "blacklist", "unblacklist"];
// T3 (section "sellers"): GET ?tab=&q= → { counts, rows }; GET ?id= → { seller } (everything incl. ID number + file list, matches, history).
export async function GET(req: Request) {
  const r = await requireAdmin(req, "sellers");
  if ("error" in r) return r.error;
  const p = new URL(req.url).searchParams; const id = p.get("id");
  if (id) { const s = await adminSellerDetail(id); return s ? json({ seller: s }) : json({ error: SELL_ERRORS.notFound }, 404); }
  const tab = SELLER_TABS.some((t) => t.id === p.get("tab")) ? p.get("tab") as SellerTab : "pending";
  return json(await adminSellerList(tab, p.get("q") ?? ""));
}

// PATCH { id, action: approve | reject | blacklist | unblacklist, reason } (reason required except approve). Audited in the history.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req, "sellers");
  if ("error" in r) return r.error;
  let b: Record<string, unknown> | null = null; try { b = await req.json(); } catch { /* bad body */ }
  const action = b?.action as SellerAction;
  if (typeof b?.id !== "string" || !ACTIONS.includes(action)) return json({ error: "id and action required" }, 400);
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (action !== "approve" && !reasonOk(reason)) return json({ error: SELL_ERRORS.reason }, 400);
  if (!(await hitLimit(`sellers:${r.user.id}`, SELLER_ADMIN_LIMIT.max, SELLER_ADMIN_LIMIT.windowMs))) return json({ error: "Too many changes. Wait a minute." }, 429);
  const res = await sellerDecision(r.user.id, b.id, action, reason, new URL(req.url).origin);
  return res.ok ? json({ ok: true }) : json({ error: res.error }, res.status);
}
