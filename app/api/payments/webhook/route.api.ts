import { WEBHOOK_LIMIT } from "@/lib/topup";
import { clientIp, hitLimit } from "@/lib/server/rate-limit";
import { json } from "@/lib/server/session";
import { handleWebhook } from "@/lib/server/topups";

export const dynamic = "force-dynamic";

// Payment provider webhook (future task T1). The ONLY way a top-up credits the wallet.
// The active adapter (env PAYMENT_PROVIDER) verifies the signature over the raw body; each event id is processed once
// (payment_event table); crediting locks the top-up row and writes one ledger row in one transaction. Rate limited per IP.
export async function POST(req: Request) {
  if (!(await hitLimit(`webhook:ip:${clientIp(req)}`, WEBHOOK_LIMIT.max, WEBHOOK_LIMIT.windowMs))) return json({ error: "Too many requests" }, 429);
  const raw = await req.text();
  if (raw.length > 65536) return json({ error: "Payload too large" }, 413);
  const r = await handleWebhook(raw, req.headers);
  return json(r.status === 200 ? { received: true, result: r.result } : { error: r.result }, r.status);
}
