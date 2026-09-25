import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { schema } from "./schema";

export type Db = NodePgDatabase<typeof schema>;
type Holder = { db: Db; ready: Promise<void> };
const globalRef = globalThis as unknown as { __corecartDb?: Holder };
const migrationsFolder = path.join(process.cwd(), "drizzle");

function create(): Holder {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Hosted PostgreSQL (Neon, Supabase, or any Postgres).
    const pool = new Pool({ connectionString: url, max: 5 });
    const db = drizzlePg(pool, { schema });
    return { db, ready: migratePg(db, { migrationsFolder }) };
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is required on hosted deployments.");
  // Local development: file database, no install or signup needed.
  const dir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  return { db: db as unknown as Db, ready: migratePglite(db, { migrationsFolder }) };
}

function holder(): Holder {
  if (!globalRef.__corecartDb) globalRef.__corecartDb = create();
  return globalRef.__corecartDb;
}

export const db: Db = new Proxy({} as Db, { get: (_t, key) => Reflect.get(holder().db, key) });
export const dbReady = () => holder().ready;
