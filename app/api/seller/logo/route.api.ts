import { dataUrlBytes, LOGO_ERRORS, LOGO_LIMIT, LOGO_MAX_BYTES } from "@/lib/seller-logo";
import { readBody, removeLogo, requireSeller, saveLogo } from "@/lib/server/marketplace";
import { hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Store logo (marketplace step 4, approved sellers). POST { dataUrl } → { store }: WebP / AVIF by content, longest side 256–2048 px,
// ≤ 1 MB (same messages as the page). DELETE → { store } back to the letter frame. 30 changes / 10 min per seller.
export async function POST(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  const max = Math.ceil(LOGO_MAX_BYTES * 1.4) + 1_000; // base64 of 1 MB + JSON
  if (Number(req.headers.get("content-length") ?? 0) > max) return json({ error: LOGO_ERRORS.big }, 413);
  const b = await readBody(req, max);
  if (!b) return json({ error: "Bad request" }, 400);
  const bytes = dataUrlBytes(b.dataUrl); if (!bytes) return json({ error: LOGO_ERRORS.type }, 400);
  if (!(await hitLimit(`seller-logo:${r.user.id}`, LOGO_LIMIT.max, LOGO_LIMIT.windowMs))) return json({ error: LOGO_ERRORS.limit }, 429);
  const s = await saveLogo(r.seller, bytes);
  return s.ok ? json({ store: s.store }) : json({ error: s.error }, s.status);
}
export async function DELETE(req: Request) {
  const r = await requireSeller(req); if ("error" in r) return r.error;
  if (!(await hitLimit(`seller-logo:${r.user.id}`, LOGO_LIMIT.max, LOGO_LIMIT.windowMs))) return json({ error: LOGO_ERRORS.limit }, 429);
  return json({ store: await removeLogo(r.seller) });
}
