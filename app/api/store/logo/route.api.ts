import { storeSlugOk } from "@/lib/marketplace";
import { logoFile } from "@/lib/server/marketplace";

export const dynamic = "force-dynamic";

// Public store logo (marketplace step 4): GET ?s=<slug>&v=<version>. Every new upload changes v, so the file is cached for a year.
// Only stores buyers may see; type from the stored content check (WebP / AVIF), nosniff.
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("s") ?? "";
  const f = storeSlugOk(slug) ? await logoFile(slug) : null;
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.bytes), { headers: { "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
