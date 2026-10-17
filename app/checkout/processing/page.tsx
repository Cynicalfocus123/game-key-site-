"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { PaymentsConfig } from "@/lib/client/types";
import { readQuery } from "../../components/auth-ui";
import { orderHref } from "../../components/orders-ui";
import { useAuth } from "../../components/auth-provider";
import { SpacePage } from "../../components/space-theme";
import { afterPaidHref } from "@/lib/checkout";

// Purchase processing screen (task 6, wireframe approved 2026-09-30: Claude outputs/wireframes/processing-wireframe.png).
// Shown after Pay until the payment is confirmed: ?order=<id> (checkout) or ?topup=<id> (wallet top-up, the provider's return URL).
// Polls every 3 s: paid → order page / top-up result; failed / cancelled / expired → "payment not completed" on this page.
// After 2 minutes: "Still working — we will email you" (the webhook may be slow; nothing is lost when the page closes).
// Step 5 (wireframe order-pay screen 3): orders show "Your keys are held for you: mm:ss left" (30-minute hold) and, on a dev server / the demo
// only, Simulate paid / failed (a signed provider event through the real webhook path).
// F38 (user 2026-10-02, reference Claude outputs/references/ref-payment-confirmed-eneba.png; cat 2026-10-17): once paid the screen stays
// and shows the happy astronaut cat + "Payment confirmed!". Keys delivered (completed) → "Your keys are ready" + Get your key; paid but not
// delivered yet (hardware, or keys still coming) → Eneba's "waiting for delivery confirmation… we will notify you via email" and it keeps
// checking until delivered. Top-ups: "Top-up complete!". Galaxy space background (step 5).
const POLL_MS = 3000;
const SLOW_MS = 120_000;
type Target = { kind: "order" | "topup"; id: string };
type State = "loading" | "waiting" | "failed" | "missing" | "confirmed";
type Done = { delivered: boolean; primary: { href: string; label: string }; secondary: { href: string; label: string }; number: string };

