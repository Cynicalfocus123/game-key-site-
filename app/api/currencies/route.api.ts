import { after } from "next/server";
import { publicCurrencies, refreshInBackground } from "@/lib/server/rates";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Enabled currencies + effective rates. Country comes from Vercel's IP header (absent locally → no suggestion).
export async function GET(req: Request) {
  after(refreshInBackground); // refresh runs after the response, only when due
  return json(await publicCurrencies(req.headers.get("x-vercel-ip-country")));
}
