import { asc, eq, sql } from "drizzle-orm";
import { BASE_CURRENCY, CURRENCIES, DEFAULT_CHARGEABLE, DEFAULT_DISABLED, RATE_SOURCE, currencyForCountry } from "@/lib/currency/currencies";
import { rateString, scaleRate, scaleToString, type CurrencyData, type SiteCurrency } from "@/lib/currency/money";
import { applyCurrencyPatch, type CurrencyPatch } from "@/lib/currency/rules";
import fallback from "@/lib/currency/fallback-rates.json";
import { db, dbReady } from "./db";
import { currency, rateStatus } from "./db/schema";

// Server mode rates: stored in the database, refreshed from ExchangeRate-API at most every 12 hours.
// A failed fetch keeps the last good rates and records the error for the admin page. Page loads never wait on a fetch.
const SOURCE_ID = "open.er-api";
const REFRESH_MS = 12 * 3600_000;
const RETRY_MS = 3600_000; // after a failure, try again at most hourly
type Row = typeof currency.$inferSelect;
const g = globalThis as unknown as { __corecartRatesSeeded?: Promise<void>; __corecartRatesInflight?: Promise<RefreshResult> };
export type RefreshResult = { ok: true; updated: number } | { ok: false; error: string };

// First use: insert all 53 currencies with launch defaults and the committed fallback rates.
export function ensureCurrencies() {
  g.__corecartRatesSeeded ??= (async () => {
    await dbReady();
    const now = new Date(fallback.updatedAt);
    await db.insert(currency).values(CURRENCIES.map((c) => ({
      ...c, enabled: !DEFAULT_DISABLED.includes(c.code), chargeable: DEFAULT_CHARGEABLE.includes(c.code),
      autoRate: rateString((fallback.rates as Record<string, number>)[c.code]), rateUpdatedAt: now,
    }))).onConflictDoNothing();
    await db.insert(rateStatus).values({ id: SOURCE_ID }).onConflictDoNothing();
  })().catch((e) => { g.__corecartRatesSeeded = undefined; throw e; });
  return g.__corecartRatesSeeded;
}

// numeric columns come back as "33.380213000000"; trim trailing zeros for display.
const clean = (v: string | null) => (v ? scaleToString(scaleRate(v)) : null);
const effectiveRate = (r: Row) => clean(r.overrideRate ?? r.autoRate);

async function fetchLatest() {
  const res = await fetch(RATE_SOURCE, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Rate source answered HTTP ${res.status}`);
  const body = await res.json() as { result?: string; base_code?: string; rates?: Record<string, number>; time_last_update_unix?: number; "error-type"?: string };
  if (body.result !== "success" || body.base_code !== "USD" || !body.rates) throw new Error(`Rate source error: ${body["error-type"] ?? "bad response"}`);
  const rates: Record<string, string> = {};
  for (const c of CURRENCIES) {
    const v = body.rates[c.code];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e9) rates[c.code] = rateString(v);
  }
  if (!rates.USD || !rates[BASE_CURRENCY]) throw new Error("Rate source is missing USD or THB");
  return { rates, providerUpdatedAt: body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000) : null };
}

// force = admin "Update rates now". Otherwise only one instance claims a due refresh (conditional update on last_attempt_at).
export async function refreshRates(force = false): Promise<RefreshResult> {
  await ensureCurrencies();
  if (g.__corecartRatesInflight) return g.__corecartRatesInflight;
  const run = async (): Promise<RefreshResult> => {
    const claimed = await db.execute(sql`update rate_status set last_attempt_at = now() where id = ${SOURCE_ID} and (${force} or last_attempt_at is null
      or (last_attempt_at < now() - make_interval(secs => ${RETRY_MS / 1000}) and (last_success_at is null or last_success_at < now() - make_interval(secs => ${REFRESH_MS / 1000})))) returning id`);
    if (!rowsOf(claimed).length) return { ok: true, updated: 0 };
    try {
      const { rates, providerUpdatedAt } = await fetchLatest();
      const now = new Date();
      for (const [code, rate] of Object.entries(rates)) await db.update(currency).set({ autoRate: rate, rateUpdatedAt: now }).where(eq(currency.code, code));
      await db.update(rateStatus).set({ lastSuccessAt: now, providerUpdatedAt, lastError: null }).where(eq(rateStatus.id, SOURCE_ID));
      return { ok: true, updated: Object.keys(rates).length };
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 300) : "Unknown error";
      await db.update(rateStatus).set({ lastError: error }).where(eq(rateStatus.id, SOURCE_ID));
      console.error("[CoreCart rates]", error);
      return { ok: false, error };
    }
  };
  g.__corecartRatesInflight = run().finally(() => { g.__corecartRatesInflight = undefined; });
  return g.__corecartRatesInflight;
}
// pg returns { rows }, PGlite returns { rows } too; keep a guard for other drivers.
const rowsOf = (r: unknown) => ((r as { rows?: unknown[] })?.rows ?? (Array.isArray(r) ? r : []));

// Safe to call on every request: returns immediately, refresh (if due) runs in the background.
export const refreshInBackground = () => { refreshRates().catch((e) => console.error("[CoreCart rates]", e)); };

const toSite = (r: Row): SiteCurrency => ({ code: r.code, name: r.name, symbol: r.symbol, decimals: r.decimals, rate: effectiveRate(r) ?? "1", roundStep: r.roundStep, chargeable: r.chargeable });

export async function publicCurrencies(country?: string | null): Promise<CurrencyData> {
  await ensureCurrencies();
  const rows = await db.select().from(currency).orderBy(asc(currency.code));
  const [status] = await db.select().from(rateStatus).limit(1);
  const base = rows.find((r) => r.code === BASE_CURRENCY)!;
  const list = rows.filter((r) => r.enabled && effectiveRate(r)).map(toSite);
  const pick = currencyForCountry(country);
  return {
    base: { code: base.code, decimals: base.decimals, rate: effectiveRate(base) ?? "1" },
    currencies: list,
    updatedAt: (status?.lastSuccessAt ?? base.rateUpdatedAt)?.toISOString() ?? null,
    suggested: pick && list.some((c) => c.code === pick) ? pick : null,
  };
}

export async function adminCurrencies() {
  await ensureCurrencies();
  const rows = await db.select().from(currency).orderBy(asc(currency.code));
  const [status] = await db.select().from(rateStatus).limit(1);
  return {
    currencies: rows.map((r) => ({ ...r, autoRate: clean(r.autoRate), overrideRate: clean(r.overrideRate), rateUpdatedAt: r.rateUpdatedAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString() })),
    status: { source: RATE_SOURCE, lastAttemptAt: status?.lastAttemptAt?.toISOString() ?? null, lastSuccessAt: status?.lastSuccessAt?.toISOString() ?? null, providerUpdatedAt: status?.providerUpdatedAt?.toISOString() ?? null, lastError: status?.lastError ?? null },
  };
}

// Admin edit: same rules as the demo admin (lib/currency/rules.ts), then one row update.
export async function updateCurrency(code: string, patch: CurrencyPatch): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCurrencies();
  const [row] = await db.select().from(currency).where(eq(currency.code, code)).limit(1);
  if (!row) return { ok: false, error: "Unknown currency" };
  const res = applyCurrencyPatch(code, row, patch);
  if (!res.ok) return res;
  await db.update(currency).set({ ...res.value, updatedAt: new Date() }).where(eq(currency.code, code));
  return { ok: true };
}