// Order: completed = paid + keys delivered; paid = paid, delivery still coming (hardware ships later); cancelled / refunded = not completed;
// pending = still waiting. Top-up: credited = done (paid = crediting).
async function check(t: Target): Promise<{ state: "confirmed" | "failed" | "waiting" | "missing"; done?: Done }> {
  if (t.kind === "order") {
    const r = await api.getOrder(t.id); if (!r.ok) return { state: "missing" };
    const o = r.order; const s = o.status;
    if (s === "paid" || s === "completed") {
      const keys = o.items.some((i) => i.kind === "game_key"); const delivered = s === "completed";
      const primary = delivered && keys ? { href: afterPaidHref(o), label: o.items.length === 1 ? "Get your key" : "Get your keys" } : { href: orderHref(o), label: "View order" };
      return { state: "confirmed", done: { delivered, primary, secondary: primary.label === "View order" ? { href: "/", label: "Continue shopping" } : { href: orderHref(o), label: "View order" }, number: o.number } };
    }
    return s === "cancelled" || s === "refunded" ? { state: "failed" } : { state: "waiting" };
  }
  const r = await api.topUp(t.id); if (!r.ok) return { state: "missing" };
  const s = r.topUp.status;
  return s === "credited" ? { state: "confirmed", done: { delivered: true, primary: { href: "/account/balance", label: "My wallet" }, secondary: { href: `/account/balance/top-up?id=${encodeURIComponent(t.id)}`, label: "Top-up details" }, number: r.topUp.number } }
    : s === "failed" || s === "expired" || s === "cancelled" ? { state: "failed" } : { state: "waiting" };
}
// Mascot pictures (user 2026-10-17): happy cat with a green tick on success, worried cat with a red cross when the payment was not completed.
const catSrc = (ext: string, mood: "success" | "failed" = "success") => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/images/mascot/cat-${mood}.${ext}`;

export default function ProcessingPage() {
  const router = useRouter(); const { user } = useAuth(); const [done, setDone] = useState<Done | null>(null);
  const [target, setTarget] = useState<Target | null>(null); const [state, setState] = useState<State>("loading"); const [slow, setSlow] = useState(false);
  const started = useRef(Date.now());
  const [holdUntil, setHoldUntil] = useState<string | null>(null); const [now, setNow] = useState(Date.now()); const [payments, setPayments] = useState<PaymentsConfig | null>(null); const [sim, setSim] = useState(""); const [simBusy, setSimBusy] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const order = readQuery("order"), topup = readQuery("topup");
    const t: Target | null = order ? { kind: "order", id: order } : topup ? { kind: "topup", id: topup } : null;
    if (!t) { setState("missing"); return; }
    setTarget(t);
    if (t.kind === "order") { api.orderHold(t.id).then((h) => { if (h.ok) setHoldUntil(h.holdUntil); }); api.config().then((c) => setPayments(c.payments)).catch(() => null); }
    let live = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const r = await check(t); if (!live) return;
      setState(r.state); if (r.done) setDone(r.done);
      if (r.state === "waiting") { setSlow(Date.now() - started.current >= SLOW_MS); timer = setTimeout(tick, POLL_MS); }
      else if (r.state === "confirmed" && !r.done!.delivered) timer = setTimeout(tick, POLL_MS * 3); // paid, delivery still coming: keep checking
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [router]);

  const isTopUp = target?.kind === "topup";
  const left = holdUntil ? Math.max(0, Date.parse(holdUntil) - now) : null;
  const clock = left === null ? "" : `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")}`;
  const simulate = async (outcome: "paid" | "failed") => {
    if (!target || simBusy) return; setSimBusy(true); setSim("");
    const r = await api.simulateOrder(target.id, outcome); setSimBusy(false);
    setSim(r.ok ? `Sent: ${r.result}` : r.error); // the 3-second poll moves on to the order page / "not completed"
  };
  const again = isTopUp ? "/account/balance" : "/cart";
  const mine = isTopUp ? { href: "/account/balance", label: "My wallet" } : { href: "/account/orders", label: "My orders" };
  const step = (n: number, label: string, done: boolean, now = false) => <li className={`proc-step${done ? " is-done" : ""}${now ? " is-now" : ""}`} aria-current={now ? "step" : undefined}>
    <span className="proc-dot" aria-hidden="true">{done ? "✓" : n}</span><span className="proc-lbl">{label}</span></li>;

  return <SpacePage className="space-proc" picture="galaxy"><div className="proc-page">
    <header className="proc-top">
      <Link className="logo" href="/">core<span>cart</span></Link>
      <ol className="proc-steps" aria-label="Checkout steps">{step(1, isTopUp ? "Top up" : "Cart", true)}<li className="proc-bar" aria-hidden="true" />{step(2, "Payment", true)}<li className="proc-bar" aria-hidden="true" />{step(3, isTopUp ? "Wallet updated" : "Get your product", state === "confirmed", state !== "confirmed")}</ol>
    </header>
    <main className="proc-stage">
      {state === "confirmed" && done ? <div className="proc-result proc-ok" role="status" aria-live="polite">
        <picture><source srcSet={catSrc("avif")} type="image/avif" /><img className="proc-cat" src={catSrc("webp")} alt="CoreCart astronaut cat holding a green tick" width={168} height={220} /></picture>
        <h1>{isTopUp ? "Top-up complete!" : "Payment confirmed!"}</h1>
        {isTopUp ? <p>The money is in your wallet. Top-up {done.number}.</p>
          : done.delivered ? <p>The transaction was successful. Your order {done.number} is ready{done.primary.label.startsWith("Get") ? " and your keys are in your Keys library" : ""}.</p>
          : <><p>The transaction was successful, and now we are waiting for delivery confirmation. This could take a few minutes.</p>
            <p>We will notify you via email <b>{user?.email ?? "your email"}</b> once it&apos;s complete.</p></>}
        <div className="proc-btns"><Link className="btn btn-primary" href={done.primary.href}>{done.primary.label}</Link><Link className="btn btn-outline" href={done.secondary.href}>{done.secondary.label}</Link></div>
        {!isTopUp && <small className="proc-small">We also sent an &quot;Order confirmed&quot; email.</small>}
      </div> : state === "failed" ? <div className="proc-result" role="alert">
        <picture><source srcSet={catSrc("avif", "failed")} type="image/avif" /><img className="proc-cat" src={catSrc("webp", "failed")} alt="CoreCart astronaut cat holding a red cross" width={163} height={220} /></picture>
        <h1>Your payment was not completed</h1>
        <p>You were not charged. {isTopUp ? "Your wallet was not changed." : "Your items are still in your cart."}</p>
        <div className="proc-btns"><Link className="btn btn-primary" href={again}>Try again</Link><Link className="btn btn-outline" href={mine.href}>{mine.label}</Link></div>
      </div> : state === "missing" ? <div className="proc-result" role="alert">
        <h1>We could not find this payment</h1>
        <p>Sign in with the account you paid with, or check your orders.</p>
        <div className="proc-btns"><Link className="btn btn-primary" href="/account/orders">My orders</Link><Link className="btn btn-outline" href="/account/balance">My wallet</Link></div>
      </div> : <div role="status" aria-live="polite">
        <div className="proc-ring" aria-hidden="true" />
        <h1>This may take a while…</h1>
        <p>{isTopUp ? "We are confirming your payment and adding it to your wallet." : "We are confirming your payment and getting your keys ready."}</p>
        {slow ? <p className="proc-slow">Still working — we will email you as soon as it is done. You can close this page. <Link className="text-link" href={mine.href}>{mine.label}</Link></p>
          : <small className="proc-small">Please don&apos;t close or refresh this page.</small>}
        {!isTopUp && clock && <p className="proc-hold"><span aria-hidden="true">🔒</span> Your keys are held for you: <b>{clock}</b> left</p>}
        {!isTopUp && payments?.simulate && <div className="proc-dev" role="group" aria-label="Simulate the payment provider">
          <p>{payments.available ? "Development server" : "Demo"} only — never on the real site</p>
          <div><button type="button" className="btn btn-primary" disabled={simBusy} onClick={() => simulate("paid")}>Simulate paid</button><button type="button" className="btn btn-outline proc-fail" disabled={simBusy} onClick={() => simulate("failed")}>Simulate failed</button></div>
          {sim && <small role="status">{sim}</small>}
        </div>}
      </div>}
    </main>
  </div></SpacePage>;
}
