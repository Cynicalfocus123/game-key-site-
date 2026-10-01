import { FILE_MAX_BYTES, FILE_UPLOAD_LIMIT, isFileKind, SELL_ERRORS } from "@/lib/sellers";
import { hitLimit } from "@/lib/server/rate-limit";
import { uploadSellerFile } from "@/lib/server/sellers";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// Whole request cap: one file + the multipart envelope. Above it the request is refused before anything is parsed.
const BODY_MAX = FILE_MAX_BYTES + 64 * 1024;

// R6: read the body with a byte counter and stop as soon as it passes the cap (a missing or false Content-Length cannot make the
// server buffer a large upload). Returns null when too large.
async function readCapped(req: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!req.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = req.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(size)); let at = 0; for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

// T3: POST multipart { kind, file } → { file } (id, name, type, size). Type from the content (JPEG / PNG / GIF / PDF; selfie no GIF),
// 10 MB, FILE_UPLOAD_LIMIT uploads / 10 min per user.
// The file stays private (encrypted on disk) and only an admin with the Seller applications section can open it after the application is sent.
// R6 order: sign-in → rate limit (counts every try) → Content-Length check → capped read → parse. The VPS proxy should also cap
// request bodies (e.g. nginx client_max_body_size 11m) so oversized uploads never reach Node.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!u.emailVerified) return json({ error: SELL_ERRORS.verify }, 403);
  if (!(await hitLimit(`sellfile:${u.id}`, FILE_UPLOAD_LIMIT.max, FILE_UPLOAD_LIMIT.windowMs))) return json({ error: SELL_ERRORS.uploadLimit }, 429);
  if (Number(req.headers.get("content-length") || 0) > BODY_MAX) return json({ error: SELL_ERRORS.fileBig }, 413);
  const bytes = await readCapped(req, BODY_MAX).catch(() => undefined);
  if (bytes === null) return json({ error: SELL_ERRORS.fileBig }, 413);
  if (!bytes) return json({ error: "Invalid request" }, 400);
  let form: FormData;
  try { form = await new Response(new Blob([bytes]), { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData(); } catch { return json({ error: "Invalid request" }, 400); }
  const kind = form.get("kind"); const file = form.get("file");
  if (!isFileKind(kind) || !(file instanceof File)) return json({ error: "kind and file required" }, 400);
  if (file.size > FILE_MAX_BYTES) return json({ error: SELL_ERRORS.fileBig }, 413);
  const r = await uploadSellerFile(u.id, kind, file.name, new Uint8Array(await file.arrayBuffer()));
  return r.ok ? json({ file: r.file }) : json({ error: r.error }, r.status);
}
