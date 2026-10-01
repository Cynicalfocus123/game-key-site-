"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, dateText, isDemo, money } from "@/lib/client/api";
import type { BankInfo, PaymentsConfig, TopUp } from "@/lib/client/types";
import { DEMO_GIFT } from "@/lib/client/demo-api";
import { chargeCurrency, convertMinor, formatMoney, type SiteCurrency } from "@/lib/currency/money";
import { formatTyping, typeLabel, type BalanceData } from "@/lib/gift-cards";
import { checkAmount, METHOD_LABEL, STATUS_CHIP, statusLabel, toMinor, topUpLimits, TOPUP_ERRORS, USD_RATE } from "@/lib/topup";
import { AccountShell } from "../../components/account-shell";
import { Notice } from "../../components/auth-ui";
import { Flag, useCurrency } from "../../components/currency-provider";
import { PaymentTiles } from "../../components/payment-logos";

// Wallet (top-up redesign 2026-10-01, wireframe Claude outputs/wireframes/topup-wireframe.png; was "Balance").
// Balance card → Add funds (5 one-click TOP UP cards) → custom amount: Payment methods / Bank transfer / Gift card (cards on the right on
// desktop, tabs on phones) → Top up history → Transactions. Card top-ups go to the provider (demo / dev: the result page simulates it);
// the wallet is credited only by the provider webhook, or for a bank transfer only when an admin confirms the money arrived.
const RESULT = "/account/balance/top-up";
const newKey = () => crypto.randomUUID();
type Tab = "card" | "bank" | "gift";
const TABS: { id: Tab; title: string; sub: string }[] = [
  { id: "card", title: "Payment methods", sub: "Card, wallets, bank apps · instant" },
  { id: "bank", title: "Bank transfer", sub: "From your bank · 1–2 business days" },
  { id: "gift", title: "Gift card", sub: "Redeem a CoreCart gift card code" },
];

