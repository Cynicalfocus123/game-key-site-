"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, dateText, money } from "@/lib/client/api";
import type { PaymentsConfig, TopUp } from "@/lib/client/types";
import { chargeCurrency, convertMinor, formatMoney } from "@/lib/currency/money";
import { checkAmount, STATUS_CHIP, STATUS_LABEL, toMinor, topUpLimits, TOPUP_ERRORS, USD_RATE } from "@/lib/topup";
import { AccountShell } from "../../../components/account-shell";
import { Notice, readQuery } from "../../../components/auth-ui";
import { useCurrency } from "../../../components/currency-provider";
import { PaymentLogos } from "../../../components/payment-logos";

// Wallet top-up (future task T1). Picker (?id= absent) → pending top-up → result view (?id=). The wallet is credited only by the
// payment provider's webhook; this page just shows the status (it polls while pending). Demo + dev adapter: "Simulate" buttons.
const newKey = () => crypto.randomUUID();
const PAGE = "/account/balance/top-up";

function Picker({ payments, onCreated }: { payments: PaymentsConfig | null; onCreated: (t: TopUp) => void }) {
  const { currency, currencies, base, price } = useCurrency();
  const pay = chargeCurrency(currency, currencies) ?? currency;
  const limits = useMemo(() => topUpLimits(pay, currencies.find((c) => c.code === "USD") ?? USD_RATE), [pay, currencies]);
  const [preset, setPreset] = useState<number | "custom">(limits.presets[Math.min(2, limits.presets.length - 1)] ?? "custom");
  const [custom, setCustom] = useState(""); const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const key = useRef(newKey()); const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { api.topUps().then((r) => r.ok && setLeft(r.dailyLeftMinor)); }, []);
  useEffect(() => { setPreset(limits.presets[Math.min(2, limits.presets.length - 1)] ?? "custom"); setCustom(""); setTouched(false); }, [limits]);
  const amount = preset === "custom" ? toMinor(custom, pay.decimals) : preset;
  const amountError = preset === "custom" ? (custom.trim() ? checkAmount(amount ?? 0, limits, pay.symbol) : TOPUP_ERRORS.amount) : null;
  const fmt = (m: number) => formatMoney(m, pay);
  const credit = amount && !amountError ? convertMinor(amount, pay, base) : 0;
  const choose = (p: number | "custom") => { setPreset(p); setError(""); key.current = newKey(); };

  const start = async () => {
    setTouched(true); if (!amount || amountError || busy) return;
    setBusy(true); setError("");
    const r = await api.createTopUp({ amountMinor: amount, currency: pay.code, idempotencyKey: key.current });
    if (!r.ok) { setBusy(false); setError(r.error); return; }
    key.current = newKey();
    if (r.payment?.kind === "redirect") { window.location.assign(r.payment.url); return; } // provider's hosted payment page
    setBusy(false); onCreated(r.topUp);
  };
  const canPay = Boolean(payments?.available); const demoSimulate = Boolean(payments?.simulate && !payments.available);

  return <div className="tu-grid">
    <section className="dash-card tu-pick" aria-labelledby="tu-amount-h">
      <header className="dash-head"><h2 id="tu-amount-h">Choose an amount</h2></header>
      <div className="dash-pad">
        <div className="tu-presets" role="radiogroup" aria-label="Top-up amount">
          {limits.presets.map((p) => <button key={p} type="button" role="radio" aria-checked={preset === p} className={`tu-chip${preset === p ? " is-on" : ""}`} onClick={() => choose(p)}>{fmt(p)}</button>)}
          <button type="button" role="radio" aria-checked={preset === "custom"} className={`tu-chip${preset === "custom" ? " is-on" : ""}`} onClick={() => choose("custom")}>Custom</button>
        </div>
        {preset === "custom" && <label className="field tu-custom"><span>Custom amount ({pay.code})</span>
          <span className="tu-custom-row"><span className="tu-sym" aria-hidden="true">{pay.symbol}</span>
            <input inputMode="decimal" autoComplete="off" value={custom} placeholder={(limits.min / 10 ** pay.decimals).toFixed(pay.decimals)} autoFocus aria-invalid={(touched && Boolean(amountError)) || undefined} aria-describedby="tu-limits"
              onChange={(e) => { setCustom(e.target.value.replace(/[^\d.,]/g, "").slice(0, 14)); setTouched(true); setError(""); key.current = newKey(); }} /></span>
          {touched && amountError && <small className="field-error" role="alert">{amountError}</small>}
        </label>}
        <p id="tu-limits" className="muted-note tu-limits">Minimum {fmt(limits.min)} · maximum {fmt(limits.max)} per top-up.{left !== null && <> You can add up to <strong data-testid="tu-left">{fmt(Math.floor(convertMinor(left, base, { ...pay, roundStep: 1 })))}</strong> more today.</>}</p>
        {pay.code !== currency.code && <p className="charge-notice" role="note">Top-ups are charged in <strong>{pay.code}</strong>. {currency.code} can&apos;t be charged, so amounts are shown in {pay.code}.</p>}
      </div>
    </section>
    <aside className="dash-card tu-summary" aria-labelledby="tu-sum-h">
      <header className="dash-head"><h2 id="tu-sum-h">Summary</h2></header>
      <div className="dash-pad">
        <dl className="tu-lines">
          <div><dt>Top-up</dt><dd>{amount && !amountError ? fmt(amount) : "—"}</dd></div>
          <div><dt>Fee</dt><dd>Free</dd></div>
          <div className="tu-total"><dt>You pay</dt><dd data-testid="tu-pay">{amount && !amountError ? `${fmt(amount)} ${pay.code}` : "—"}</dd></div>
        </dl>
        {credit > 0 && <p className="muted-note tu-adds">Adds <strong>{price(credit)}</strong> to your wallet{pay.code !== currency.code ? " (estimated)" : ""}.</p>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="tu-pay">
          <span className="tu-pay-amount" aria-hidden="true">{amount && !amountError ? fmt(amount) : ""}</span>
          <button type="button" className="btn btn-primary" disabled={!canPay || busy} aria-describedby={canPay ? undefined : "tu-soon"} onClick={start}>{busy && canPay ? "Starting…" : `Pay${amount && !amountError ? ` ${fmt(amount)}` : ""}`}</button>
        </div>
        {!canPay && <p id="tu-soon" className="muted-note tu-soon">Card payments coming soon.</p>}
        {demoSimulate && <div className="tu-demo"><button type="button" className="btn btn-outline" disabled={busy} onClick={start}>{busy ? "Starting…" : "Demo: simulate payment"}</button>
          <small className="muted-note">Demo only. No card, no real money: the next page stands in for the payment provider.</small></div>}
        <PaymentLogos />
      </div>
    </aside>
  </div>;
}

