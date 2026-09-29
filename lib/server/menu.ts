import { eq, sql } from "drizzle-orm";
import { DEFAULT_MENU, type MenuEdit, type MenuItem, type MenuKind } from "@/lib/menu";
import { db, dbReady } from "./db";
import { menuItem } from "./db/schema";

// Store menu (task D). Edits reuse the pure functions in lib/menu.ts (same rules as the demo store):
// read every row inside a transaction, apply the edit, write back only the rows that changed.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const lock = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('corecart:menu'))`);

async function read(tx: Tx | typeof db): Promise<MenuItem[]> {
  return (await tx.select().from(menuItem)).map((r) => ({ id: r.id, parent: r.parentId, label: r.label, href: r.href, kind: r.kind as MenuKind, position: r.position,
    hidden: r.hidden, isNew: r.isNew, inBar: r.inBar, inFooter: r.inFooter, deleted: !!r.deletedAt }));
}
const same = (a: MenuItem, b: MenuItem) => (Object.keys(a) as (keyof MenuItem)[]).every((k) => a[k] === b[k]);
async function write(tx: Tx, before: MenuItem[], after: MenuItem[], adminId: string | null) {
  const now = new Date();
  for (const m of after) {
    const old = before.find((x) => x.id === m.id);
    if (old && same(old, m)) continue;
    const set = { parentId: m.parent, label: m.label, href: m.href, kind: m.kind, position: m.position, hidden: m.hidden, isNew: m.isNew, inBar: m.inBar, inFooter: m.inFooter,
      deletedAt: m.deleted ? (old?.deleted ? undefined : now) : null, updatedBy: adminId, updatedAt: now };
    if (old) await tx.update(menuItem).set(set).where(eq(menuItem.id, m.id));
    else await tx.insert(menuItem).values({ id: m.id, ...set, deletedAt: set.deletedAt ?? null });
  }
}

// First read: copy the default menu in (only while the table is empty).
export async function getMenu(): Promise<MenuItem[]> {
  await dbReady();
  const items = await read(db);
  if (items.length) return items;
  return db.transaction(async (tx) => {
    await lock(tx); const now = await read(tx);
    if (now.length) return now;
    await write(tx, [], DEFAULT_MENU, null); return DEFAULT_MENU;
  });
}

export async function editMenu(adminId: string, edit: (items: MenuItem[]) => MenuEdit): Promise<MenuEdit> {
  await getMenu();
  return db.transaction(async (tx) => {
    await lock(tx);
    const before = await read(tx);
    const r = edit(before); if (!r.ok) return r;
    await write(tx, before, r.items, adminId);
    return r;
  });
}
