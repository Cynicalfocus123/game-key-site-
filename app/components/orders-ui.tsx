"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { GameKey, Order, OrderItem, Rating, ReturnRequest } from "@/lib/client/types";
import { orderStatus, RATING_COMMENT_MAX } from "@/lib/orders";
import { checkNewReturn, MESSAGE_MAX, reasonsFor, type ReturnReason } from "@/lib/returns";
import { Notice } from "./auth-ui";

// Shared by the Orders list, the order page and the receipt (email task, 2026-09-29).
export const orderHref = (o: Pick<Order, "id">) => `/account/orders/view?id=${encodeURIComponent(o.id)}`;
export const receiptHref = (o: Pick<Order, "id">, invoice = false) => `/account/orders/receipt?id=${encodeURIComponent(o.id)}${invoice ? "&doc=invoice" : ""}`;
export const OrderStatusText = ({ status }: { status: string }) => { const s = orderStatus(status); return <span className={`ord-status ord-${s.tone}`}>{s.label}</span>; };

// One link per key unit. Reveal happens on the key page (ends the refund window).
export function KeyLinks({ keys, name }: { keys: GameKey[]; name: string }) {
  if (!keys.length) return <span className="key-pending">Key delivery arrives with checkout</span>;
  return <span className="key-links">{keys.map((k, n) => <Link key={k.id} className="btn btn-primary btn-key" href={`/account/keys/view?id=${encodeURIComponent(k.id)}`}>
    {k.revealedAt ? "View key" : "Reveal key"}{keys.length > 1 && ` ${n + 1}`}<span className="sr-only"> {name}</span></Link>)}</span>;
}

// Return form under one order line (lib/returns.ts rules; the API checks them again).
export function ReturnForm({ order, item, max, onDone, onCancel }: { order: Order; item: OrderItem; max: number; onDone: (r: ReturnRequest) => void; onCancel: () => void }) {
  const reasons = reasonsFor(item.kind, order.createdAt);
  const [qty, setQty] = useState(1); const [reason, setReason] = useState<ReturnReason | "">(""); const [message, setMessage] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { orderItemId: item.id, quantity: qty, reason: reason as ReturnReason, message };
    const err = checkNewReturn(input, item.kind, order.createdAt, max); if (err) { setError(err); return; }
    setBusy(true); setError(""); const r = await api.requestReturn(input); setBusy(false);
    if (r.ok) onDone(r.ret); else setError(r.error);
  };
  return <form className="return-form" onSubmit={submit} noValidate aria-label={`Return ${item.name}`}>
    <strong>Request a return: {item.name}</strong>
    <div className="return-fields">
      <label className="field"><span>Quantity</span><select name="quantity" value={qty} onChange={(e) => setQty(Number(e.target.value))}>{Array.from({ length: max }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
      <label className="field"><span>Reason</span><select name="reason" value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}><option value="">Choose a reason</option>{reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    </div>
    <label className="field"><span>Message {reason === "other" ? "" : "(optional)"}</span><textarea name="message" rows={3} maxLength={MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened?" /></label>
    {item.kind === "game_key" && <p className="coupon-note">Do not reveal the key while the return is open. Keys in a return cannot be shown.</p>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="return-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send return request"}</button><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export const Stars = ({ n, label }: { n: number; label?: string }) => <span className="stars" aria-label={label ?? `${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden="true" className={i <= n ? "on" : ""}>★</span>)}</span>;

// Rate the seller (pop-up): 1–5 stars + optional comment. One per seller per order; sending again edits it.
export function RatingDialog({ order, seller, rating, onClose, onSaved }: { order: Order; seller: string; rating?: Rating; onClose: () => void; onSaved: (r: Rating) => void }) {
  const [stars, setStars] = useState(rating?.stars ?? 0); const [comment, setComment] = useState(rating?.comment ?? "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLElement>("input")?.focus(); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const els = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:checked, input[name=stars]:first-of-type, textarea") ?? []); if (!els.length) return;
    const first = els[0]; const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (!stars) { setError("Choose 1 to 5 stars."); return; }
    setBusy(true); setError(""); const r = await api.rateSeller({ orderId: order.id, seller, stars, comment }); setBusy(false);
    if (r.ok) onSaved(r.rating); else setError(r.error);
  };
  const words = ["", "Bad", "Poor", "OK", "Good", "Excellent"];
  return <div className="rate-wrap" role="presentation" onKeyDown={keys} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="rate-box" role="dialog" aria-modal="true" aria-labelledby="rate-title" ref={box}>
      <button type="button" className="rate-x" aria-label="Close" onClick={onClose}>×</button>
      <h2 id="rate-title">Rate {seller}</h2>
      <p className="muted-note">How was order <code>{order.number}</code>?</p>
      <form onSubmit={send} noValidate>
        <fieldset className="star-pick"><legend className="sr-only">Stars</legend>
          {[1, 2, 3, 4, 5].map((i) => <label key={i} className={i <= stars ? "on" : ""}><input type="radio" name="stars" value={i} checked={stars === i} onChange={() => setStars(i)} /><span aria-hidden="true">★</span><span className="sr-only">{i} {i === 1 ? "star" : "stars"} ({words[i]})</span></label>)}
          <span className="star-word" aria-live="polite">{words[stars]}</span>
        </fieldset>
        <label className="field"><span>Comment (optional)</span><textarea name="comment" rows={3} maxLength={RATING_COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Delivery speed, key worked, support…" /></label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="rate-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : rating ? "Update rating" : "Send rating"}</button><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button></div>
      </form>
    </div>
  </div>;
}
