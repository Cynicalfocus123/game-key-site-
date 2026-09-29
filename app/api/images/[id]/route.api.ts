import { readImage } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";

// Public product image (task B). A new upload always gets a new id, so the file can be cached for a year.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const img = await readImage(id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.bytes), { headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
