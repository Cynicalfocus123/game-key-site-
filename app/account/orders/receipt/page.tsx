"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Order, TaxInfo } from "@/lib/client/types";
import { canReceipt, COMPANY, documentTitle, parseTaxInfo, paymentText, TAX_LIMITS } from "@/lib/orders";
import { AccountShell } from "../../../components/account-shell";
import { Notice, readQuery } from "../../../components/auth-ui";
import { useCurrency } from "../../../components/currency-provider";
import { orderHref } from "../../../components/orders-ui";

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

// Optional tax details (tax is always optional, user 2026-09-29). Saved on the order; with them the document is "Tax invoice / Receipt".
function TaxForm({ order, onSaved, startOpen }: { order: Order; onSaved: (t: TaxInfo | null) => void; startOpen: boolean }) {
  const t = order.taxInfo; const [open, setOpen] = useState(startOpen && !t);
  const [f, setF] = useState<TaxInfo>(t ?? { name: "", taxId: "", address: "" }); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const save = async (tax: TaxInfo | null) => {
    if (tax) { const c = parseTaxInfo(tax); if (!c.ok) { setError(c.error); return; } }
    setBusy(true); setError(""); const r = await api.saveTaxInfo(order.id, tax); setBusy(false);
    if (!r.ok) { setError(r.error); return; } onSaved(r.taxInfo); setOpen(false);
  };
  const set = (k: keyof TaxInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return <section className="tax-box no-print" id="tax" aria-labelledby="tax-title">
    <h2 id="tax-title">Tax details <small>(optional)</small></h2>
    {!open ? <>
      {t ? <p>Tax invoice for <b>{t.name}</b> · Tax ID <code>{t.taxId}</code></p> : <p className="muted-note">Tax is optional. Add your tax ID only if you need a tax invoice. Without it, this document is your receipt.</p>}
      <div className="tax-actions"><button type="button" className="btn btn-outline" onClick={() => { setF(t ?? { name: "", taxId: "", address: "" }); setOpen(true); }}>{t ? "Edit tax details" : "Add tax details"}</button>
        {t && <button type="button" className="text-link as-link" disabled={busy} onClick={() => save(null)}>Remove tax details</button>}</div>
    </> : <form onSubmit={(e) => { e.preventDefault(); save(f); }} noValidate>
      <label className="field"><span>Name or company</span><input name="taxName" maxLength={TAX_LIMITS.name} value={f.name} onChange={set("name")} autoComplete="organization" /></label>
      <label className="field"><span>Tax ID</span><input name="taxId" maxLength={TAX_LIMITS.taxId} value={f.taxId} onChange={set("taxId")} /><small>5–20 letters, digits or dashes.</small></label>
      <label className="field"><span>Billing address</span><textarea name="taxAddress" rows={3} maxLength={TAX_LIMITS.address} value={f.address} onChange={set("address")} autoComplete="street-address" /></label>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="tax-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save tax details"}</button><button type="button" className="btn btn-outline" onClick={() => { setOpen(false); setError(""); }}>Cancel</button></div>
    </form>}
    {error && !open && <Notice tone="error">{error}</Notice>}
  </section>;
}

