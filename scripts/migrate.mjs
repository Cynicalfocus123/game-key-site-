// Run the database migrations once, before the server starts (future task S7, real site on Vercel + Neon).
//   npm run db:migrate            (uses DATABASE_URL from the environment or .env.local)
// Vercel runs it through "vercel-build" before `next build`, so serverless functions never migrate at the same time
// (lib/server/db/index.ts skips runtime migrations when VERCEL is set). Without DATABASE_URL it does nothing:
// the local PGlite database migrates itself when `npm run dev` starts.
import fs from "node:fs";
import path from "node:path";

if (fs.existsSync(".env.local")) for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!process.env.DATABASE_URL) {
  if (process.env.VERCEL) { console.error("DATABASE_URL is missing. Add it in Vercel → Project → Settings → Environment Variables."); process.exit(1); }
  console.log("db:migrate: no DATABASE_URL, nothing to do (local PGlite migrates on start).");
  process.exit(0);
}
const { Pool } = await import("pg");
const { drizzle } = await import("drizzle-orm/node-postgres");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("db:migrate: database is up to date.");
} catch (e) {
  console.error("db:migrate failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
