import { BANK_ERRORS, BANK_WRITE_LIMIT, parseBankSettings } from "@/lib/topup";
import { hitLimit } from "@/lib/server/rate-limit";
import { json, requireAdmin } from "@/lib/server/session";
import { bankHistory, bankSettings, saveBankSettings } from "@/lib/server/topups";

export const dynamic = "force-dynamic";

// Bank transfer details for wallet top-ups (admin section "topups"). GET → { settings, history }.
// PUT { bankName, accountName, accountNumber, swift } → saved + audited (unchanged = no audit row). All three main fields empty = bank
// transfer hidden on the Wallet page ("Coming soon"). Customers may send any currency enabled in Admin → Currencies.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "topups");
  if ("error" in r) return r.error;
  return json({ settings: await bankSettings(), history: await bankHistory() });
}

export async function PUT(req: Request) {
  const r = await requireAdmin(req, "topups");
  if ("error" in r) return r.error;
  if (!(await hitLimit(`bank:${r.user.id}`, BANK_WRITE_LIMIT.max, BANK_WRITE_LIMIT.windowMs))) return json({ error: BANK_ERRORS.limit }, 429);
  const p = parseBankSettings(await req.json().catch(() => null));
  if (typeof p === "string") return json({ error: p }, 400);
  await saveBankSettings(r.user.id, p);
  return json({ settings: await bankSettings(), history: await bankHistory() });
}
