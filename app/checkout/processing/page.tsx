"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { readQuery } from "../../components/auth-ui";
import { orderHref } from "../../components/orders-ui";

// Purchase processing screen (task 6, wireframe approved 2026-09-30: Claude outputs/wireframes/processing-wireframe.png).
// Shown after Pay until the payment is confirmed: ?order=<id> (checkout) or ?topup=<id> (wallet top-up, the provider's return URL).
// Polls every 3 s: paid → order page / top-up result; failed / cancelled / expired → "payment not completed" on this page.
// After 2 minutes: "Still working — we will email you" (the webhook may be slow; nothing is lost when the page closes).
const POLL_MS = 3000;
const SLOW_MS = 120_000;
type Target = { kind: "order" | "topup"; id: string };
type State = "loading" | "waiting" | "failed" | "missing";

// Order: paid / completed = done; cancelled / refunded = not completed; pending = still waiting. Top-up: credited = done (paid = crediting).
async function check(t: Target): Promise<{ state: "done" | "failed" | "waiting" | "missing"; next?: string }> {
  if (t.kind === "order") {
    const r = await api.getOrder(t.id); if (!r.ok) return { state: "missing" };
    const s = r.order.status;
    return s === "paid" || s === "completed" ? { state: "done", next: orderHref(r.order) } : s === "cancelled" || s === "refunded" ? { state: "failed" } : { state: "waiting" };
  }
  const r = await api.topUp(t.id); if (!r.ok) return { state: "missing" };
  const s = r.topUp.status;
  return s === "credited" ? { state: "done", next: `/account/balance/top-up?id=${encodeURIComponent(t.id)}` } : s === "failed" || s === "expired" || s === "cancelled" ? { state: "failed" } : { state: "waiting" };
}

export default function ProcessingPage() {
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null); const [state, setState] = useState<State>("loading"); const [slow, setSlow] = useState(false);
  const started = useRef(Date.now());
  useEffect(() => {
    const order = readQuery("order"), topup = readQuery("topup");
    const t: Target | null = order ? { kind: "order", id: order } : topup ? { kind: "topup", id: topup } : null;
    if (!t) { setState("missing"); return; }
    setTarget(t);
    let live = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const r = await check(t); if (!live) return;
      if (r.state === "done") { router.replace(r.next!); return; }
      setState(r.state === "waiting" ? "waiting" : r.state);
      if (r.state === "waiting") { setSlow(Date.now() - started.current >= SLOW_MS); timer = setTimeout(tick, POLL_MS); }
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [router]);

  const isTopUp = target?.kind === "topup";
  const again = isTopUp ? "/account/balance/top-up" : "/cart";
  const mine = isTopUp ? { href: "/account/balance", label: "My balance" } : { href: "/account/orders", label: "My orders" };
  const step = (n: number, label: string, done: boolean, now = false) => <li className={`proc-step${done ? " is-done" : ""}${now ? " is-now" : ""}`} aria-current={now ? "step" : undefined}>
    <span className="proc-dot" aria-hidden="true">{done ? "✓" : n}</span><span className="proc-lbl">{label}</span></li>;

  return <div className="proc-page">
    <header className="proc-top">
      <Link className="logo" href="/">core<span>cart</span></Link>
      <ol className="proc-steps" aria-label="Checkout steps">{step(1, isTopUp ? "Top up" : "Cart", true)}<li className="proc-bar" aria-hidden="true" />{step(2, "Payment", true)}<li className="proc-bar" aria-hidden="true" />{step(3, isTopUp ? "Wallet updated" : "Get your product", false, true)}</ol>
    </header>
    <main className="proc-stage">
      {state === "failed" ? <div className="proc-result" role="alert">
        <span className="proc-x" aria-hidden="true">✕</span>
        <h1>Your payment was not completed</h1>
        <p>You were not charged. {isTopUp ? "Your wallet was not changed." : "Your items are still in your cart."}</p>
        <div className="proc-btns"><Link className="btn btn-primary" href={again}>Try again</Link><Link className="btn btn-outline" href={mine.href}>{mine.label}</Link></div>
      </div> : state === "missing" ? <div className="proc-result" role="alert">
        <h1>We could not find this payment</h1>
        <p>Sign in with the account you paid with, or check your orders.</p>
        <div className="proc-btns"><Link className="btn btn-primary" href="/account/orders">My orders</Link><Link className="btn btn-outline" href="/account/balance">My balance</Link></div>
      </div> : <div role="status" aria-live="polite">
        <div className="proc-ring" aria-hidden="true" />
        <h1>This may take a while…</h1>
        <p>{isTopUp ? "We are confirming your payment and adding it to your wallet." : "We are confirming your payment and getting your keys ready."}</p>
        {slow ? <p className="proc-slow">Still working — we will email you as soon as it is done. You can close this page. <Link className="text-link" href={mine.href}>{mine.label}</Link></p>
          : <small className="proc-small">Please don&apos;t close or refresh this page.</small>}
      </div>}
    </main>
  </div>;
}