function Result({ id, payments, onAgain }: { id: string; payments: PaymentsConfig | null; onAgain: () => void }) {
  const { price } = useCurrency();
  const [t, setT] = useState<TopUp | null>(null); const [error, setError] = useState(""); const [wallet, setWallet] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [event, setEvent] = useState(""); const [sent, setSent] = useState(false); const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    const r = await api.topUp(id); if (!r.ok) { setError(r.error); return; }
    setT(r.topUp);
    if (r.topUp.status === "credited") { const b = await api.balance(); if (b.ok) setWallet(b.balance.walletMinor); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // Pending: check again every 3 s (the webhook may arrive any moment) and count down to the 30-minute expiry.
  useEffect(() => {
    if (t?.status !== "pending") return;
    const poll = setInterval(load, 3000); const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [t?.status, load]);
  const simulate = async (outcome: "paid" | "failed" | "resend") => {
    setBusy(true); const r = await api.simulateTopUp(id, outcome); setBusy(false);
    if (!r.ok) { setEvent(r.error); return; }
    setSent(true); setT(r.topUp);
    setEvent(r.result === "duplicate" ? "Same event sent again: ignored as a duplicate. Your wallet was not credited twice." : r.result === "credited" ? "Payment event received: wallet credited." : r.result === "failed" ? "Payment event received: payment failed." : `Event result: ${r.result}`);
    if (r.topUp.status === "credited") { const b = await api.balance(); if (b.ok) setWallet(b.balance.walletMinor); }
  };
  if (error) return <><Notice tone="error">{error}</Notice><p><Link className="text-link" href="/account/balance">Back to balance</Link></p></>;
  if (!t) return <p className="muted-note">Loading…</p>;
  const amount = money(t.amountMinor, t.currency);
  const left = Math.max(0, new Date(t.expiresAt).getTime() - now); const mm = Math.floor(left / 60000); const ss = Math.floor((left % 60000) / 1000);
  const text: Record<TopUp["status"], string> = {
    pending: "Waiting for the payment confirmation. This page updates by itself.",
    paid: "Payment received. Adding it to your wallet…",
    credited: `${price(t.creditMinor)} was added to your wallet.`,
    failed: `${t.failureReason ?? "The payment failed."} Nothing was charged.`,
    expired: "This top-up expired before it was paid. Nothing was charged.",
    cancelled: t.failureReason ?? "This top-up was cancelled.",
  };
  return <section className={`dash-card tu-result tu-${t.status}`} aria-labelledby="tu-res-h" aria-live="polite">
    <header className="dash-head"><h2 id="tu-res-h">Top-up {t.number}</h2><span className={`chip ${STATUS_CHIP[t.status]}`} data-testid="tu-status">{STATUS_LABEL[t.status]}</span></header>
    <div className="dash-pad">
      <p className="tu-res-text">{text[t.status]}</p>
      {t.status === "credited" && t.failureReason && <p className="muted-note">{t.failureReason}</p>}
      <dl className="tu-lines">
        <div><dt>Amount</dt><dd>{amount} {t.currency}</dd></div>
        <div><dt>Started</dt><dd>{dateText(t.createdAt)}</dd></div>
        {t.status === "pending" && <div><dt>Expires in</dt><dd>{mm}:{String(ss).padStart(2, "0")}</dd></div>}
        {wallet !== null && <div className="tu-total"><dt>New wallet balance</dt><dd data-testid="tu-wallet">{price(wallet)}</dd></div>}
      </dl>
      {payments?.simulate && <div className="tu-sim" role="group" aria-label="Simulate the payment provider">
        <p className="tu-sim-h">{payments.available ? "Development server" : "Demo"}: simulate the payment provider</p>
        {t.status === "pending" && <div className="tu-sim-btns"><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => simulate("paid")}>Simulate paid</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => simulate("failed")}>Simulate failed</button></div>}
        {sent && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => simulate("resend")}>Send the same event again</button>}
        {event && <p className="muted-note" role="status">{event}</p>}
      </div>}
      <div className="tu-actions"><Link className="btn btn-outline" href="/account/balance">Back to balance</Link>{t.status !== "pending" && <button type="button" className="btn btn-outline" onClick={onAgain}>Top up again</button>}</div>
    </div>
  </section>;
}

function TopUpBody() {
  const router = useRouter();
  const [id, setId] = useState<string | null | undefined>(undefined); const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  useEffect(() => { setId(readQuery("id")); api.config().then((c) => setPayments(c.payments)); }, []);
  const show = (next: string | null) => { setId(next); router.replace(next ? `${PAGE}?id=${encodeURIComponent(next)}` : PAGE, { scroll: false }); };
  if (id === undefined) return <p className="muted-note">Loading…</p>;
  return id ? <Result key={id} id={id} payments={payments} onAgain={() => show(null)} /> : <Picker payments={payments} onCreated={(t) => show(t.id)} />;
}

export default function TopUpPage() {
  return <AccountShell title="Top up your wallet" crumb="Top up" parent={{ href: "/account/balance", label: "Balance" }}>{() => <TopUpBody />}</AccountShell>;
}