// Shared amount box: currency picker (flag + code) + amount input + "Min limit … · Max limit …" line.
function AmountBox({ id, cur, options, onCurrency, value, onValue, invalid, describedBy }: { id: string; cur: SiteCurrency; options: SiteCurrency[]; onCurrency: (code: string) => void;
  value: string; onValue: (v: string) => void; invalid: boolean; describedBy: string }) {
  return <div className={`wal-amount${invalid ? " is-bad" : ""}`}>
    <label className="wal-cur"><Flag code={cur.code} /><span className="sr-only">Currency</span>
      <select value={cur.code} onChange={(e) => onCurrency(e.target.value)} disabled={options.length < 2}>{options.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label>
    <label className="wal-amount-in"><span className="sr-only">Amount ({cur.code})</span>
      <input id={id} inputMode="decimal" autoComplete="off" value={value} placeholder="0.00" aria-invalid={invalid || undefined} aria-describedby={describedBy}
        onChange={(e) => onValue(e.target.value.replace(/[^\d.,]/g, "").slice(0, 14))} /></label>
  </div>;
}

function useLimits(cur: SiteCurrency) {
  const { currencies } = useCurrency();
  return useMemo(() => topUpLimits(cur, currencies.find((c) => c.code === "USD") ?? USD_RATE), [cur, currencies]);
}
const limitText = (l: ReturnType<typeof topUpLimits>, cur: SiteCurrency) => `Min limit ${formatMoney(l.min, cur)} · Max limit ${formatMoney(l.max, cur)} per top-up`;

// Start a card top-up and leave the page: provider page (redirect) or the result page (demo / dev simulate, or client-side provider later).
async function startCard(amountMinor: number, currency: string, router: ReturnType<typeof useRouter>): Promise<string | null> {
  const r = await api.createTopUp({ amountMinor, currency, idempotencyKey: newKey(), method: "card" });
  if (!r.ok) return r.error;
  if (r.payment?.kind === "redirect") { window.location.assign(r.payment.url); return null; }
  router.push(`${RESULT}?id=${encodeURIComponent(r.topUp.id)}`);
  return null;
}

function AddFunds({ pay, payments }: { pay: SiteCurrency; payments: PaymentsConfig | null }) {
  const router = useRouter(); const { base, currencies } = useCurrency(); const limits = useLimits(pay);
  // "≈ ฿340": the wallet (base currency) estimate, whole units like the wireframe.
  const sym = currencies.find((c) => c.code === base.code)?.symbol ?? `${base.code} `;
  const approx = (minor: number) => `≈ ${sym}${Math.round(convertMinor(minor, pay, base) / 10 ** base.decimals).toLocaleString("en-US")}`;
  const [busy, setBusy] = useState<number | null>(null); const [error, setError] = useState("");
  const can = Boolean(payments?.available || payments?.simulate);
  const go = async (amount: number) => {
    if (busy !== null) return; setBusy(amount); setError("");
    const e = await startCard(amount, pay.code, router); if (e) { setError(e); setBusy(null); }
  };
  return <section className="wal-sec" aria-labelledby="wal-add-h">
    <div className="wal-sec-head"><h2 id="wal-add-h">Add funds</h2><span className="muted-note">One click: starts a top-up for that amount</span></div>
    {error && <Notice tone="error">{error}</Notice>}
    <ul className="wal-presets">{limits.presets.map((p) => <li key={p} className="wal-preset">
      <strong>{formatMoney(p, pay)}</strong>
      {pay.code !== base.code && <small>{approx(p)}</small>}
      <button type="button" className="btn wal-go" disabled={!can || busy !== null} aria-label={`Top up ${formatMoney(p, pay)}`} onClick={() => go(p)}>{busy === p ? "Starting…" : "TOP UP"}</button>
    </li>)}</ul>
    {!payments ? null : !can ? <p className="muted-note">Card payments coming soon. You can top up by bank transfer or redeem a gift card below.</p>
      : !payments.available && <p className="muted-note">Demo: no card is charged. The next page stands in for the payment provider.</p>}
  </section>;
}

function CardPanel({ pay: start, payments, total, dailyLeft }: { pay: SiteCurrency; payments: PaymentsConfig | null; total: number; dailyLeft: number | null }) {
  const router = useRouter(); const { currencies, base, price } = useCurrency();
  const options = currencies.filter((c) => c.chargeable);
  const [code, setCode] = useState(start.code); useEffect(() => setCode(start.code), [start.code]);
  const cur = options.find((c) => c.code === code) ?? start; const limits = useLimits(cur);
  const [value, setValue] = useState(""); const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const amount = toMinor(value, cur.decimals);
  const amountError = value.trim() ? checkAmount(amount ?? 0, limits, cur.symbol) : TOPUP_ERRORS.amount;
  const credit = amount && !amountError ? convertMinor(amount, cur, base) : 0;
  const can = Boolean(payments?.available || payments?.simulate);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); if (!amount || amountError || busy || !can) return;
    setBusy(true); setError(""); const err = await startCard(amount, cur.code, router); if (err) { setError(err); setBusy(false); }
  };
  return <form className="wal-panel-body" onSubmit={submit} noValidate>
    <h3>Top up with payment methods</h3>
    <p className="muted-note">Card, wallets and bank apps. Your balance is updated as soon as the payment is confirmed.</p>
    <div className="wal-logos"><PaymentTiles /></div>
    <AmountBox id="wal-card-amount" cur={cur} options={options} onCurrency={(c) => { setCode(c); setError(""); }} value={value} onValue={(v) => { setValue(v); setTouched(true); setError(""); }}
      invalid={touched && Boolean(value.trim()) && Boolean(amountError)} describedBy="wal-card-limits" />
    <p id="wal-card-limits" className="muted-note wal-limits">{limitText(limits, cur)}{dailyLeft !== null && <> · up to <strong data-testid="tu-left">{formatMoney(Math.floor(convertMinor(dailyLeft, base, { ...cur, roundStep: 1 })), cur)}</strong> more today</>}</p>
    {touched && value.trim() && amountError && <small className="field-error" role="alert">{amountError}</small>}
    <dl className="tu-lines wal-sum">
      <div><dt>You pay</dt><dd data-testid="tu-pay">{credit ? `${formatMoney(amount!, cur)} ${cur.code}` : "—"}</dd></div>
      <div><dt>Added to your wallet</dt><dd>{credit ? price(credit) : "—"}</dd></div>
      <div className="tu-total"><dt>New balance</dt><dd>{price(total + credit)}</dd></div>
    </dl>
    {error && <Notice tone="error">{error}</Notice>}
    <button className="btn wal-go wal-go-big" disabled={!can || busy}>{busy ? "Starting…" : "TOP UP BALANCE"}</button>
    {payments && !can && <p className="muted-note">Card payments coming soon.</p>}
    {payments?.simulate && !payments.available && <p className="muted-note">Demo: no card is charged. The next page stands in for the payment provider.</p>}
    <p className="wal-secure"><svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" strokeWidth="2" d="M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5z" /></svg>Secure payment. Card details never touch CoreCart.</p>
  </form>;
}

