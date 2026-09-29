import { FILE_MAX_BYTES, FILE_UPLOAD_LIMIT, isFileKind, SELL_ERRORS } from "@/lib/sellers";
import { hitLimit } from "@/lib/server/rate-limit";
import { uploadSellerFile } from "@/lib/server/sellers";
import { json, requireUser, unauthorized } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// T3: POST multipart { kind, file } → { file } (id, name, type, size). Type from the content, 5 MB, 40 uploads / 10 min per user.
// The file stays private (encrypted on disk) and only an admin with the Seller applications section can open it after the application is sent.
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (!u) return unauthorized();
  if (!u.emailVerified) return json({ error: SELL_ERRORS.verify }, 403);
  if (Number(req.headers.get("content-length") || 0) > FILE_MAX_BYTES + 64 * 1024) return json({ error: SELL_ERRORS.fileBig }, 413);
  let form: FormData; try { form = await req.formData(); } catch { return json({ error: "Invalid request" }, 400); }
  const kind = form.get("kind"); const file = form.get("file");
  if (!isFileKind(kind) || !(file instanceof File)) return json({ error: "kind and file required" }, 400);
  if (file.size > FILE_MAX_BYTES) return json({ error: SELL_ERRORS.fileBig }, 413);
  if (!(await hitLimit(`sellfile:${u.id}`, FILE_UPLOAD_LIMIT.max, FILE_UPLOAD_LIMIT.windowMs))) return json({ error: SELL_ERRORS.uploadLimit }, 429);
  const r = await uploadSellerFile(u.id, kind, file.name, new Uint8Array(await file.arrayBuffer()));
  return r.ok ? json({ file: r.file }) : json({ error: r.error }, r.status);
}
