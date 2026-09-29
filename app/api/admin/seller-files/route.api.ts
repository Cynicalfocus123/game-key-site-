import { readSellerFile } from "@/lib/server/sellers";
import { json, requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
// T3 (section "sellers"): GET ?id= → the file (decrypted), GET ?id=&download=1 → as a download. Every call = one history row.
// Never cached; nosniff so a browser uses only the type checked at upload.
export async function GET(req: Request) {
  const r = await requireAdmin(req, "sellers");
  if ("error" in r) return r.error;
  const p = new URL(req.url).searchParams; const id = p.get("id") ?? ""; const download = p.get("download") === "1";
  const f = id ? await readSellerFile(r.user.id, id, download).catch(() => null) : null;
  if (!f) return json({ error: "File not found" }, 404);
  const name = f.name.replace(/[^\w. ()-]/g, "_");
  return new Response(new Uint8Array(f.bytes), { headers: { "Content-Type": f.mime, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`, "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } });
}