function BankPanel({ bank, pay, onSent }: { bank: BankInfo | null; pay: SiteCurrency; onSent: () => void }) {
  const { currencies } = useCurrency();
  const options = currencies.filter((c) => bank?.currencies.includes(c.code));
  const [code, setCode] = useState(""); const cur = options.find((c) => c.code === code) ?? options.find((c) => c.code === pay.code) ?? options[0];
  const limits = useLimits(cur ?? pay);
  const [value, setValue] = useState(""); const [touched, setTouched] = useState(false); const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const key = useRef(newKey());
  if (!bank || !cur) return <div className="wal-panel-body"><h3>Bank transfer</h3><p className="wal-soon" role="status">Bank transfer is coming soon.</p>
    <p className="muted-note">Until then, top up with a payment method or redeem a gift card.</p></div>;
  const amount = toMinor(value, cur.decimals);
  const amountError = value.trim() ? checkAmount(amount ?? 0, limits, cur.symbol) : TOPUP_ERRORS.amount;
  const copy = async () => { try { await navigator.clipboard.writeText(bank.reference); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); if (!amount || amountError || busy) return;
    setBusy(true); setMsg(null);
    const r = await api.createTopUp({ amountMinor: amount, currency: cur.code, idempotencyKey: key.current, method: "bank" }); setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: r.error }); return; }
    key.current = newKey(); setValue(""); setTouched(false);
    setMsg({ tone: "success", text: `Thanks. Transfer ${r.topUp.number} (${formatMoney(r.topUp.amountMinor, cur)} ${cur.code}) is waiting for the money to arrive. We add it to your wallet within 1–2 business days after it arrives.` });
    onSent();
  };
  return <form className="wal-panel-body" onSubmit={submit} noValidate>
    <h3>Bank transfer</h3>
    <p className="muted-note">Send money from your bank to ours. Put your reference in the transfer note so we know it is you. We add it to your wallet within 1–2 business days after it arrives.</p>
    <AmountBox id="wal-bank-amount" cur={cur} options={options} onCurrency={(c) => { setCode(c); setMsg(null); }} value={value} onValue={(v) => { setValue(v); setTouched(true); setMsg(null); }}
      invalid={touched && Boolean(value.trim()) && Boolean(amountError)} describedBy="wal-bank-limits" />
    <p id="wal-bank-limits" className="muted-note wal-limits">{limitText(limits, cur)}</p>
    {touched && value.trim() && amountError && <small className="field-error" role="alert">{amountError}</small>}
    <dl className="wal-bank" aria-label="Our bank details">
      <div><dt>Bank</dt><dd>{bank.bankName}</dd></div>
      <div><dt>Account name</dt><dd>{bank.accountName}</dd></div>
      <div><dt>Account number / IBAN</dt><dd>{bank.accountNumber}</dd></div>
      {bank.swift && <div><dt>SWIFT / BIC</dt><dd>{bank.swift}</dd></div>}
    </dl>
    <div className="wal-myref"><div><small>Your reference (always the same for you)</small><strong data-testid="bank-ref">{bank.reference}</strong></div>
      <button type="button" className="btn btn-outline btn-sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button></div>
    <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
    <button className="btn btn-primary wal-sent" disabled={busy}>{busy ? "Saving…" : "I have sent the transfer"}</button>
    <p className="wal-warn">⚠ Without the reference we cannot match your money. Bank fees are paid by you.</p>
  </form>;
}

