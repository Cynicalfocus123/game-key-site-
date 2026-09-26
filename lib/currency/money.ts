// Money math in integer minor units (satang, cents, fils). Rates are decimal strings, "units per 1 USD".
// Conversion uses BigInt with 12-digit fixed-point rates, so no floating-point rounding reaches a price.
import { DEFAULT_CURRENCY } from "./currencies";

export type RateInfo = { code: string; decimals: number; rate: string };
export type SiteCurrency = RateInfo & { name: string; symbol: string; roundStep: number; chargeable: boolean };
export type CurrencyData = {
  base: RateInfo; // THB, always present even if disabled for display
  currencies: SiteCurrency[]; // enabled only, alphabetical
  updatedAt: string | null; // when the rates were fetched
  suggested: string | null; // auto-pick from visitor country
};

const SCALE = 12;
// tsconfig targets ES2017, which has no BigInt literals.
const B0 = BigInt(0), B1 = BigInt(1), B2 = BigInt(2), B10 = BigInt(10);
const pow10 = (n: number) => { let r = B1; for (let i = 0; i < n; i++) r *= B10; return r; };

// "32.41" | 32.41 → 32410000000000n (rate × 10^12). Rejects anything that is not a plain positive decimal.
export function scaleRate(v: string | number): bigint {
  const s = typeof v === "number" ? v.toFixed(SCALE) : v.trim();
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`Invalid rate: ${v}`);
  return BigInt(m[1]) * pow10(SCALE) + BigInt((m[2] ?? "").slice(0, SCALE).padEnd(SCALE, "0"));
}
export const isValidRate = (v: string) => /^\d{1,9}(\.\d{1,12})?$/.test(v.trim()) && scaleRate(v) > B0;
export const rateString = (v: number) => scaleToString(scaleRate(v));
export function scaleToString(scaled: bigint) {
  const int = scaled / pow10(SCALE); const frac = (scaled % pow10(SCALE)).toString().padStart(SCALE, "0").replace(/0+$/, "");
  return frac ? `${int}.${frac}` : `${int}`;
}

// Round n / d to nearest integer, halves away from zero.
function divRound(n: bigint, d: bigint) {
  const neg = (n < B0) !== (d < B0); const a = n < B0 ? -n : n; const b = d < B0 ? -d : d;
  const q = (a * B2 + b) / (b * B2);
  return neg ? -q : q;
}

// price_X = price_THB / rate(THB) * rate(X), rounded to X's decimals, then to X's rounding step (in minor units).
export function convertMinor(amountMinor: number, from: RateInfo, to: RateInfo & { roundStep?: number }): number {
  if (from.code === to.code) return amountMinor;
  const n = BigInt(Math.round(amountMinor)) * scaleRate(to.rate) * pow10(to.decimals);
  const d = scaleRate(from.rate) * pow10(from.decimals);
  let q = divRound(n, d);
  const step = BigInt(Math.max(1, Math.floor(to.roundStep ?? 1)));
  if (step > B1) q = divRound(q, step) * step;
  return Number(q);
}

// Units of `to` per 1 unit of `from` (stored on orders as the rate used).
export const crossRate = (from: RateInfo, to: RateInfo) => scaleToString(divRound(scaleRate(to.rate) * pow10(SCALE), scaleRate(from.rate)));

const formats = new Map<number, Intl.NumberFormat>();
const numberFormat = (d: number) => {
  let f = formats.get(d);
  if (!f) { f = new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); formats.set(d, f); }
  return f;
};
// The one price formatter for the whole site. Builds the decimal string from integers, then lets Intl group digits.
export function formatMoney(minor: number, c: { code: string; decimals: number; symbol?: string }) {
  const neg = minor < 0; const abs = BigInt(Math.abs(Math.round(minor)));
  const int = abs / pow10(c.decimals); const frac = c.decimals ? `.${(abs % pow10(c.decimals)).toString().padStart(c.decimals, "0")}` : "";
  const num = numberFormat(c.decimals).format(`${int}${frac}` as unknown as number);
  const sym = c.symbol ?? c.code;
  const sep = /[A-Za-z.]$/.test(sym) ? " " : "";
  return `${neg ? "−" : ""}${sym}${sep}${num}`;
}

// Currency the customer actually pays in: the chosen one if chargeable, else USD, else the first chargeable.
export function chargeCurrency(chosen: SiteCurrency | undefined, all: SiteCurrency[]) {
  if (chosen?.chargeable) return chosen;
  return all.find((c) => c.code === DEFAULT_CURRENCY && c.chargeable) ?? all.find((c) => c.chargeable) ?? chosen;
}
