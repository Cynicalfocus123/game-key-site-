import { getFilters } from "@/lib/server/filters";
import { json } from "@/lib/server/session";
import { dbReady } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Public: admin filter config for the storefront (future task S4). Hidden / deleted values are included so the storefront can leave them out.
export async function GET() {
  await dbReady();
  return json({ config: await getFilters() });
}
