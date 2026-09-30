"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, dateText } from "@/lib/client/api";
import type { GameKey, Order, ReturnRequest } from "@/lib/client/types";
import { eligibility, holdsUnits, NOT_ELIGIBLE } from "@/lib/returns";
import { AccountShell, Cover } from "../../../components/account-shell";
import { Notice, readQuery } from "../../../components/auth-ui";
import { KeyFacts, keyHref, keyInfo } from "../../../components/key-facts";
import { orderHref, ReturnForm } from "../../../components/orders-ui";

// Get your product (task 8, wireframe approved 2026-09-30: Claude outputs/wireframes/get-product-wireframe.png). Keys not revealed yet only
// (revealed → key page). Opened by "Get key" in the order email (?item = order line: its first hidden key) and on the order page / keys library (?id).
// Only the Manual activation card (user 2026-09-30: no browser-extension card, no reward box). Display the key = the same reveal as before
// (server stamps it once; returns end), then the existing key page. Request refund = the return request for this line (allowed: key not shown).
export default function GetProductPage() {
  const router = useRouter();
  const [key, setKey] = useState<GameKey | null>(null); const [siblings, setSiblings] = useState<GameKey[]>([]); const [order, setOrder] = useState<Order | null>(null);
  const [returns, setReturns] = useState<ReturnRequest[]>([]); const [error, setError] = useState("");
  const [platformOk, setPlatformOk] = useState(false); const [regionOk, setRegionOk] = useState(false); const [busy, setBusy] = useState(false); const [refund, setRefund] = useState(false);

  useEffect(() => {
    (async () => {
      const id = readQuery("id"), item = readQuery("item");
      if (!id && !item) { setError("Key not found."); return; }
      const all = await api.listKeys(); if (!all.ok) { setError(all.error); return; }
      let k = id ? all.keys.find((x) => x.id === id) : undefined;
      if (item) { const line = all.keys.filter((x) => x.orderItemId === item); k = line.find((x) => !x.revealedAt) ?? line[0]; }
      if (!k) { setError("Key not found."); return; }
      if (k.revealedAt) { router.replace(keyHref(k)); return; } // revealed keys never show this page
      const [o, rt] = await Promise.all([api.getOrder(k.orderId), api.listReturns()]);
      setKey(k); setSiblings(all.keys.filter((x) => x.orderItemId === k.orderItemId));
      if (o.ok) setOrder(o.order); if (rt.ok) setReturns(rt.returns);
    })();
  }, [router]);

  const display = async () => {
    if (!key || !platformOk || !regionOk) return;
    setBusy(true); setError(""); const r = await api.revealKey(key.id);
    if (!r.ok) { setBusy(false); setError(r.error); return; }
    router.push(keyHref(r.key));
  };

  const info = key ? keyInfo(key) : null;
  const platform = (key?.platform ?? "the platform").toUpperCase(); const region = (info?.region ?? "Global").toUpperCase();
  const item = order?.items.find((i) => i.id === key?.orderItemId);
  const held = returns.filter((r) => r.orderItemId === key?.orderItemId && holdsUnits(r.status));
  const elig = order && item ? eligibility({ kind: item.kind, quantity: item.quantity, orderStatus: order.status, orderCreatedAt: order.createdAt, keyCount: siblings.length,
    unrevealedKeys: siblings.filter((x) => !x.revealedAt).length, heldUnits: held.reduce((t, r) => t + r.quantity, 0) }) : null;
  const n = key ? siblings.findIndex((x) => x.id === key.id) + 1 : 0;

  return <AccountShell title="Get your product" crumb="Get your product" parent={{ href: "/account/keys", label: "Keys library" }}>{() => <>
    {error && <Notice tone="error">{error}</Notice>}
    {!key ? !error ? <p className="muted-note">Loading…</p> : <p><Link className="text-link" href="/account/keys">‹ Back to keys library</Link></p> : <div className="gp">
      <div className="gp-head"><Cover name={key.name} platform={key.platform} size={104} />
        <div><h2 className="gp-title">{key.name}</h2>
          <p className="gp-sub">Order {order ? <Link className="text-link" href={orderHref(order)}>{key.orderNumber}</Link> : key.orderNumber} · {dateText(key.createdAt)}{siblings.length > 1 && <> · Key {n} of {siblings.length}</>}</p></div></div>
      <KeyFacts keyItem={key} />

      <section className="gp-card" aria-labelledby="gp-man">
        <h2 id="gp-man">Manual activation</h2>
        <p className="gp-card-sub">Requires manual input</p>
        <p className="gp-warn"><span aria-hidden="true">ⓘ</span> Please make sure you bought the correct product: returns are not possible once the key is displayed.</p>
        <label className="gp-check"><input type="checkbox" checked={platformOk} onChange={(e) => setPlatformOk(e.target.checked)} /> <span><b>{platform}</b> is the correct platform</span></label>
        <label className="gp-check"><input type="checkbox" checked={regionOk} onChange={(e) => setRegionOk(e.target.checked)} /> <span><b>{region}</b> is the correct region</span></label>
        <div className="gp-btns">
          <button type="button" className="btn btn-primary" disabled={!platformOk || !regionOk || busy} aria-describedby="gp-need" onClick={display}>{busy ? "Displaying…" : "Display the key"}</button>
          {elig?.ok && <button type="button" className="btn btn-outline" aria-expanded={refund} onClick={() => setRefund(!refund)}>Request refund</button>}
        </div>
        {(!platformOk || !regionOk) && <p className="muted-note gp-need" id="gp-need">Tick both boxes to display the key.</p>}
        {elig && !elig.ok && <p className="muted-note">{held.length ? "A return request for this product is open." : NOT_ELIGIBLE[elig.why]}</p>}
        {refund && elig?.ok && order && item && <ReturnForm order={order} item={item} max={elig.max} onCancel={() => setRefund(false)}
          onDone={(r) => router.push(`/account/orders?tab=returns&sent=${encodeURIComponent(r.number)}`)} />}
      </section>
      <p className="gp-meta">Sold by <strong>CoreCart</strong> · <Link className="text-link" href={`/account/tickets?new=1&key=${encodeURIComponent(key.id)}`}>Report a problem with this key</Link></p>
    </div>}
  </>}</AccountShell>;
}
