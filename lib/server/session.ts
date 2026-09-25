import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db, dbReady } from "./db";
import { user } from "./db/schema";

export async function requireUser(req: Request) {
  await dbReady();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return null;
  const [row] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  return row ?? null;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const unauthorized = () => json({ error: "Not signed in" }, 401);
export const sampleOrdersAllowed = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_SAMPLE_ORDERS === "1";
