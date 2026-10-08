"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import { avgOrder, change, METRICS, PERIODS, sampleStats, type Bucket, type Metric, type Period, type Totals } from "@/lib/seller-stats";
import { productTitle, usd } from "./seller-ui";

// Revenue panel (screen 3A desktop, 5A phone). Plain CSS bar chart, no chart package. SAMPLE numbers until real orders (stats API = step 5).
// Desktop: every bar of the period. Phones (< 768 px): 7 bars in view, swipe for older ones; Net + Orders, the rest under "More numbers".
const value = (b: Totals, m: Metric) => b[m];
const show = (n: number, m: Metric) => (m === "net" || m === "gross" ? usd(n) : n.toLocaleString("en-US"));
const tipText = (b: Bucket, last: boolean) => `${b.label}${last ? " (so far)" : ""} · Net ${usd(b.net)} · ${b.orders} orders · ${b.keys} keys`;

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const pct = change(cur, prev);
  if (pct === null) return <span className="sl-delta">—</span>;
  return <span className={`sl-delta ${pct >= 0 ? "up" : "down"}`} aria-label={`${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% vs the period before`}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

export function RevenuePanel({ seed, productIds, products }: { seed: string; productIds: string[]; products: Product[] }) {
  const [period, setPeriod] = useState<Period>("week"); const [metric, setMetric] = useState<Metric>("net");
  const [tip, setTip] = useState<number | null>(null); const [more, setMore] = useState(false);
  const ids = productIds.join("|");
  const stats = useMemo(() => sampleStats(seed, period, ids ? ids.split("|") : []), [seed, period, ids]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; setTip(null); }, [period]); // phones: newest bars in view
  useEffect(() => { // tap / click outside the chart closes the tooltip (touch has no "mouse leave")
    if (tip === null) return; const down = (e: PointerEvent) => { if (!scroller.current?.contains(e.target as Node)) setTip(null); };
    document.addEventListener("pointerdown", down); return () => document.removeEventListener("pointerdown", down);
  }, [tip]);
  const vals = stats.buckets.map((b) => value(b, metric)); const max = Math.max(...vals, 1); const avg = vals.reduce((t, v) => t + v, 0) / (vals.length || 1);
  const c = stats.current; const p = stats.previous; const last = stats.buckets.length - 1;
  const kpis: { label: string; cur: number; prev: number; money: boolean; main?: boolean }[] = [
    { label: "Net revenue", cur: c.net, prev: p.net, money: true, main: true },
    { label: "Gross sales", cur: c.gross, prev: p.gross, money: true },
    { label: "Orders", cur: c.orders, prev: p.orders, money: false, main: true },
    { label: "Keys sold", cur: c.keys, prev: p.keys, money: false },
    { label: "Avg. order value", cur: avgOrder(c), prev: avgOrder(p), money: true },
  ];
  const name = (id: string) => { const x = products.find((q) => q.id === id); return x ? productTitle(x) : "Product"; };
  const unit = period === "day" ? "day" : period === "week" ? "week" : "month";

  return <section className="sl-panel" aria-labelledby="rev-h">
    <div className="sl-phead">
      <h2 id="rev-h">Revenue</h2>
      <div className="sl-controls">
        <div className="sl-seg" role="group" aria-label="Period">{(Object.keys(PERIODS) as Period[]).map((k) =>
          <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{PERIODS[k].label}</button>)}</div>
        <span className="sl-pill">{PERIODS[period].range}</span>
        <label className="sl-pill sl-metric"><span className="sr-only">Bars show</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>{(Object.keys(METRICS) as Metric[]).map((m) => <option key={m} value={m}>{METRICS[m]}</option>)}</select></label>
      </div>
    </div>
    {stats.sample && <p className="sl-sample" role="note"><span className="chip chip-amber">Sample</span> Sample numbers — real ones appear after your first sales.</p>}
    <dl className={`sl-kpis${more ? " is-more" : ""}`}>{kpis.map((k) => <div key={k.label} className={k.main ? "main" : undefined}>
      <dt>{k.label}</dt><dd><b>{k.money ? usd(k.cur) : k.cur.toLocaleString("en-US")}</b> <Delta cur={k.cur} prev={k.prev} /></dd></div>)}</dl>
    <button type="button" className="text-link sl-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? "Fewer numbers ▴" : "More numbers ▾"}</button>
    <div className="sl-chart" ref={scroller} aria-label={`${METRICS[metric]} per ${unit}, ${PERIODS[period].range.toLowerCase()}`} role="group">
      <div className="sl-plot" style={{ "--n": stats.buckets.length } as React.CSSProperties}>
        <span className="sl-avg" style={{ bottom: `${(avg / max) * 100}%` }} aria-hidden="true"><em>Avg {show(Math.round(avg), metric)}</em></span>
        {stats.buckets.map((b, i) => <div key={b.start} className="sl-col">
          <button type="button" className={`sl-bar${i === last ? " now" : ""}${tip === i ? " on" : ""}`} style={{ height: `${Math.max(2, (vals[i] / max) * 100)}%` }}
            aria-label={tipText(b, i === last)} onPointerEnter={(e) => e.pointerType === "mouse" && setTip(i)} onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}
            onFocus={() => setTip(i)} onClick={() => setTip(i)} />
          {tip === i && <span className={`sl-tip${i > last - 2 ? " left" : i < 2 ? " right" : ""}`} role="tooltip">{tipText(b, i === last)}</span>}
          <span className="sl-axis" aria-hidden="true">{period !== "day" || (last - i) % 5 === 0 ? b.short : ""}</span>
        </div>)}
      </div>
    </div>
    <p className="muted-note">Bars = {METRICS[metric].toLowerCase()} per {unit} (dark bar = this {unit}, still running). Dashed line = average. % = vs the same length of time just before. Bangkok time.</p>
    {stats.best.length > 0 && <div className="ord-wrap"><table className="sl-best">
      <thead><tr><th scope="col">Best sellers (this period)</th><th scope="col">Keys sold</th><th scope="col">Net revenue</th></tr></thead>
      <tbody>{stats.best.map((b) => <tr key={b.productId}><td>{name(b.productId)}</td><td>{b.keys}</td><td>{usd(b.net)}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
