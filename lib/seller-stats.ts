// Seller dashboard revenue panel (wireframe screen 3A / 5A, approved 2026-10-08). Pure: no server imports.
// Day = last 30 days, Week = last 12 weeks (Monday start), Month = last 12 months, all in Bangkok time (UTC+7, no DST).
// Step 2 shows SAMPLE numbers (sampleDays); step 5 (stats API) feeds real DayStat rows into the same aggregate().
export type Period = "day" | "week" | "month";
export const PERIODS: Record<Period, { label: string; range: string; count: number }> = {
  day: { label: "Day", range: "Last 30 days", count: 30 },
  week: { label: "Week", range: "Last 12 weeks", count: 12 },
  month: { label: "Month", range: "Last 12 months", count: 12 },
};
export type Metric = "net" | "gross" | "orders" | "keys";
export const METRICS: Record<Metric, string> = { net: "Net revenue", gross: "Gross sales", orders: "Orders", keys: "Keys sold" };
export type Totals = { net: number; gross: number; orders: number; keys: number }; // net / gross in USD cents
export type DayStat = Totals & { day: string }; // day = Bangkok date YYYY-MM-DD
export type Bucket = Totals & { start: string; label: string; short: string };
export type BestSeller = { productId: string; keys: number; net: number };
export type Stats = { period: Period; buckets: Bucket[]; current: Totals; previous: Totals; best: BestSeller[]; sample: boolean };

const BKK_MS = 7 * 3600_000;
const DAY_MS = 86400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Bangkok calendar date as a UTC-midnight Date (only the UTC getters are used).
export const bkkDay = (t: number) => { const d = new Date(t + BKK_MS); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const zero = (): Totals => ({ net: 0, gross: 0, orders: 0, keys: 0 });

// Start of the bucket that holds Bangkok date d.
function bucketStart(d: Date, period: Period) {
  if (period === "day") return d;
  if (period === "week") return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function stepBack(d: Date, period: Period, n: number) {
  if (period === "day") return new Date(d.getTime() - n * DAY_MS);
  if (period === "week") return new Date(d.getTime() - n * 7 * DAY_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
}
function labels(d: Date, period: Period) {
  const day = d.getUTCDate(); const mon = MONTHS[d.getUTCMonth()];
  if (period === "day") return { label: `${day} ${mon}`, short: day === 1 ? mon : String(day) };
  if (period === "week") return { label: `Week of ${day} ${mon}`, short: `${day} ${mon}` };
  return { label: `${mon} ${d.getUTCFullYear()}`, short: mon };
}
// 2 × count bucket starts, oldest first: [previous period …, current period …]. The last one is still running.
export function bucketStarts(period: Period, now = Date.now()) {
  const last = bucketStart(bkkDay(now), period); const n = PERIODS[period].count * 2;
  return Array.from({ length: n }, (_, i) => stepBack(last, period, n - 1 - i));
}
const add = (t: Totals, s: Totals) => { t.net += s.net; t.gross += s.gross; t.orders += s.orders; t.keys += s.keys; };

// Day rows → buckets of the chosen period + totals of the same length of time just before.
export function aggregate(days: DayStat[], period: Period, best: BestSeller[] = [], sample = false, now = Date.now()): Stats {
  const starts = bucketStarts(period, now); const count = PERIODS[period].count;
  const all = starts.map((d) => ({ ...zero(), start: iso(d), ...labels(d, period) }));
  const index = new Map(all.map((b, i) => [b.start, i]));
  for (const r of days) { const i = index.get(iso(bucketStart(new Date(`${r.day}T00:00:00Z`), period))); if (i !== undefined) add(all[i], r); }
  const buckets = all.slice(count); const current = zero(); const previous = zero();
  buckets.forEach((b) => add(current, b)); all.slice(0, count).forEach((b) => add(previous, b));
  return { period, buckets, current, previous, best, sample };
}

// ▲ / ▼ % vs the period before. null = nothing to compare with.
export const change = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
export const avgOrder = (t: Totals) => (t.orders ? Math.round(t.gross / t.orders) : 0);

// ---------- Sample numbers (until real orders, step 5) ----------
// Same seed → same numbers on every visit, desktop and phone. Every day value comes from a hash of seed + date, so weeks and
// months are sums of the same days (switching Day / Week / Month never contradicts itself).
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rnd = (s: string) => hash(s) / 4294967296;
export function sampleDays(seed: string, now = Date.now()): DayStat[] {
  const today = bkkDay(now); const out: DayStat[] = [];
  for (let i = 0; i < 2 * 366 + 31; i++) {
    const d = new Date(today.getTime() - i * DAY_MS); const k = `${seed}|${iso(d)}`;
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6; const trend = 1 + 0.35 * Math.sin(i / 45);
    const orders = Math.round(rnd(`${k}|o`) * 9 * trend + (weekend ? 3 : 1)); const keys = orders + Math.round(rnd(`${k}|k`) * orders * 0.4);
    const gross = keys * (900 + Math.round(rnd(`${k}|p`) * 1600)); // $9–$25 a key
    out.push({ day: iso(d), orders, keys, gross, net: Math.round(gross * 0.9) });
  }
  return out;
}
// Best sellers of the sample: the seller's own products first (else the first catalog game keys), share of the period's keys.
export function sampleBest(productIds: string[], current: Totals, max = 3): BestSeller[] {
  const ids = productIds.slice(0, max); const shares = [0.42, 0.27, 0.16];
  return ids.map((productId, i) => ({ productId, keys: Math.round(current.keys * shares[i]), net: Math.round(current.net * shares[i]) }));
}
export function sampleStats(seed: string, period: Period, productIds: string[], now = Date.now()): Stats {
  const s = aggregate(sampleDays(seed, now), period, [], true, now);
  return { ...s, best: sampleBest(productIds, s.current) };
}
