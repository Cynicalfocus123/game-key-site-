import { checkNewGiftCards } from "@/lib/gift-cards";
import { createGiftCards, listGiftCards, setGiftCardDisabled } from "@/lib/server/gift-cards";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const body = async (req: Request) => { try { return await req.json() as Record<string, unknown>; } catch { return null; } };

// GET → { cards } newest first (last 4 only, never the full code).
export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  return json({ cards: await listGiftCards() });
}

// POST { amountMinor (THB satang), count, expiresAt?, note? } → { created: [{ id, code }] }. Full codes are returned only here.
export async function POST(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const b = await body(req);
  const input = { amountMinor: b?.amountMinor as number, count: b?.count as number, expiresAt: (b?.expiresAt ?? null) as string | null, note: (b?.note ?? null) as string | null };
  const error = checkNewGiftCards(input);
  if (error) return json({ error }, 400);
  return json({ created: await createGiftCards(r.user.id, input) });
}

// PATCH { id, disabled } → disable / enable a card that is not redeemed yet.
export async function PATCH(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const b = await body(req);
  if (typeof b?.id !== "string" || typeof b.disabled !== "boolean") return json({ error: "id and disabled required" }, 400);
  return (await setGiftCardDisabled(b.id, b.disabled)) ? json({ ok: true }) : json({ error: "Gift card not found or already redeemed" }, 400);
}
