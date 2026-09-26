// Serves the static demo build (out/) under the GitHub Pages base path for Playwright. Local only: binds 127.0.0.1.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("out");
const base = "/game-key-site-";
const port = Number(process.env.PORT) || 4173;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };

async function find(urlPath) {
  const file = path.join(root, decodeURIComponent(urlPath));
  if (!file.startsWith(root)) return null;
  for (const candidate of [file, path.join(file, "index.html"), `${file}.html`]) {
    try { if ((await stat(candidate)).isFile()) return candidate; } catch { /* try next */ }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/" || url.pathname === base) { res.writeHead(302, { location: `${base}/` }).end(); return; }
  const file = url.pathname.startsWith(`${base}/`) ? await find(url.pathname.slice(base.length)) : null;
  if (!file) { res.writeHead(404, { "content-type": types[".html"] }).end(await readFile(path.join(root, "404.html")).catch(() => "Not found")); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(await readFile(file));
}).listen(port, "127.0.0.1", () => console.log(`Serving out/ at http://127.0.0.1:${port}${base}/`));
