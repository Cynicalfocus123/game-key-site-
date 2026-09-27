import { getKey, listKeys, revealKey } from "@/lib/server/keys";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// GET → all keys of the signed-in user (codes only when revealed). GET ?id= → one key.
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ keys: await listKeys(u.id) });
  const key = await getKey(u.id, id);
  return key ? json({ key }) : json({ error: "Key not found" }, 404);
}

// POST { id } → reveal: stamps revealed_at once, logs IP + browser every time, returns the key with its code.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  let id: unknown; try { id = (await req.json())?.id; } catch { /* bad body */ }
  if (typeof id !== "string" || !id) return json({ error: "id required" }, 400);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const key = await revealKey(u.id, id, ip, req.headers.get("user-agent"));
  return key ? json({ key }) : json({ error: "Key not found" }, 404);
}
