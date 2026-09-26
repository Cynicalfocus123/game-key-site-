// Create or promote a CoreCart admin. Admins can only be made here, on the server — never from a web page.
//   npm run admin:create -- --email owner@example.com --name "Owner Name"
//   npm run admin:create -- --email owner@example.com --demote        (back to customer)
// Password: typed at the prompt (hidden), or ADMIN_PASSWORD env var. At least 12 characters.
// Database: DATABASE_URL from the environment or .env.local (Neon); otherwise the local PGlite file DB in .data/pglite
// (stop `npm run dev` first: PGlite allows one process at a time).
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { hashPassword } from "better-auth/crypto";

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (k) => args.includes(`--${k}`);
const fail = (msg) => { console.error(`Error: ${msg}`); process.exit(1); };

if (fs.existsSync(".env.local")) for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const email = (arg("email") || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("pass --email you@example.com");

async function open() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    await migrate(drizzle(pool), { migrationsFolder });
    return { query: (q, p) => pool.query(q, p), close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await migrate(drizzle(client), { migrationsFolder });
  return { query: (q, p) => client.query(q, p), close: () => client.close() };
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); }; // hide typed characters
  });
}

const db = await open();
try {
  const { rows: [existing] } = await db.query(`select id, name, role from "user" where lower(email) = $1`, [email]);

  if (flag("demote")) {
    if (!existing) fail(`no account for ${email}`);
    await db.query(`update "user" set role = 'customer', updated_at = now() where id = $1`, [existing.id]);
    await db.query(`delete from session where user_id = $1`, [existing.id]); // sign out everywhere
    console.log(`${email} is no longer an admin (signed out of all sessions).`);
    await db.close(); process.exit(0);
  }

  if (existing) {
    const { rows: linked } = await db.query(`select provider_id from account where user_id = $1 and provider_id <> 'credential'`, [existing.id]);
    if (linked.length && !flag("unlink-other-logins")) fail(`${email} also signs in with ${linked.map((r) => r.provider_id).join(", ")}. Admins use email + password only. Re-run with --unlink-other-logins to remove those logins.`);
    if (linked.length) await db.query(`delete from account where user_id = $1 and provider_id <> 'credential'`, [existing.id]);
  }
  const { rows: [cred] } = existing ? await db.query(`select id from account where user_id = $1 and provider_id = 'credential'`, [existing.id]) : { rows: [] };

  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    password = await ask(cred ? "New admin password (leave empty to keep the current one): " : "Admin password (min 12 characters): ");
    if (password && password !== await ask("Repeat password: ")) fail("passwords do not match");
  }
  if (!password && !cred) fail("a password is required for a new admin");
  if (password && (password.length < 12 || password.length > 128)) fail("password must be 12–128 characters");
  const hash = password ? await hashPassword(password) : null;

  let userId = existing?.id;
  if (existing) {
    await db.query(`update "user" set role = 'admin', email_verified = true, name = coalesce($2, name), updated_at = now() where id = $1`, [userId, arg("name") || null]);
  } else {
    userId = crypto.randomUUID();
    await db.query(`insert into "user" (id, name, email, email_verified, role) values ($1, $2, $3, true, 'admin')`, [userId, arg("name") || email.split("@")[0], email]);
  }
  if (hash && cred) await db.query(`update account set password = $2, updated_at = now() where id = $1`, [cred.id, hash]);
  if (hash && !cred) await db.query(`insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`, [crypto.randomUUID(), userId, hash]);
  if (hash) await db.query(`delete from session where user_id = $1`, [userId]); // new password: sign out old sessions
  console.log(`${existing ? "Updated" : "Created"} admin ${email}. Sign in at /admin/login.`);
} finally {
  await db.close();
}