// Receipt (email task): a dashboard page, not an email. "Get receipt" in the order email and Receipt / Invoice Download on the order page open it.
// Print / Save as PDF uses the browser (no PDF library); print CSS shows only the document.
export default function ReceiptPage() {
  const { format } = useCurrency();
  const [order, setOrder] = useState<Order | null>(null); const [error, setError] = useState(""); const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const invoice = readQuery("doc") === "invoice";
  useEffect(() => {
    const id = readQuery("id"); if (!id) { setError("Order not found."); return; }
    api.getOrder(id).then((r) => (r.ok ? setOrder(r.order) : setError(r.error)));
    api.getSession().then((u) => u && setUser({ name: u.name, email: u.email }));
  }, []);
  const o = order; const title = documentTitle(o?.taxInfo);
  const subtotal = o ? o.subtotalMinor ?? o.items.reduce((t, i) => t + i.unitPriceCents * i.quantity, 0) : 0;
  return <AccountShell title={o ? title : "Receipt"} crumb={o ? title : "Receipt"} parent={o ? { href: orderHref(o), label: `Order ${o.number}` } : { href: "/account/orders", label: "Returns & Orders" }}>{() => <>
    {error && <><Notice tone="error">{error}</Notice><p><Link className="text-link" href="/account/orders">‹ Back to orders</Link></p></>}
    {!o ? !error && <p className="muted-note">Loading…</p> : !canReceipt(o.status) ? <><Notice>A receipt is available after the order is paid.</Notice><p><Link className="text-link" href={orderHref(o)}>‹ Back to order</Link></p></> : <>
      <div className="rcpt-bar no-print"><Link className="btn btn-outline" href={orderHref(o)}>‹ Back to order</Link><button type="button" className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button></div>
      <article className="receipt-doc" aria-label={title}>
        <header className="rcpt-top"><span className="rcpt-logo">core<span>cart</span></span><div><b>{title.toUpperCase()}</b><span>No. {o.number}</span><span>{when(o.paidAt ?? o.createdAt)}</span></div></header>
        <div className="rcpt-parties">
          <div><h3>Seller</h3><p>{COMPANY.name}</p>{COMPANY.address.map((l) => <p key={l}>{l}</p>)}<p>{COMPANY.country}</p>{COMPANY.taxId && <p>Tax ID {COMPANY.taxId}</p>}</div>
          <div><h3>Customer</h3>{o.taxInfo ? <><p>{o.taxInfo.name}</p><p>Tax ID {o.taxInfo.taxId}</p><p className="rcpt-addr">{o.taxInfo.address}</p></> : null}<p>{user?.name}</p><p>{user?.email}</p></div>
        </div>
        <table className="rcpt-items"><thead><tr><th scope="col">Item</th><th scope="col" className="num">Qty</th><th scope="col" className="num">Price</th><th scope="col" className="num">Amount</th></tr></thead>
          <tbody>{o.items.map((i) => <tr key={i.id}><td data-label="Item">{i.name}<small>{i.kind === "game_key" ? `Digital key · ${i.platform ?? ""} · ${i.region ?? ""}` : "Hardware"} · Seller {i.seller || "CoreCart"}</small></td>
            <td data-label="Qty" className="num">{i.quantity}</td><td data-label="Price" className="num">{format(i.unitPriceCents, o.currency)}</td><td data-label="Amount" className="num">{format(i.unitPriceCents * i.quantity, o.currency)}</td></tr>)}</tbody></table>
        <div className="rcpt-sum">
          <div><span>Subtotal</span><span>{format(subtotal, o.currency)}</span></div>
          {(o.discountMinor ?? 0) > 0 && <div><span>Coupon {o.promoCode ?? ""}</span><span>−{format(o.discountMinor!, o.currency)}</span></div>}
          {(o.walletMinor ?? 0) > 0 && <div><span>Paid from wallet</span><span>−{format(o.walletMinor!, o.currency)}</span></div>}
          <div className="rcpt-total"><span>Total paid</span><span>{format(o.totalCents, o.currency)}</span></div>
        </div>
        <p className="rcpt-paid">Paid by {paymentText(o.paymentMethod, o.paymentLast4)} on {when(o.paidAt ?? o.createdAt)}.{o.status === "refunded" && " This order was refunded."}</p>
        <p className="rcpt-foot">Thank you for your purchase. Questions? Open a ticket in your CoreCart account and quote {o.number}.</p>
      </article>
      <TaxForm order={o} startOpen={invoice} onSaved={(t) => setOrder({ ...o, taxInfo: t })} />
    </>}
  </>}</AccountShell>;
}
