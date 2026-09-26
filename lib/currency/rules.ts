// Admin currency edit rules, shared by the server (/api/admin/currencies) and the demo admin.
import { DEFAULT_CURRENCY, currencyInfo } from "./currencies";
import { isValidRate } from "./money";

export type CurrencySettings = { enabled: boolean; chargeable: boolean; overrideRate: string | null; roundStep: number };
export type CurrencyPatch = { enabled?: boolean; chargeable?: boolean; overrideRate?: string | null; roundStep?: number };

export function applyCurrencyPatch(code: string, cur: CurrencySettings, patch: CurrencyPatch): { ok: true; value: CurrencySettings } | { ok: false; error: string } {
  if (!currencyInfo(code)) return { ok: false, error: "Unknown currency" };
  const next = { ...cur };
  if (patch.enabled !== undefined) {
    if (code === DEFAULT_CURRENCY && !patch.enabled) return { ok: false, error: "USD is the default currency and stays enabled." };
    next.enabled = patch.enabled;
    if (!next.enabled) next.chargeable = false; // cannot charge a hidden currency
  }
  if (patch.chargeable !== undefined) {
    if (code === DEFAULT_CURRENCY && !patch.chargeable) return { ok: false, error: "USD is the fallback charge currency and stays chargeable." };
    next.chargeable = patch.chargeable;
    if (next.chargeable) next.enabled = true;
  }
  if (patch.overrideRate !== undefined) {
    const v = patch.overrideRate?.trim() ?? "";
    if (v && code === DEFAULT_CURRENCY) return { ok: false, error: "USD is the rate base (always 1)." };
    if (v && !isValidRate(v)) return { ok: false, error: "Override must be a positive number, up to 12 decimals." };
    next.overrideRate = v || null;
  }
  if (patch.roundStep !== undefined) {
    if (!Number.isInteger(patch.roundStep) || patch.roundStep < 1 || patch.roundStep > 100_000) return { ok: false, error: "Rounding step must be a whole number of minor units (1–100000)." };
    next.roundStep = patch.roundStep;
  }
  return { ok: true, value: next };
}
