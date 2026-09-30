import { feeSettings } from "@/lib/server/fees";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Public: service fee + tax settings, so the cart / checkout show the same lines the server will charge (lib/fees.ts charges()).
export async function GET() {
  return json({ settings: await feeSettings() });
}
