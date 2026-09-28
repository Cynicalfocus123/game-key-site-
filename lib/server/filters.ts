import { eq, sql } from "drizzle-orm";
import { mergeCatalog, type FilterConfig, type FilterGroupId, type FilterOption } from "@/lib/filters";
import { db } from "./db";
import { filterGroup, filterOption } from "./db/schema";

// Filter manager (future task S4). Edits reuse the pure functions in lib/filters.ts (same rules as the demo store):
// read the config inside a transaction, apply the edit, write back only the rows that changed.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Edit = { ok: true; cfg: FilterConfig } | { ok: false; error: string };

async function read(tx: Tx | typeof db): Promise<FilterConfig> {
  const groups = (await tx.select().from(filterGroup)).map((g) => ({ id: g.id as FilterGroupId, shown: g.shown, startOpen: g.startOpen }));
  const options = (await tx.select().from(filterOption)).map((o): FilterOption => ({ id: o.id, group: o.groupId as FilterGroupId, value: o.value, label: o.label, hidden: o.hidden, position: o.position, deleted: !!o.deletedAt }));
  return { groups, options };
}

async function write(tx: Tx, before: FilterConfig, after: FilterConfig, adminId: string | null) {
  const now = new Date();
  for (const g of after.groups) {
    const old = before.groups.find((x) => x.id === g.id);
    if (old && old.shown === g.shown && old.startOpen === g.startOpen) continue;
    await tx.insert(filterGroup).values({ id: g.id, shown: g.shown, startOpen: g.startOpen, updatedBy: adminId, updatedAt: now })
      .onConflictDoUpdate({ target: filterGroup.id, set: { shown: g.shown, startOpen: g.startOpen, updatedBy: adminId, updatedAt: now } });
  }
  for (const o of after.options) {
    const old = before.options.find((x) => x.id === o.id);
    if (old && old.label === o.label && old.hidden === o.hidden && old.position === o.position && old.deleted === o.deleted) continue;
    const set = { label: o.label, hidden: o.hidden, position: o.position, deletedAt: o.deleted ? now : null, updatedBy: adminId, updatedAt: now };
    if (old) await tx.update(filterOption).set(set).where(eq(filterOption.id, o.id));
    else await tx.insert(filterOption).values({ id: o.id, groupId: o.group, value: o.value, ...set }).onConflictDoNothing(); // parallel catalog merge: first one wins
  }
}

// One writer at a time (transaction-scoped advisory lock), so ↑ ↓ and renames from two tabs cannot interleave.
const lock = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('corecart:filters'))`);

// Config with catalog values merged in (new catalog values are stored on first read).
export async function getFilters(): Promise<FilterConfig> {
  const cfg = await read(db);
  const merged = mergeCatalog(cfg, () => crypto.randomUUID());
  if (merged.options.length === cfg.options.length && merged.groups.length === cfg.groups.length) return merged;
  return db.transaction(async (tx) => {
    await lock(tx); const now = await read(tx); const next = mergeCatalog(now, () => crypto.randomUUID());
    await write(tx, now, next, null); return next;
  });
}

export async function editFilters(adminId: string, edit: (c: FilterConfig) => Edit): Promise<Edit> {
  await getFilters(); // make sure catalog values have rows (ids) first
  return db.transaction(async (tx) => {
    await lock(tx);
    const before = mergeCatalog(await read(tx), () => crypto.randomUUID());
    const r = edit(before); if (!r.ok) return r;
    await write(tx, await read(tx), r.cfg, adminId);
    return r;
  });
}
