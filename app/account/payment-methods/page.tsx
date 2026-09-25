"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { PaymentMethod } from "@/lib/client/types";
import { AccountShell } from "../../components/account-shell";
import { Notice, readQuery } from "../../components/auth-ui";

const testCards = [{ brand: "visa", last4: "4242", label: "Visa test card" }, { brand: "mastercard", last4: "4444", label: "Mastercard test card" }];

export default function PaymentMethodsPage() {
  const [data, setData] = useState<{ configured: boolean; methods: PaymentMethod[] } | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [added, setAdded] = useState(false);
  const load = useCallback(() => api.listPaymentMethods().then(r => r.ok ? setData({ configured: r.configured, methods: r.methods }) : setError(r.error)), []);
  useEffect(() => { setAdded(readQuery("added") === "1"); load(); }, [load]);
  const add = async (card?: { brand: string; last4: string }) => {
    setBusy(true); setError("");
    const r = await api.addPaymentMethod(card);
    if (!r.ok) { setBusy(false); return setError(r.error); }
    if (r.redirect) { window.location.href = r.redirect; return; }
    setBusy(false); setAdded(true); load();
  };
  const remove = async (id: string) => { const r = await api.removePaymentMethod(id); if (!r.ok) setError(r.error); else load(); };
  return <AccountShell title="Payment methods">{() => <>
    <p className="muted-note">Card numbers are never stored by CoreCart. Cards are saved by Stripe, our payment processor. PromptPay is chosen at checkout and is not saved.</p>
    {added && <Notice tone="success">Card saved.</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    {data === null ? <p className="muted-note">Loading…</p> : <>
      {data.methods.length === 0 ? <p className="empty">No saved cards.</p> :
        <ul className="card-list">{data.methods.map(m => <li key={m.id}><span className="card-brand">{m.brand}</span><span>•••• {m.last4}</span><small>Expires {String(m.expMonth).padStart(2, "0")}/{m.expYear}</small><button className="text-link as-link" onClick={() => remove(m.id)}>Remove</button></li>)}</ul>}
      {api.mode === "demo" ? <div className="acct-actions"><strong>Add a test card (demo)</strong><small className="muted-note">Demo mode never asks for a card number.</small>{testCards.map(c => <button key={c.last4} className="btn btn-outline" disabled={busy} onClick={() => add(c)}>+ {c.label} •••• {c.last4}</button>)}</div>
        : data.configured ? <div className="acct-actions"><button className="btn btn-primary" disabled={busy} onClick={() => add()}>{busy ? "Opening Stripe…" : "Add card"}</button><small className="muted-note">Opens a secure Stripe page. Test mode card: 4242 4242 4242 4242.</small></div>
        : <Notice>Stripe is not connected yet. Add STRIPE_SECRET_KEY (test mode) to .env.local to enable saving cards.</Notice>}
    </>}
  </>}</AccountShell>;
}