function GiftPanel({ open, onDone }: { open: boolean; onDone: (b: BalanceData) => void }) {
  const { price } = useCurrency(); const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  useEffect(() => { if (open && window.location.hash === "#redeem") { input.current?.scrollIntoView({ block: "center" }); input.current?.focus(); } }, [open]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setMsg(null);
    const r = await api.redeemGiftCard(code); setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: r.error }); input.current?.focus(); return; }
    setCode(""); setMsg({ tone: "success", text: `${price(r.amountMinor)} added to your gift card balance.` }); onDone(r.balance);
  };
  return <form id="redeem" className="wal-panel-body bal-redeem" onSubmit={submit} noValidate>
    <h3>Gift card</h3>
    <p className="muted-note">Have a CoreCart gift card? Enter the code. The full amount goes to your gift card balance.</p>
    <label className="sr-only" htmlFor="gift-code">Gift card code</label>
    <div className="bal-redeem-row">
      <input id="gift-code" ref={input} name="giftCode" className="bal-code" value={code} onChange={(e) => setCode(formatTyping(e.target.value))} placeholder="XXXX-XXXX-XXXX-XXXX"
        autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={19} aria-describedby="gift-help" aria-invalid={msg?.tone === "error" || undefined} />
      <button className="btn btn-primary" disabled={busy || code.replace(/-/g, "").length < 16}>{busy ? "Redeeming…" : "Redeem"}</button>
    </div>
    <small id="gift-help" className="muted-note">16 characters. Each code works once.</small>
    {isDemo && <small className="muted-note">Demo: try <code>{DEMO_GIFT.code}</code> (works once per browser), or create codes in Admin › Gift cards.</small>}
    <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
  </form>;
}

function History({ topUps }: { topUps: TopUp[] }) {
  const [all, setAll] = useState(false); const rows = all ? topUps : topUps.slice(0, 5);
  return <section id="tu-history" className="wal-sec bal-topups" aria-labelledby="tu-list-h">
    <div className="wal-sec-head"><h2 id="tu-list-h">Top up history</h2>
      {topUps.length > 5 && <button type="button" className="text-link wal-all" aria-expanded={all} onClick={() => setAll(!all)}>{all ? "Show less" : "See all"}</button>}</div>
    {!topUps.length ? <p className="muted-note">No top-ups yet.</p> : <table className="dash-table bal-table">
      <thead><tr><th scope="col">Date</th><th scope="col">Number</th><th scope="col">Method</th><th scope="col" className="num">Amount</th><th scope="col">Status</th></tr></thead>
      <tbody>{rows.map((t) => <tr key={t.id}>
        <td data-label="Date">{dateText(t.createdAt)}</td>
        <td data-label="Number"><Link className="text-link" href={`${RESULT}?id=${encodeURIComponent(t.id)}`}>{t.number}</Link></td>
        <td data-label="Method">{METHOD_LABEL[t.method]}</td>
        <td data-label="Amount" className="num">{money(t.amountMinor, t.currency)} {t.currency}</td>
        <td data-label="Status"><span className={`chip ${STATUS_CHIP[t.status]}`}>{statusLabel(t)}</span></td>
      </tr>)}</tbody>
    </table>}
  </section>;
}

