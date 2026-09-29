import { getMenu } from "@/lib/server/menu";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Public: store menu (task D). Hidden and deleted items are included (flagged) so the storefront leaves them out.
export async function GET() {
  return json({ items: await getMenu() });
}
