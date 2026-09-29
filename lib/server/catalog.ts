import { eq, ne, sql } from "drizzle-orm";
import { SEED_PRODUCTS, setCatalog, upgradeProduct, type Product } from "@/lib/catalog";
import { imageOk, PRODUCT_ERRORS } from "@/lib/products";
import { db, dbReady } from "./db";
import { product, productImage } from "./db/schema";

// Catalog DB (task B, 2026-09-29). The published list is kept in memory (lib/catalog.ts setCatalog) for the cart, favorites and promo
// lookups; it is reloaded every 30 s and right after an admin write in this process.
const TTL_MS = 30_000;
const state = globalThis as unknown as { __corecartCatalog?: { at: number; loading: Promise<void> | null } };
const st = () => (state.__corecartCatalog ??= { at: 0, loading: null });
const lock = () => sql`select pg_advisory_xact_lock(hashtext('corecart:catalog'))`;

const toProduct = (r: typeof product.$inferSelect): Product => upgradeProduct({ ...(r.data as Product), id: r.id, name: r.name, kind: r.kind as Product["kind"], price: r.price,
  status: r.status === "draft" ? "draft" : "published", updatedAt: r.updatedAt.toISOString() }); // old genre names upgraded on read

// First run: copy the seed products in (only when the table is empty, so admin deletes stay deleted).
async function seed() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(product);
  if (n > 0) return;
  await db.transaction(async (tx) => {
    await tx.execute(lock());
    const [{ m }] = await tx.select({ m: sql<number>`count(*)::int` }).from(product);
    if (m > 0) return;
    await tx.insert(product).values(SEED_PRODUCTS.map((p) => row(p, null)));
  });
}
const row = (p: Product, adminId: string | null) => {
  const { id, name, kind, price, status, updatedAt: _u, ...rest } = p; void _u;
  return { id, name, kind, price, status: status ?? "published", data: { ...rest, kind, name, price } as Record<string, unknown>, updatedBy: adminId, updatedAt: new Date() };
};

export async function ensureCatalog(force = false) {
  const s = st();
  if (!force && Date.now() - s.at < TTL_MS) return;
  s.loading ??= (async () => {
    await dbReady(); await seed();
    setCatalog((await db.select().from(product).where(eq(product.status, "published"))).map(toProduct));
    s.at = Date.now();
  })().finally(() => { s.loading = null; });
  return s.loading;
}

// Admin: every product except deleted ones (drafts included), newest change first.
export async function adminProducts(): Promise<Product[]> {
  await ensureCatalog();
  return (await db.select().from(product).where(ne(product.status, "deleted")).orderBy(sql`${product.updatedAt} desc`)).map(toProduct);
}
export async function adminProduct(id: string) {
  await ensureCatalog();
  const [r] = await db.select().from(product).where(eq(product.id, id)).limit(1);
  return r && r.status !== "deleted" ? toProduct(r) : null;
}

// Create (isNew) or update. The id never changes after creation (carts, favorites and orders point at it).
export async function saveProduct(p: Product, isNew: boolean, adminId: string): Promise<{ ok: true; product: Product } | { ok: false; error: string; status: number }> {
  await ensureCatalog();
  if (p.image.startsWith("/api/images/")) {
    const [img] = await db.select({ id: productImage.id }).from(productImage).where(eq(productImage.id, p.image.slice("/api/images/".length))).limit(1);
    if (!img) return { ok: false, error: PRODUCT_ERRORS.image, status: 400 };
  }
  const res = await db.transaction(async (tx) => {
    await tx.execute(lock());
    const [old] = await tx.select({ status: product.status, createdAt: product.createdAt }).from(product).where(eq(product.id, p.id)).limit(1);
    if (isNew && old) return { ok: false as const, error: PRODUCT_ERRORS.idTaken, status: 409 };
    if (!isNew && (!old || old.status === "deleted")) return { ok: false as const, error: PRODUCT_ERRORS.notFound, status: 404 };
    const values = row(p, adminId);
    if (isNew) await tx.insert(product).values(values);
    else await tx.update(product).set(values).where(eq(product.id, p.id));
    return { ok: true as const };
  });
  if (!res.ok) return res;
  await ensureCatalog(true);
  return { ok: true, product: (await adminProduct(p.id))! };
}

export async function deleteProduct(id: string, adminId: string) {
  const r = await db.update(product).set({ status: "deleted", updatedBy: adminId, updatedAt: new Date() }).where(eq(product.id, id)).returning({ id: product.id });
  await ensureCatalog(true);
  return r.length > 0;
}

// Image upload: bytes are checked again here (exact 800 x 1000, WebP / JPEG, ≤ 1.5 MB) even though the editor always sends that.
export async function saveImage(bytes: Uint8Array, adminId: string) {
  const ok = imageOk(bytes); if (!ok) return null;
  const id = crypto.randomUUID();
  await db.insert(productImage).values({ id, mime: ok.type, bytes: bytes.length, data: Buffer.from(bytes).toString("base64"), uploadedBy: adminId });
  return `/api/images/${id}`;
}
export async function readImage(id: string) {
  await dbReady();
  const [r] = await db.select().from(productImage).where(eq(productImage.id, id)).limit(1);
  return r ? { mime: r.mime, bytes: Buffer.from(r.data, "base64") } : null;
}
