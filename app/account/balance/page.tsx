"use client";

import { useEffect, useRef, useState } from "react";
import { api, dateText, isDemo } from "@/lib/client/api";
import { DEMO_GIFT } from "@/lib/client/demo-api";
import { formatTyping, typeLabel, type BalanceData } from "@/lib/gift-cards";
import { AccountShell } from "../../components/account-shell";
import { Notice } from "../../components/auth-ui";
import { useCurrency } from "../../components/currency-provider";

// Balance (Handoff v8 C3): Wallet + Gift card tiles, redeem field (#redeem), transactions table. Amounts are THB satang shown in the chosen currency.
function Redeem({ onDone }: { onDone: (b: BalanceData) => void }) {
  const { price } = useCurrency(); const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  useEffect(() => { if (window.location.hash === "#redeem") { input.current?.scrollIntoView({ block: "center" }); input.current?.focus(); } }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setMsg(null);
    const r = await api.redeemGiftCard(code); setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: r.error }); input.current?.focus(); return; }
    setCode(""); setMsg({ tone: "success", text: `${price(r.amountMinor)} added to your gift card balance.` }); onDone(r.balance);
  };
  return <section id="redeem" className="dash-card bal-redeem" aria-labelledby="redeem-h">
    <header className="dash-head"><h2 id="redeem-h">Redeem a gift card</h2></header>
    <form className="dash-pad" onSubmit={submit} noValidate>
      <label className="field" htmlFor="gift-code">Gift card code</label>
      <div className="bal-redeem-row">
        <input id="gift-code" ref={input} name="giftCode" className="bal-code" value={code} onChange={(e) => setCode(formatTyping(e.target.value))} placeholder="XXXX-XXXX-XXXX-XXXX"
          autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={19} aria-describedby="gift-help" aria-invalid={msg?.tone === "error" || undefined} />
        <button className="btn btn-primary" disabled={busy || code.replace(/-/g, "").length < 16}>{busy ? "Redeeming…" : "Redeem"}</button>
      </div>
      <small id="gift-help" className="muted-note">16 characters. Each code works once; the full amount goes to your gift card balance.</small>
      {isDemo && <small className="muted-note">Demo: try <code>{DEMO_GIFT.code}</code> (works once per browser), or create codes in Admin › Gift cards.</small>}
      <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
    </form>
  </section>;
}

export default function BalancePage() {
  const { price } = useCurrency();
  const [data, setData] = useState<BalanceData | null>(null); const [error, setError] = useState("");
  useEffect(() => { api.balance().then((r) => (r.ok ? setData(r.balance) : setError(r.error))); }, []);
  const signed = (m: number) => `${m >= 0 ? "+" : "−"}${price(Math.abs(m))}`;
  return <AccountShell title="Balance">{() => <>
    {error && <Notice tone="error">{error}</Notice>}
    {!data ? !error && <p className="muted-note">Loading…</p> : <>
      <p className="bal-total">Total balance <strong>{price(data.walletMinor + data.giftMinor)}</strong> <span className="muted-note">Estimated from the most recent conversion rate.</span></p>
      <div className="dash-grid bal-tiles">
        <div className="dash-card bal-tile"><span className="dash-label">Wallet</span><strong data-testid="wallet-balance">{price(data.walletMinor)}</strong><small>Refunds and store credit. Top-ups are coming later.</small></div>
        <div className="dash-card bal-tile"><span className="dash-label">Gift card balance</span><strong data-testid="gift-balance">{price(data.giftMinor)}</strong><small>Available to spend on CoreCart only</small></div>
      </div>
      <Redeem onDone={setData} />
      <section className="bal-tx" aria-labelledby="tx-h">
        <h2 id="tx-h" className="bal-h">Transactions</h2>
        <table className="dash-table bal-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Ref</th><th scope="col" className="num">Amount</th><th scope="col" className="num">Balance</th></tr></thead>
          <tbody>{data.transactions.length === 0 ? <tr><td colSpan={5} className="bal-empty">No transactions yet. Redeemed gift cards and refunds appear here.</td></tr>
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
