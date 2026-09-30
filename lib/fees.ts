// Service fee + sales tax (task 7, wireframe approved 2026-09-30: Claude outputs/wireframes/order-summary-wireframe.png).
// User 2026-09-30: one service fee for all products, set by the admin; tax is added on top of the price, rate set by the admin (per billing
// country, else the default rate); both start OFF and the admin switches them on. Shared by the store, the admin page, the demo and the server.
// Money = THB satang (catalog base). The server computes the charged amounts; the browser numbers are display only.

export type TaxRate = { country: string; rateBp: number }; // basis points: 700 = 7%
export type FeeSettings = {
  feeEnabled: boolean; feePercentBp: number; feeFixedMinor: number; feeMinMinor: number;
  taxEnabled: boolean; taxDefaultBp: number; taxRates: TaxRate[];
};
export type FeeEvent = { at: string; by: string | null; detail: string };
export const FEE_DEFAULTS: FeeSettings = { feeEnabled: false, feePercentBp: 0, feeFixedMinor: 0, feeMinMinor: 0, taxEnabled: false, taxDefaultBp: 0, taxRates: [] };
export const FEE_LIMITS = { percentBp: 2000, fixedMinor: 100_000, taxBp: 3000, rates: 100 }; // fee ≤ 20 % and ≤ ฿1,000; tax ≤ 30 %
export const FEE_WRITE_LIMIT = { max: 30, windowMs: 60_000 };
export const FEE_ERRORS = { bad: "Invalid settings.", percent: "Service fee: 0–20 %.", fixed: "Fixed fee: ฿0–1,000.", min: "Minimum fee: ฿0–1,000.",
  tax: "Tax rate: 0–30 %.", country: "Choose a country for each tax rate.", dup: "Each country can have one tax rate.", tooMany: "Up to 100 country rates.", limit: "Too many changes. Wait a minute and try again." };

const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : NaN);
// Admin input → clean settings or an error. isCountry = known ISO code.
export function parseFeeSettings(input: unknown, isCountry: (c: string) => boolean): FeeSettings | string {
  const o = (input ?? {}) as Record<string, unknown>;
  if (typeof o.feeEnabled !== "boolean" || typeof o.taxEnabled !== "boolean" || !Array.isArray(o.taxRates)) return FEE_ERRORS.bad;
  const pct = int(o.feePercentBp), fixed = int(o.feeFixedMinor), min = int(o.feeMinMinor), def = int(o.taxDefaultBp);
  if (!(pct >= 0 && pct <= FEE_LIMITS.percentBp)) return FEE_ERRORS.percent;
  if (!(fixed >= 0 && fixed <= FEE_LIMITS.fixedMinor)) return FEE_ERRORS.fixed;
  if (!(min >= 0 && min <= FEE_LIMITS.fixedMinor)) return FEE_ERRORS.min;
  if (!(def >= 0 && def <= FEE_LIMITS.taxBp)) return FEE_ERRORS.tax;
  if (o.taxRates.length > FEE_LIMITS.rates) return FEE_ERRORS.tooMany;
  const rates: TaxRate[] = [];
  for (const r of o.taxRates as Record<string, unknown>[]) {
    const country = typeof r?.country === "string" ? r.country.toUpperCase() : ""; const bp = int(r?.rateBp);
    if (!isCountry(country)) return FEE_ERRORS.country;
    if (!(bp >= 0 && bp <= FEE_LIMITS.taxBp)) return FEE_ERRORS.tax;
    if (rates.some((x) => x.country === country)) return FEE_ERRORS.dup;
    rates.push({ country, rateBp: bp });
  }
  return { feeEnabled: o.feeEnabled, feePercentBp: pct, feeFixedMinor: fixed, feeMinMinor: min, taxEnabled: o.taxEnabled, taxDefaultBp: def, taxRates: rates.sort((a, b) => a.country.localeCompare(b.country)) };
}
// Stored JSON (may be old / partial) → settings; anything odd falls back to the defaults (fee + tax off).
export const cleanFeeSettings = (v: unknown): FeeSettings => { const p = parseFeeSettings(v, (c) => /^[A-Z]{2}$/.test(c)); return typeof p === "string" ? { ...FEE_DEFAULTS, taxRates: [] } : p; };

export const pctText = (bp: number) => `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
export const taxRateFor = (s: FeeSettings, country: string | null | undefined) => (!s.taxEnabled ? 0 : s.taxRates.find((r) => r.country === country)?.rateBp ?? s.taxDefaultBp);

// base = sub-total minus discount (THB satang). fee = percent + fixed, at least the minimum; tax on base + fee (the fee is part of the sale).
// country null = billing country not known yet (cart): tax = null → "Calculated at payment".
export type Charges = { base: number; fee: number; taxBp: number | null; tax: number | null; total: number };
export function charges(s: FeeSettings, base: number, country: string | null | undefined): Charges {
  const b = Math.max(0, Math.round(base));
  const fee = !s.feeEnabled || b === 0 ? 0 : Math.max(s.feeMinMinor, Math.round((b * s.feePercentBp) / 10_000) + s.feeFixedMinor);
  if (!s.taxEnabled) return { base: b, fee, taxBp: 0, tax: 0, total: b + fee };
  if (!country) return { base: b, fee, taxBp: null, tax: null, total: b + fee };
  const taxBp = taxRateFor(s, country); const tax = Math.round(((b + fee) * taxBp) / 10_000);
  return { base: b, fee, taxBp, tax, total: b + fee + tax };
}

// Audit text for one save ("Service fee on · 2.5% + ฿10.00 · Tax TH 7%"). null = nothing changed.
const baht = (m: number) => `฿${(m / 100).toFixed(2)}`;
export const feeText = (s: FeeSettings) => `${pctText(s.feePercentBp)}${s.feeFixedMinor ? ` + ${baht(s.feeFixedMinor)}` : ""}${s.feeMinMinor ? ` (min ${baht(s.feeMinMinor)})` : ""}`;
export function feeChange(a: FeeSettings, b: FeeSettings): string | null {
  const parts: string[] = [];
  if (a.feeEnabled !== b.feeEnabled) parts.push(`Service fee turned ${b.feeEnabled ? "on" : "off"}`);
  if (feeText(a) !== feeText(b)) parts.push(`Service fee ${feeText(a)} → ${feeText(b)}`);
  if (a.taxEnabled !== b.taxEnabled) parts.push(`Sales tax turned ${b.taxEnabled ? "on" : "off"}`);
  if (a.taxDefaultBp !== b.taxDefaultBp) parts.push(`Default tax ${pctText(a.taxDefaultBp)} → ${pctText(b.taxDefaultBp)}`);
  const ra = new Map(a.taxRates.map((r) => [r.country, r.rateBp])), rb = new Map(b.taxRates.map((r) => [r.country, r.rateBp]));
  for (const [c, bp] of rb) if (!ra.has(c)) parts.push(`Tax ${c} ${pctText(bp)} added`); else if (ra.get(c) !== bp) parts.push(`Tax ${c} ${pctText(ra.get(c)!)} → ${pctText(bp)}`);
  for (const c of ra.keys()) if (!rb.has(c)) parts.push(`Tax ${c} removed`);
  return parts.length ? parts.join(" · ").slice(0, 1000) : null;
}

export const FEE_TIP = "A small fee for payment processing and instant delivery. Shown before you pay; never added later.";
export const TAX_TIP = "Sales tax for your billing country, added on top of the price. Shown before you pay.";
