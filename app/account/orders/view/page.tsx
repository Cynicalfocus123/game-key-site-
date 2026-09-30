"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { GameKey, Order, OrderItem, Rating, ReturnRequest } from "@/lib/client/types";
import { canRate, canReceipt, COMPANY, CORECART_SELLER, orderStatus, paymentText } from "@/lib/orders";
import { eligibility, holdsUnits, NOT_ELIGIBLE, STATUS_LABEL } from "@/lib/returns";
import { AccountShell, Cover } from "../../../components/account-shell";
import { Notice, readQuery } from "../../../components/auth-ui";
import { useCurrency } from "../../../components/currency-provider";
import { KeyLinks, OrderStatusText, RatingDialog, receiptHref, ReturnForm, Stars } from "../../../components/orders-ui";

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

// Order page = the order's receipt detail (email task, Eneba style): Ordered products (delivery status, Rate the seller, Reveal / View key, Request return),
// Payment details, Order summary, Receipt (+ optional tax ID). Target of the email buttons Get key / Rate the seller (?rate=1) and the Orders list rows.
export default function OrderViewPage() {
  const { format, price } = useCurrency(); const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null); const [error, setError] = useState("");
  const [keys, setKeys] = useState<GameKey[]>([]); const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [form, setForm] = useState<string | null>(null); const [sent, setSent] = useState(""); const [rate, setRate] = useState<string | null>(null);
  const load = useCallback(async () => {
    const id = readQuery("id"); if (!id) { setError("Order not found."); return; }
    const [o, k, rt] = await Promise.all([api.getOrder(id), api.listKeys(), api.listReturns()]);
    if (!o.ok) { setError(o.error); return; }
    setOrder(o.order); if (k.ok) setKeys(k.keys); if (rt.ok) setReturns(rt.returns);
    return o.order;
  }, []);
  useEffect(() => { load().then((o) => { if (o && readQuery("rate") === "1" && canRate(o.status)) setRate(o.items[0]?.seller || CORECART_SELLER); }); }, [load]);

  const facts = (o: Order, i: OrderItem) => { const k = keys.filter((x) => x.orderItemId === i.id);
    return eligibility({ kind: i.kind, quantity: i.quantity, orderStatus: o.status, orderCreatedAt: o.createdAt, keyCount: k.length, unrevealedKeys: k.filter((x) => !x.revealedAt).length,
      heldUnits: returns.filter((r) => r.orderItemId === i.id && holdsUnits(r.status)).reduce((t, r) => t + r.quantity, 0) }); };
  // After a return request: the Returns tab with the confirmation (same as before the order page existed).
  const done = (r: ReturnRequest) => { setForm(null); router.push(`/account/orders?tab=returns&sent=${encodeURIComponent(r.number)}`); };
  const ratingOf = (seller: string) => order?.ratings?.find((r) => r.seller === seller);
  const saved = (r: Rating) => { setRate(null); setOrder((o) => o && { ...o, ratings: [...(o.ratings ?? []).filter((x) => x.seller !== r.seller), r] }); setSent(`Thanks! Your rating for ${r.seller} is saved.`); };

  const o = order; const st = o ? orderStatus(o.status) : null;
  const subtotal = o ? o.subtotalMinor ?? o.items.reduce((t, i) => t + i.unitPriceCents * i.quantity, 0) : 0;
  let lastSeller = "";
  return <AccountShell title={o ? `Order ${o.number}` : "Order"} crumb="Order" parent={{ href: "/account/orders", label: "Returns & Orders" }}>{() => <>
    {error && <><Notice tone="error">{error}</Notice><p><Link className="text-link" href="/account/orders">‹ Back to orders</Link></p></>}
    {!o ? !error && <p className="muted-note">Loading…</p> : <div className="ord-page">
      <p className="ord-placed">Placed: {when(o.createdAt)}{o.isSample && <small className="muted-inline"> · sample order</small>}</p>
      {sent && <Notice tone="success">{sent}</Notice>}

      <section className="ord-card" aria-labelledby="h-products">
        <div className="ord-head"><h2 id="h-products">Ordered products</h2><span className="ord-head-status" aria-hidden="true">Delivery status</span></div>
        <ul className="order-items ord-items">{o.items.map((i) => {
          const e = facts(o, i); const held = returns.filter((r) => r.orderItemId === i.id && holdsUnits(r.status)); const seller = i.seller || CORECART_SELLER;
          const firstOfSeller = seller !== lastSeller; lastSeller = seller; const rated = ratingOf(seller);
          return <Fragment key={i.id}><li>
            <Cover name={i.name} platform={i.platform} size={72} />
            <div className="ord-item-main"><strong>{i.name}</strong>
              <small>{i.kind === "game_key" ? `Digital key · ${i.platform ?? ""} · ${i.region ?? ""}` : "Hardware · shipping"} · Qty {i.quantity}</small>
              <b className="ord-item-price">{format(i.unitPriceCents * i.quantity, o.currency)}</b>
              <small>Seller: <b>{seller}</b></small></div>
            <div className="ord-item-status"><OrderStatusText status={o.status} /></div>
            <div className="ord-item-actions">
              {firstOfSeller && canRate(o.status) && <button type="button" className="btn btn-outline btn-rate" onClick={() => setRate(seller)}>{rated ? <><Stars n={rated.stars} label={`You rated ${rated.stars} of 5`} /> Edit rating</> : <>★ Rate the seller</>}<span className="sr-only"> {seller}</span></button>}
              {i.kind === "game_key" ? <KeyLinks keys={keys.filter((k) => k.orderItemId === i.id)} name={i.name} /> : <span className="key-pending">Tracking arrives with shipping</span>}
              <span className="return-line">{e.ok ? <button type="button" className="text-link as-link" aria-expanded={form === i.id} onClick={() => { setForm(form === i.id ? null : i.id); setSent(""); }}>Request return<span className="sr-only"> for {i.name}</span></button>
                : <small className="return-no">{NOT_ELIGIBLE[e.why]}{e.why === "revealed" && <> Key not working? <Link className="text-link" href={`/account/tickets?new=1&key=${encodeURIComponent(keys.find((k) => k.orderItemId === i.id)?.id ?? "")}`}>Open a ticket</Link></>}</small>}
                {held.length > 0 && <small className="return-no">{held.map((r) => `${r.number} ${STATUS_LABEL[r.status].toLowerCase()}`).join(" · ")}</small>}</span>
            </div>
          </li>
          {form === i.id && e.ok && <li className="return-li"><ReturnForm order={o} item={i} max={e.max} onDone={done} onCancel={() => setForm(null)} /></li>}</Fragment>; })}</ul>
      </section>

      <section className="ord-card ord-pay" aria-labelledby="h-pay">
        <h2 id="h-pay">Payment details</h2>
        <p className={`ord-big ord-${st!.tone}`}><span aria-hidden="true">{st!.tone === "bad" ? "✕" : "✓"}</span> {st!.payment}</p>
        <p className="muted-note">{st!.paymentNote}</p>
        <dl className="ord-facts"><dt>Payment method:</dt><dd>{paymentText(o.paymentMethod, o.paymentLast4)}</dd><dt>Payment date:</dt><dd>{when(o.paidAt)}</dd></dl>
      </section>

      <section className="ord-card" aria-labelledby="h-sum">
        <h2 id="h-sum">Order summary</h2>
        <div className="ord-sum">
          <div><span>Subtotal</span><span>{format(subtotal, o.currency)}</span></div>
          {(o.discountMinor ?? 0) > 0 && <div className="ord-green"><span>Coupon {o.promoCode ?? ""}</span><span>−{format(o.discountMinor!, o.currency)}</span></div>}
          {(o.walletMinor ?? 0) > 0 && <div><span>Paid from wallet</span><span>−{format(o.walletMinor!, o.currency)}</span></div>}
          <div className="ord-total"><span>Total amount:</span><span>{format(o.totalCents, o.currency)}</span></div>
          {o.baseTotalMinor != null && o.currency !== "THB" && <p className="muted-note">Charged in {o.currency}. Same total in THB: {price(o.baseTotalMinor)} at the order rate.</p>}
        </div>
      </section>

      <section className="ord-card" aria-labelledby="h-docs">
        <h2 id="h-docs">Receipt</h2>
        <table className="ord-docs"><thead><tr><th scope="col">Seller</th><th scope="col">Receipt</th><th scope="col">Tax ID</th></tr></thead>
          <tbody><tr><td data-label="Seller"><span className="ord-company">{COMPANY.name}{COMPANY.address.map((l) => <span key={l}>{l}</span>)}<span>{COMPANY.country}</span></span></td>
            {canReceipt(o.status) ? <><td data-label="Receipt"><Link className="text-link ord-dl" href={receiptHref(o)}><span aria-hidden="true">📎</span> Download<span className="sr-only"> receipt</span></Link></td>
              <td data-label="Tax ID"><Link className="text-link ord-dl" href={receiptHref(o, true)}>{o.taxInfo ? "Edit tax ID" : "Add tax ID"}<span className="sr-only"> (optional, shown on the receipt)</span></Link></td></>
              : <td colSpan={2} className="muted-note">Available after payment.</td>}</tr></tbody></table>
        <p className="muted-note">Tax is optional. Your receipt shows the order details; add a tax ID only if you need it on the receipt.</p>
      </section>
      <p><Link className="text-link" href="/account/orders">‹ Back to orders</Link></p>
      {rate && <RatingDialog order={o} seller={rate} rating={ratingOf(rate)} onClose={() => setRate(null)} onSaved={saved} />}
    </div>}
  </>}</AccountShell>;
}
