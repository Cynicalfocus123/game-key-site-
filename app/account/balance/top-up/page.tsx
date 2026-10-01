"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, dateText, money } from "@/lib/client/api";
import type { PaymentsConfig, TopUp } from "@/lib/client/types";
import { METHOD_LABEL, STATUS_CHIP, statusLabel } from "@/lib/topup";
import { AccountShell } from "../../../components/account-shell";
import { Notice, readQuery } from "../../../components/auth-ui";
import { useCurrency } from "../../../components/currency-provider";

// Top-up result (T1; top-up redesign 2026-10-01: amounts are picked on the Wallet page, so without ?id= this page goes back to the Wallet).
// The wallet is credited only by the payment provider's webhook (card) or by an admin confirming the money arrived (bank transfer);
// this page just shows the status. Card: polls every 3 s while pending + 30-minute countdown; demo + dev adapter: "Simulate" buttons.
const WALLET = "/account/balance";

function Result({ id, payments }: { id: string; payments: PaymentsConfig | null }) {
  const { price } = useCurrency();
  const [t, setT] = useState<TopUp | null>(null); const [error, setError] = useState(""); const [wallet, setWallet] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [event, setEvent] = useState(""); const [sent, setSent] = useState(false); const [now, setNow] = useState(Date.now());
  const [ref, setRef] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api.topUp(id); if (!r.ok) { setError(r.error); return; }
    setT(r.topUp);
    if (r.topUp.status === "credited") { const b = await api.balance(); if (b.ok) setWallet(b.balance.walletMinor); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // Bank transfer waiting: show the customer's reference again (it must be in the transfer note).
  useEffect(() => { if (t?.method === "bank" && t.status === "pending") api.topUps().then((r) => r.ok && setRef(r.bank?.reference ?? null)); }, [t?.method, t?.status]);
  // Card pending: check again every 3 s (the webhook may arrive any moment) and count down to the 30-minute expiry.
  useEffect(() => {
    if (t?.status !== "pending" || t.method === "bank") return;
    const poll = setInterval(load, 3000); const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [t?.status, t?.method, load]);
  const simulate = async (outcome: "paid" | "failed" | "resend") => {
    setBusy(true); const r = await api.simulateTopUp(id, outcome); setBusy(false);
    if (!r.ok) { setEvent(r.error); return; }
    setSent(true); setT(r.topUp);
    setEvent(r.result === "duplicate" ? "Same event sent again: ignored as a duplicate. Your wallet was not credited twice." : r.result === "credited" ? "Payment event received: wallet credited." : r.result === "failed" ? "Payment event received: payment failed." : `Event result: ${r.result}`);
    if (r.topUp.status === "credited") { const b = await api.balance(); if (b.ok) setWallet(b.balance.walletMinor); }
  };
  if (error) return <><Notice tone="error">{error}</Notice><p><Link className="text-link" href={WALLET}>Back to wallet</Link></p></>;
  if (!t) return <p className="muted-note">Loading…</p>;
  const bank = t.method === "bank";
  const amount = money(t.amountMinor, t.currency);
  const left = Math.max(0, new Date(t.expiresAt).getTime() - now); const mm = Math.floor(left / 60000); const ss = Math.floor((left % 60000) / 1000);
  const text: Record<TopUp["status"], string> = {
    pending: bank ? "Waiting for your transfer. We add it to your wallet within 1–2 business days after the money arrives." : "Waiting for the payment confirmation. This page updates by itself.",
    paid: "Payment received. Adding it to your wallet…",
    credited: `${price(t.creditMinor)} was added to your wallet.`,
    failed: `${t.failureReason ?? "The payment failed."} Nothing was charged.`,
    expired: bank ? "No transfer arrived within 7 days. If you already sent it, contact support with your reference." : "This top-up expired before it was paid. Nothing was charged.",
    cancelled: t.failureReason ?? "This top-up was cancelled.",
  };
  return <section className={`dash-card tu-result tu-${t.status}`} aria-labelledby="tu-res-h" aria-live="polite">
    <header className="dash-head"><h2 id="tu-res-h">Top-up {t.number}</h2><span className={`chip ${STATUS_CHIP[t.status]}`} data-testid="tu-status">{statusLabel(t)}</span></header>
    <div className="dash-pad">
      <p className="tu-res-text">{text[t.status]}</p>
      {t.status === "credited" && t.failureReason && <p className="muted-note">{t.failureReason}</p>}
      <dl className="tu-lines">
        <div><dt>Method</dt><dd>{METHOD_LABEL[t.method]}</dd></div>
        <div><dt>Amount</dt><dd>{amount} {t.currency}</dd></div>
        <div><dt>Started</dt><dd>{dateText(t.createdAt)}</dd></div>
        {bank && t.status === "pending" && ref && <div><dt>Your reference</dt><dd><code data-testid="tu-ref">{ref}</code></dd></div>}
        {t.status === "pending" && (bank ? <div><dt>Waits until</dt><dd>{dateText(t.expiresAt)}</dd></div> : <div><dt>Expires in</dt><dd>{mm}:{String(ss).padStart(2, "0")}</dd></div>)}
        {wallet !== null && <div className="tu-total"><dt>New wallet balance</dt><dd data-testid="tu-wallet">{price(wallet)}</dd></div>}
      </dl>
      {payments?.simulate && !bank && <div className="tu-sim" role="group" aria-label="Simulate the payment provider">
        <p className="tu-sim-h">{payments.available ? "Development server" : "Demo"}: simulate the payment provider</p>
        {t.status === "pending" && <div className="tu-sim-btns"><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => simulate("paid")}>Simulate paid</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => simulate("failed")}>Simulate failed</button></div>}
        {sent && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => simulate("resend")}>Send the same event again</button>}
        {event && <p className="muted-note" role="status">{event}</p>}
      </div>}
      <div className="tu-actions"><Link className="btn btn-outline" href={WALLET}>Back to wallet</Link>{t.status !== "pending" && <Link className="btn btn-outline" href={WALLET}>Top up again</Link>}</div>
    </div>
  </section>;
}

function TopUpBody() {
  const router = useRouter();
  const [id, setId] = useState<string | null | undefined>(undefined); const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  useEffect(() => { const q = readQuery("id"); setId(q); if (!q) router.replace(WALLET); else api.config().then((c) => setPayments(c.payments)); }, [router]);
  if (!id) return <p className="muted-note">Loading…</p>;
  return <Result key={id} id={id} payments={payments} />;
}

export default function TopUpPage() {
  return <AccountShell title="Top-up" crumb="Top-up" parent={{ href: WALLET, label: "Wallet" }}>{() => <TopUpBody />}</AccountShell>;
}
