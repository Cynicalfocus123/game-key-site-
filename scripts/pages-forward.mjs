// GitHub Pages forward (future task S7): once the real site runs on Vercel, the old github.io link sends every visitor there,
// same path + query (e.g. /game-key-site-/product/?id=x → https://real-site/product/?id=x). Used by .github/workflows/deploy-pages.yml
// when the repository variable REAL_SITE_URL is set. Writes out/index.html and out/404.html (Pages serves 404.html for every unknown path).
import fs from "node:fs";

const target = (process.env.REAL_SITE_URL || "").trim().replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(target)) { console.error("REAL_SITE_URL must look like https://your-site.vercel.app"); process.exit(1); }
const base = "/game-key-site-";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>CoreCart has moved</title><link rel="canonical" href="${target}/"><meta http-equiv="refresh" content="3;url=${target}/">
<script>(function(){var p=location.pathname;if(p.indexOf(${JSON.stringify(base)})===0)p=p.slice(${base.length});location.replace(${JSON.stringify(target)}+(p||"/")+location.search+location.hash);})();</script>
<style>body{font-family:Arial,sans-serif;color:#111827;display:grid;place-items:center;min-height:90vh;margin:0}a{color:#2563eb}</style></head>
<body><p>CoreCart has moved to <a href="${target}/">${target.replace(/^https:\/\//, "")}</a>.</p></body></html>
`;
fs.rmSync("out", { recursive: true, force: true });
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/index.html", html);
fs.writeFileSync("out/404.html", html);
fs.writeFileSync("out/.nojekyll", "");
console.log(`Pages forward → ${target}`);
