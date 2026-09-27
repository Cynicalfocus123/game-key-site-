// `npm run dev` on this PC: safe local backend (server mode, local PGlite database in .data/pglite).
// - NEXT_TELEMETRY_DISABLED=1: Next's telemetry file write on C: crashes the dev server here (every page → 500).
// - TEMP/TMP on D: (C: has little space).
// - Refuses to start a second server: PGlite allows one process; two servers break the database.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";

const port = Number(process.env.PORT || 3000);
const busy = await new Promise((resolve) => {
  const s = net.connect({ port, host: "127.0.0.1" }, () => { s.end(); resolve(true); });
  s.on("error", () => resolve(false));
});
if (busy) {
  console.log(`\nA server is already running on http://localhost:${port} — open that, do not start a second one.`);
  console.log("To restart it: close its window (or press Ctrl+C there), then run this again.\n");
  process.exit(0);
}

const tmp = "D:/dev/tmp";
fs.mkdirSync(tmp, { recursive: true });
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", TEMP: tmp, TMP: tmp, PORT: String(port) };
console.log(`\nCoreCart backend starting (local database .data/pglite)
  Store        http://localhost:${port}
  Admin login  http://localhost:${port}/admin/login
  Sign-up      http://localhost:${port}/register   (verify links print in this window)
First visit of each page takes a few seconds (dev mode builds it). Keep this window open; Ctrl+C stops the backend.\n`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