export default function WalletPage() {
  const { currency, currencies, price } = useCurrency();
  const pay = chargeCurrency(currency, currencies) ?? currency;
  const [data, setData] = useState<BalanceData | null>(null); const [error, setError] = useState("");
  const [topUps, setTopUps] = useState<TopUp[]>([]); const [bank, setBank] = useState<BankInfo | null>(null); const [left, setLeft] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentsConfig | null>(null);
  const [tab, setTab] = useState<Tab>("card");
  const loadTopUps = useCallback(() => api.topUps().then((r) => { if (r.ok) { setTopUps(r.topUps); setBank(r.bank); setLeft(r.dailyLeftMinor); } }), []);
  useEffect(() => {
    let live = true;
    api.balance().then((r) => { if (live) { if (r.ok) setData(r.balance); else setError(r.error); } });
    api.config().then((c) => { if (live) setPayments(c.payments); });
    loadTopUps();
    if (window.location.hash === "#redeem") setTab("gift");
    return () => { live = false; };
  }, [loadTopUps]);
  const signed = (m: number) => `${m >= 0 ? "+" : "−"}${price(Math.abs(m))}`;
  const pick = (t: Tab) => { setTab(t); };
  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab); const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return; e.preventDefault(); const next = TABS[(i + d + TABS.length) % TABS.length].id; setTab(next); document.getElementById(`wal-tab-${next}`)?.focus();
  };
  return <AccountShell title="Wallet">{() => <>
    {error && <Notice tone="error">{error}</Notice>}
    {!data ? !error && <p className="muted-note">Loading…</p> : <>
      <section className="wal-card" aria-label="Current available balance">
        <Flag code={currency.code} />
        <div className="wal-card-main"><span>Current available balance</span>
          <p><strong data-testid="total-balance">{price(data.walletMinor + data.giftMinor)}</strong> <span className="wal-cur-name">{currency.name}</span></p></div>
        <div className="wal-card-side"><span>Wallet <b data-testid="wallet-balance">{price(data.walletMinor)}</b> · Gift card <b data-testid="gift-balance">{price(data.giftMinor)}</b></span>
          <a className="text-link" href="#tu-history">Top up history</a></div>
      </section>

      <AddFunds pay={pay} payments={payments} />

      <section className="wal-sec" aria-labelledby="wal-custom-h">
        <div className="wal-sec-head"><h2 id="wal-custom-h">Top up a custom amount</h2></div>
        <div className="wal-custom">
          <div className="wal-tabs" role="tablist" aria-label="Top-up method" aria-orientation="vertical" onKeyDown={onKey}>
            {TABS.map((t) => <button key={t.id} id={`wal-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`wal-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
              className={`wal-tab${tab === t.id ? " is-on" : ""}`} onClick={() => pick(t.id)}><span className="wal-dot" aria-hidden="true" /><span><strong>{t.title}</strong><small>{t.sub}</small></span></button>)}
          </div>
          {TABS.map((t) => <div key={t.id} id={`wal-panel-${t.id}`} role="tabpanel" aria-labelledby={`wal-tab-${t.id}`} className="dash-card wal-panel" hidden={tab !== t.id}>
            {t.id === "card" ? <CardPanel pay={pay} payments={payments} total={data.walletMinor + data.giftMinor} dailyLeft={left} />
              : t.id === "bank" ? <BankPanel bank={bank} pay={pay} onSent={loadTopUps} />
              : <GiftPanel open={tab === "gift"} onDone={setData} />}
          </div>)}
        </div>
      </section>

      <History topUps={topUps} />

      <section className="wal-sec bal-tx" aria-labelledby="tx-h">
        <div className="wal-sec-head"><h2 id="tx-h">Transactions</h2></div>
        <table className="dash-table bal-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Ref</th><th scope="col" className="num">Amount</th><th scope="col" className="num">Balance</th></tr></thead>
          <tbody>{data.transactions.length === 0 ? <tr><td colSpan={5} className="bal-empty">No transactions yet. Top-ups, redeemed gift cards and refunds appear here.</td></tr>
            : data.transactions.map((t) => <tr key={t.id}>
              <td data-label="Date">{dateText(t.createdAt)}</td>
              <td data-label="Type">{typeLabel(t.type)}</td>
              <td data-label="Ref"><code>{t.ref}</code></td>
              <td data-label="Amount" className={`num ${t.amountMinor >= 0 ? "bal-plus" : "bal-minus"}`}>{signed(t.amountMinor)}</td>
              <td data-label="Balance" className="num">{price(t.balanceMinor)}</td>
            </tr>)}</tbody>
        </table>
      </section>
    </>}
  </>}</AccountShell>;
}
