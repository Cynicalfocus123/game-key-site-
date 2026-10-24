"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminMarketApi, money } from "@/lib/client/api";
import { ORDER_NOTE_MAX, VIEW_CHIP, VIEW_LABEL, type AdminOrderDetail } from "@/lib/admin-orders";
import { billingShort } from "@/lib/address-formats";
import { paymentText } from "@/lib/orders";
import { AdminShell, dateTime, device } from "../../../components/admin-shell";
import { Notice, readQuery } from "../../../components/auth-ui";

// Admin order detail (wireframe screen B, approved 2026-10-24): items with seller + key status, the full key behind "Show key" (every view is
// logged in the timeline: who, when — evidence for support), buyer (email, account since, IP + browser, billing address), payment, timeline.
// Actions: resend "Order confirmed" (paid), add a note, cancel (pending only: held keys back on sale). Refunds to card need a payment provider.
const usd = (c: number | null) => (c === null ? "—" : money(c, "USD"));

function Detail() {
  const [o, setO] = useState<AdminOrderDetail | null>(null); const [error, setError] = useState(""); const [msg, setMsg] = useState("");
  const [shown, setShown] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false); const [note, setNote] = useState(""); const [cancelOpen, setCancelOpen] = useState(false);
  useEffect(() => {
    const id = readQuery("id"); if (!id) { setError("Missing order id."); return; }
    adminMarketApi.order(id).then((r) => (r.ok ? setO(r.order) : setError(r.error)));
  }, []);
  if (error && !o) return <><Notice tone="error">{error}</Notice><Link className="text-link" href="/admin/orders">← Back to orders</Link></>;
  if (!o) return <p className="muted-note">Loading…</p>;
  const act = async (a: Parameters<typeof adminMarketApi.orderAction>[1], done: string) => {
    setBusy(true); setError(""); setMsg(""); const r = await adminMarketApi.orderAction(o.id, a); setBusy(false);
    if (!r.ok) { setError(r.error); return null; }
    setO(r.order); if (done) setMsg(done); return r;
  };
  const showKey = async (keyId: string) => { const r = await act({ action: "show_key", keyId }, ""); if (r?.code) setShown((s) => ({ ...s, [keyId]: r.code! })); };
  const m = (minor: number) => money(minor, o.currency);
  return <>
    <p className="adm-back"><Link className="text-link" href="/admin/orders">← All orders</Link></p>
    <div className="adm-head"><h2 className="mono">{o.number}</h2><span className={`chip ${VIEW_CHIP[o.view]}`} data-testid="ord-status">{VIEW_LABEL[o.view]}</span></div>
    <div className="ord-actions">
      <button type="button" className="btn btn-outline btn-sm" disabled={busy || !o.canResend} title={o.canResend ? undefined : "Only a paid order has this email"} onClick={() => act({ action: "resend" }, "\"Order confirmed\" email sent again.")}>Resend &quot;Order confirmed&quot; email</button>
      <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setNoteOpen(true); setCancelOpen(false); }}>Add note</button>
      <Link className="btn btn-outline btn-sm" href={`/admin/tickets?q=${encodeURIComponent(o.number)}`}>Buyer&apos;s tickets ({o.tickets})</Link>
      {o.canCancel && <button type="button" className="btn btn-outline btn-sm ord-danger" disabled={busy} onClick={() => { setCancelOpen(true); setNoteOpen(false); }}>Cancel order…</button>}
      <span className="muted-note">Refund to card: needs a payment provider (manual note until then).</span>
    </div>
    {noteOpen && <div className="wal-confirm" role="dialog" aria-label="Add note">
      <label className="field"><span>Note (admins only, saved in the timeline with your name)</span><textarea rows={3} maxLength={ORDER_NOTE_MAX} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Buyer says the key was already used — asked the seller for proof." /></label>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy || !note.trim()} onClick={async () => { if (await act({ action: "note", text: note }, "Note saved.")) { setNote(""); setNoteOpen(false); } }}>Save note</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setNoteOpen(false)}>Close</button></div>
    </div>}
    {cancelOpen && <div className="wal-confirm" role="alertdialog" aria-label="Cancel order">
      <p>Cancel {o.number}? The held keys go back on sale and the buyer can no longer pay this order. Nothing is charged.</p>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { if (await act({ action: "cancel" }, "Order cancelled. Held keys are back on sale.")) setCancelOpen(false); }}>Cancel order</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setCancelOpen(false)}>Keep it</button></div>
    </div>}
    {msg && <Notice tone="success">{msg}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    {o.reviewNote && <Notice tone="error"><strong>Needs review:</strong> {o.reviewNote}</Notice>}
    <div className="ord-grid">
      <div>
        <section className="adm-panel" aria-labelledby="ord-items-h"><h2 id="ord-items-h">Items</h2>
          <ul className="ord-lines">{o.lines.map((l) => <li key={l.id}>
            <div className="ord-line-top"><div><strong>{l.name}</strong> <span className="muted-note">×{l.quantity}</span><small>{[l.platform, l.region].filter(Boolean).join(" · ") || (l.kind === "hardware" ? "Hardware" : "")}</small></div>
              <div className="num"><strong>{m(l.unitPriceCents * l.quantity)}</strong>{l.quantity > 1 && <small>{m(l.unitPriceCents)} each</small>}</div></div>
            <p className="ord-line-seller">Sold by {l.sellerSlug ? <Link className="text-link" href={`/store?s=${encodeURIComponent(l.sellerSlug)}`}>{l.seller}</Link> : <strong>{l.seller}</strong>}
              {l.unitUsdCents !== null && <> · seller price {usd(l.unitUsdCents)} · seller gets {l.receiveUsdCents === null ? "price − commission (% pending)" : usd(l.receiveUsdCents * l.quantity)}</>}</p>
            {l.held > 0 && <p className="muted-note">{l.held} key{l.held === 1 ? "" : "s"} held for this order</p>}
            {l.keys.length > 0 && <ul className="ord-keylist">{l.keys.map((k) => <li key={k.id}>
              <span className={`chip ${k.state === "revealed" ? "chip-green" : k.state === "returned" ? "chip-blue" : "chip-grey"}`}>{k.state === "revealed" ? "Revealed" : k.state === "returned" ? "Returned" : "Delivered"}</span>
              <code className="ord-code" data-testid="ord-code">{shown[k.id] ?? `•••••-•••••-•••••-${k.last4}`}</code>
              {shown[k.id] ? <button type="button" className="as-link text-link" onClick={() => setShown((s) => { const n = { ...s }; delete n[k.id]; return n; })}>Hide</button>
                : <button type="button" className="as-link text-link" disabled={busy} onClick={() => showKey(k.id)}>Show key</button>}
              <small>{k.revealedAt ? `buyer revealed ${dateTime(k.revealedAt)}` : k.state === "returned" ? `returned ${dateTime(k.returnedAt)}` : "not revealed"}</small>
            </li>)}</ul>}
          </li>)}</ul>
          <p className="muted-note">Every &quot;Show key&quot; is saved in the timeline with your email (evidence for support).</p>
        </section>
        <section className="adm-panel" aria-labelledby="ord-tl-h"><h2 id="ord-tl-h">Timeline</h2>
          <ol className="ord-timeline">{o.timeline.map((e, n) => <li key={n} className={`tl-${e.tone}`}><time>{dateTime(e.at)}</time><span>{e.text}</span></li>)}</ol>
        </section>
      </div>
      <div>
        <section className="adm-panel" aria-labelledby="ord-buyer-h"><h2 id="ord-buyer-h">Buyer</h2>
          <dl className="ord-dl">
            <dt>Name</dt><dd>{o.buyer.name} <Link className="text-link" href={`/admin/user?id=${encodeURIComponent(o.buyer.id)}`}>Open user ›</Link></dd>
            <dt>Email</dt><dd>{o.buyer.email}</dd>
            <dt>Account since</dt><dd>{dateTime(o.buyerSince)}</dd>
            <dt>IP · browser</dt><dd>{o.ipAddress ?? "—"} · {device(o.userAgent)}</dd>
            <dt>Billing address</dt><dd>{o.billing ? billingShort(o.billing, true) : "—"}</dd>
          </dl>
        </section>
        <section className="adm-panel" aria-labelledby="ord-pay-h"><h2 id="ord-pay-h">Payment</h2>
          <dl className="ord-dl">
            <dt>Method</dt><dd>{paymentText(o.method, o.last4)}</dd>
            {o.subtotalMinor !== null && <><dt>Sub-total</dt><dd>{m(o.subtotalMinor)}</dd></>}
            <dt>Coupon</dt><dd>{o.promoCode ? `${o.promoCode} (−${m(o.discountMinor)})` : "—"}</dd>
            <dt>Service fee</dt><dd>{m(o.serviceFeeMinor)}</dd>
            <dt>Tax</dt><dd>{m(o.taxMinor)}</dd>
            <dt>Wallet used</dt><dd>{m(o.walletMinor)}</dd>
            <dt><strong>Total charged</strong></dt><dd><strong>{m(o.totalCents)} {o.currency}</strong>{o.fxRate && o.currency !== "THB" && <small> rate {o.fxRate} per 1 THB{o.ratesAt ? ` (${dateTime(o.ratesAt)})` : ""}</small>}</dd>
            <dt>Created</dt><dd>{dateTime(o.createdAt)}</dd>
            <dt>Paid at</dt><dd>{dateTime(o.paidAt)}</dd>
            {o.provider && <><dt>Provider</dt><dd>{o.provider}{o.providerRef ? ` · ${o.providerRef}` : ""}</dd></>}
            {o.failureReason && <><dt>Note</dt><dd>{o.failureReason}</dd></>}
          </dl>
        </section>
      </div>
    </div>
  </>;
}

export default function Page() { return <AdminShell title="Order"><Detail /></AdminShell>; }
