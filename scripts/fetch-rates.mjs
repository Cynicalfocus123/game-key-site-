// GitHub Pages demo build: fetch today's rates into public/rates.json (served as a static file).
// Any failure (offline, bad response) copies the committed lib/currency/fallback-rates.json instead, so the build never fails.
// Server builds skip this: the server stores rates in the database.
import fs from "node:fs";

const staticDemo = process.env.GITHUB_ACTIONS === "true" || process.env.STATIC_DEMO === "1";
if (!staticDemo) process.exit(0);
const fallback = JSON.parse(fs.readFileSync("lib/currency/fallback-rates.json", "utf8"));
const codes = Object.keys(fallback.rates);
let out = fallback; let note = "fallback file (committed)";
try {
  const res = await fetch(fallback.source, { signal: AbortSignal.timeout(10_000) });
  const body = await res.json();
  if (!res.ok || body.result !== "success" || body.base_code !== "USD") throw new Error(`bad response ${res.status}`);
  const rates = {};
  for (const c of codes) { const v = body.rates?.[c]; if (typeof v !== "number" || !(v > 0) || !Number.isFinite(v)) throw new Error(`missing ${c}`); rates[c] = v; }
  out = { source: fallback.source, base: "USD", updatedAt: new Date(body.time_last_update_unix * 1000).toISOString(), rates };
  note = `live, provider time ${out.updatedAt}`;
} catch (e) {
  console.warn(`[rates] fetch failed (${e.message}); using fallback rates from ${fallback.updatedAt}`);
}
fs.writeFileSync("public/rates.json", JSON.stringify(out));
console.log(`[rates] public/rates.json written: ${note}`);
