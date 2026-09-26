import { BASE_CURRENCY, CURRENCIES, DEFAULT_CHARGEABLE, DEFAULT_DISABLED, RATE_SOURCE, currencyForCountry, guessCountry } from "@/lib/currency/currencies";
import { rateString, type CurrencyData } from "@/lib/currency/money";
import { applyCurrencyPatch, type CurrencyPatch, type CurrencySettings } from "@/lib/currency/rules";
import fallback from "@/lib/currency/fallback-rates.json";
import type { AdminCurrency, AdminCurrencyState, Result } from "./types";

// GitHub Pages demo: rates come from rates.json written at build time (scripts/fetch-rates.mjs), falling back to the
// committed file. Demo admin settings and "Update rates now" results live in this browser's localStorage only.
type RateFile = { updatedAt: string | null; rates: Record<string, number | string> };
type Store = { settings: Record<string, Partial<CurrencySettings> & { updatedAt?: string }>; fetched?: RateFile; lastAttemptAt?: string; lastSuccessAt?: string; lastError?: string | null };
const KEY = "corecart-demo-currency-v1";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

function load(): Store { try { const raw = localStorage.getItem(KEY); return raw ? { settings: {}, ...JSON.parse(raw) } : { settings: {} }; } catch { return { settings: {} }; } }
function save(s: Store) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

let buildRates: Promise<RateFile> | null = null;
const loadBuildRates = () => (buildRates ??= fetch(`${base}/rates.json`, { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() as Promise<RateFile> : Promise.reject(new Error(String(r.status)))))
  .catch(() => fallback as RateFile));

async function state(): Promise<AdminCurrencyState> {
  const s = load(); const built = await loadBuildRates();
  const useFetched = s.fetched?.updatedAt && (!built.updatedAt || s.fetched.updatedAt > built.updatedAt);
  const src = useFetched ? s.fetched! : built;
  const currencies: AdminCurrency[] = CURRENCIES.map((c) => {
    const set = s.settings[c.code] ?? {}; const raw = src.rates[c.code] ?? (fallback.rates as Record<string, number>)[c.code];
    return {
      ...c, enabled: set.enabled ?? !DEFAULT_DISABLED.includes(c.code), chargeable: set.chargeable ?? DEFAULT_CHARGEABLE.includes(c.code),
      autoRate: raw === undefined ? null : typeof raw === "number" ? rateString(raw) : raw, overrideRate: set.overrideRate ?? null, roundStep: set.roundStep ?? 1,
      rateUpdatedAt: src.updatedAt, updatedAt: set.updatedAt ?? src.updatedAt ?? new Date(0).toISOString(),
    };
  });
  return { currencies, status: { source: RATE_SOURCE, lastAttemptAt: s.lastAttemptAt ?? null, lastSuccessAt: s.lastSuccessAt ?? src.updatedAt, providerUpdatedAt: src.updatedAt, lastError: s.lastError ?? null } };
}

export async function demoCurrencies(): Promise<CurrencyData> {
  const { currencies, status } = await state();
  const eff = (c: AdminCurrency) => c.overrideRate ?? c.autoRate ?? "1";
  const b = currencies.find((c) => c.code === BASE_CURRENCY)!;
  const list = currencies.filter((c) => c.enabled).map((c) => ({ code: c.code, name: c.name, symbol: c.symbol, decimals: c.decimals, rate: eff(c), roundStep: c.roundStep, chargeable: c.chargeable }));
  let suggested: string | null = null;
  try { suggested = currencyForCountry(guessCountry(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages)) ?? null; } catch { /* no Intl */ }
  return { base: { code: b.code, decimals: b.decimals, rate: eff(b) }, currencies: list, updatedAt: status.lastSuccessAt, suggested: suggested && list.some((c) => c.code === suggested) ? suggested : null };
}

export async function demoAdminCurrencies(): Promise<AdminCurrencyState> { return state(); }

export async function demoUpdateCurrency(code: string, patch: CurrencyPatch): Promise<Result> {
  const cur = (await state()).currencies.find((c) => c.code === code);
  if (!cur) return { ok: false, error: "Unknown currency" };
  const res = applyCurrencyPatch(code, cur, patch);
  if (!res.ok) return res;
  const s = load(); s.settings[code] = { ...res.value, updatedAt: new Date().toISOString() }; save(s);
  return { ok: true };
}

// Browser fetch straight from the rate source (it allows CORS). Failure keeps the last good rates.
export async function demoRefreshRates(): Promise<Result> {
  const s = load(); s.lastAttemptAt = new Date().toISOString(); save(s);
  try {
    const res = await fetch(RATE_SOURCE, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const body = await res.json() as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
    if (!res.ok || body.result !== "success" || !body.rates?.USD || !body.rates[BASE_CURRENCY]) throw new Error("Rate source returned an error");
    const rates: Record<string, number> = {};
    for (const c of CURRENCIES) { const v = body.rates[c.code]; if (typeof v === "number" && v > 0 && Number.isFinite(v)) rates[c.code] = v; }
    const t = load(); t.fetched = { rates, updatedAt: new Date((body.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString() }; t.lastSuccessAt = new Date().toISOString(); t.lastError = null; save(t);
    return { ok: true };
  } catch (e) {
    const t = load(); t.lastError = e instanceof Error ? e.message : "Fetch failed"; save(t);
    return { ok: false, error: t.lastError };
  }
}
