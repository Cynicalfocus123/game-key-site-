import { adminCurrencies, updateCurrency } from "@/lib/server/rates";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  return json(await adminCurrencies());
}

// Body: { code, enabled?, chargeable?, overrideRate?: string | null, roundStep? }
export async function PATCH(req: Request) {
  const r = await requireAdmin(req);
  if ("error" in r) return r.error;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.code !== "string") return json({ error: "Missing currency code" }, 400);
  const pick = <T,>(k: string, ok: (v: unknown) => boolean) => (k in body ? (ok(body[k]) ? body[k] as T : null) : undefined);
  const enabled = pick<boolean>("enabled", (v) => typeof v === "boolean");
  const chargeable = pick<boolean>("chargeable", (v) => typeof v === "boolean");
  const roundStep = pick<number>("roundStep", (v) => typeof v === "number");
  const overrideRate = "overrideRate" in body ? (body.overrideRate === null || typeof body.overrideRate === "string" ? body.overrideRate as string | null : false) : undefined;
  if (enabled === null || chargeable === null || roundStep === null || overrideRate === false) return json({ error: "Invalid field type" }, 400);
  const res = await updateCurrency(body.code, { enabled, chargeable, roundStep, overrideRate });
  return res.ok ? json({ ok: true }) : json({ error: res.error }, 400);
}
