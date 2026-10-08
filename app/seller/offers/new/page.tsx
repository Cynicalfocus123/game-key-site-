"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { marketApi } from "@/lib/client/api";
import type { Product } from "@/lib/catalog";
import { convertMinor } from "@/lib/currency/money";
import { KEYS_PER_UPLOAD } from "@/lib/key-inventory";
import { checkKeyText, keyReport, MARKET_ERRORS, parseUsd, searchSellable, type KeyAddResult, type KeyReport, type SellerOffer } from "@/lib/marketplace";
import { MIN_QUERY, normalize } from "@/lib/search";
import { USD_RATE } from "@/lib/topup";
import { useCatalog } from "../../../components/catalog";
import { useCurrency } from "../../../components/currency-provider";
import { Notice } from "../../../components/auth-ui";
import { KeyReportView, productTitle, Receive, SellerShell, SellerTiles, usd, type SellerCtx } from "../../../components/seller-ui";

// New offer + add keys (wireframe screen 4). /seller/offers/new = pick a catalog product (same search as the store header, game keys
// only), price in USD, keys (paste or CSV / TXT). ?offer=<id> = Add keys to that offer. ?product=<id> = product filled in
// ("Sell it" from a request). The 4 tiles stay on top. Check before saving: format + duplicates here at once, "already in CoreCart"
// from the API (checkKeys, nothing stored) 1 s after typing stops.
export default function NewOfferPage() {
  return <Suspense fallback={<p className="muted-note">Loading…</p>}><ByQuery /></Suspense>;
}

function ByQuery() {
  const q = useSearchParams(); const offerId = q.get("offer"); const productId = q.get("product");
  return <SellerShell title={offerId ? "Add keys" : "New offer"} crumb={offerId ? "Add keys" : "New offer"}>{(c) => <>
    <SellerTiles home={c.home} short />
    <OfferForm key={`${offerId}|${productId}`} c={c} offerId={offerId} productId={productId} />
  </>}</SellerShell>;
}

const MAX_FILE = 1_000_000; // 1 MB of text is far more than 1 000 keys
type Done = { text: string; report: KeyReport | null };

function OfferForm({ c, offerId, productId }: { c: SellerCtx; offerId: string | null; productId: string | null }) {
  const products = useCatalog(); const router = useRouter(); const { currencies, base } = useCurrency();
  const [offers, setOffers] = useState<SellerOffer[] | null>(null); const [loadErr, setLoadErr] = useState("");
  const [product, setProduct] = useState<Product | null>(null); const [price, setPrice] = useState(""); const [priceErr, setPriceErr] = useState("");
  const [tab, setTab] = useState<"paste" | "upload">("paste"); const [text, setText] = useState(""); const [file, setFile] = useState<{ name: string; lines: number } | null>(null); const [fileErr, setFileErr] = useState("");
  const [server, setServer] = useState<{ text: string; report: KeyReport } | null>(null); const [checkErr, setCheckErr] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState<Done | null>(null); const [round, setRound] = useState(0); // new picker after each save
  const loadOffers = () => marketApi.offers().then((r) => { if (r.ok) setOffers(r.offers); else setLoadErr(r.error); return r; });
  useEffect(() => { loadOffers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const offer = offerId ? offers?.find((o) => o.id === offerId) ?? null : null;
  const fixed = offer ? products.find((p) => p.id === offer.productId) ?? null : null; // Add keys mode
  useEffect(() => { if (!offerId && productId && !product) { const p = products.find((x) => x.id === productId && x.kind === "game_key"); if (p) setProduct(p); } }, [offerId, productId, products, product]);
  const target = fixed ?? product;
  const existing = !offerId && product ? offers?.find((o) => o.productId === product.id) ?? null : null;

  // Local check (format + duplicates) at once; the API adds "already in CoreCart" for the same text.
  const local = useMemo(() => keyReport(checkKeyText(text, target?.platform)), [text, target?.platform]);
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current; setCheckErr("");
    if (!target || !text.trim() || !local.okCount || local.tooMany) return;
    const t = setTimeout(async () => {
      const r = await marketApi.checkKeys(target.id, text);
      if (id !== seq.current) return;
      if (r.ok) setServer({ text, report: r.report }); else setCheckErr(r.error);
    }, 1000);
    return () => clearTimeout(t);
  }, [text, target, local.okCount, local.tooMany]);
  const fresh = server && server.text === text ? server.report : null;
  const report = fresh ?? local; const pending = !fresh && !!target && !!text.trim() && local.okCount > 0 && !local.tooMany && !checkErr;

  const usdCur = currencies.find((x) => x.code === "USD") ?? USD_RATE;
  const corecartUsd = target && !target.soldOut ? convertMinor(target.price, base, usdCur) : null;
  const cents = parseUsd(price);

  const readFile = async (f: File | undefined) => {
    setFileErr(""); if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) { setFileErr("Use a .csv or .txt file."); return; }
    if (f.size > MAX_FILE) { setFileErr("File too large: up to 1 MB."); return; }
    const t = await f.text(); setText(t); setFile({ name: f.name, lines: t.split(/\r?\n/).filter((l) => l.trim()).length }); setDone(null);
  };
  const changeText = (t: string) => { setText(t); setFile(null); setDone(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setDone(null);
    if (offerId) {
      if (!offer) return;
      if (!text.trim()) { setError(MARKET_ERRORS.noKeys); return; }
      setBusy(true); const r = await marketApi.addKeys(offer.id, text); setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      const res = (r as { result: KeyAddResult }).result; finish(res, `${res.added} key${res.added === 1 ? "" : "s"} added to ${fixed?.name ?? "this offer"}.`);
      return;
    }
    if (!product) { setError(MARKET_ERRORS.product); return; }
    if (existing) { setError(MARKET_ERRORS.offerExists); return; }
    if (cents === null) { setPriceErr(MARKET_ERRORS.price); return; }
    setBusy(true); const r = await marketApi.createOffer({ productId: product.id, priceUsdCents: cents, keys: text }); setBusy(false);
    if (!r.ok) { setError(r.error); if (r.error === MARKET_ERRORS.offerExists) loadOffers(); return; }
    const added = r.keys?.added ?? 0;
    finish(r.keys, `Offer saved: ${product.name} at ${usd(r.offer.priceUsdCents)} with ${added} key${added === 1 ? "" : "s"}.${added ? "" : " It shows as Sold out until you add keys."}`);
    setProduct(null); setPrice(""); setRound((n) => n + 1);
  };
  const finish = (res: KeyAddResult | null, msg: string) => {
    const refused = res ? res.report.invalid.length + res.report.duplicates.length + res.report.existing.length : 0;
    setDone({ text: `✓ ${msg}${refused ? ` ${refused} line${refused === 1 ? " was" : "s were"} not saved (see below).` : ""}`, report: refused && res ? res.report : null });
    setText(""); setFile(null); setServer(null); loadOffers(); c.reload();
  };

  if (loadErr) return <Notice tone="error">{loadErr}</Notice>;
  if (offerId && offers && !offer) return <Notice tone="error">{MARKET_ERRORS.offerNotFound} <Link className="text-link" href="/seller/offers">Back to My offers</Link></Notice>;
  if (offerId && !offer) return <p className="muted-note">Loading the offer…</p>;
  const okCount = report.okCount; const keysOk = !report.tooMany;
  const label = offerId ? `Add ${okCount} key${okCount === 1 ? "" : "s"}` : okCount ? `Save offer + ${okCount} key${okCount === 1 ? "" : "s"}` : "Save offer";

  return <form className="sl-form" onSubmit={submit} noValidate>
    {done && <div className="sl-done"><Notice tone="success">{done.text}</Notice>{done.report && <KeyReportView report={done.report} />}
      <p className="sl-links"><Link className="text-link" href="/seller/offers">Go to My offers ›</Link>{!offerId && <> · <Link className="text-link" href="/seller/offers/new">New offer for another product ›</Link></>}</p></div>}
    {offerId && offer && fixed ? <div className="sl-fixed">
      <span className="muted-note">Product</span><strong>{productTitle(fixed)}</strong>
      <span className="muted-note">Your price {usd(offer.priceUsdCents)} · Stock {offer.stock} · You receive <Receive cents={offer.priceUsdCents} long />{offer.lowestOtherUsdCents !== null && <> · Lowest other price {usd(offer.lowestOtherUsdCents)}</>}</span>
    </div> : <>
      <ProductPicker key={round} products={products} value={product} onPick={(p) => { setProduct(p); setError(""); setDone(null); }} />
      {existing && <Notice>You already have an offer for this product. <Link className="text-link" href={`/seller/offers/new?offer=${existing.id}`}>Add keys to it ›</Link></Notice>}
      <div className="sl-price">
        <label className="field"><span>Your price (USD)</span>
          <span className="sl-usd"><span aria-hidden="true">$</span><input value={price} onChange={(e) => { setPrice(e.target.value); setPriceErr(""); }} onBlur={() => price.trim() && parseUsd(price) === null && setPriceErr(MARKET_ERRORS.price)} inputMode="decimal" placeholder="0.00" aria-invalid={!!priceErr} aria-describedby="price-hint" /></span></label>
        {priceErr && <p className="sl-err" role="alert">{priceErr}</p>}
        <p className="muted-note" id="price-hint">{corecartUsd !== null && <>CoreCart price: {usd(corecartUsd)} · </>}You receive: {cents !== null ? <Receive cents={cents} long /> : "price − commission (% pending)"}. Other sellers&apos; prices show on My offers after saving.</p>
      </div>
    </>}

    <h2 className="sl-h2">Add keys</h2>
    <div className="sl-tabs" role="tablist" aria-label="How to add keys">
      <button type="button" role="tab" aria-selected={tab === "paste"} onClick={() => setTab("paste")}>Paste keys</button>
      <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}>Upload CSV / TXT</button>
    </div>
    {tab === "paste" ? <label className="field sl-keys"><span className="sr-only">Keys, one per line</span>
      <textarea value={text} onChange={(e) => changeText(e.target.value)} rows={7} spellCheck={false} autoComplete="off" placeholder={"AAAAA-BBBBB-CCCCC\nDDDDD-EEEEE-FFFFF"} />
    </label> : <div className="sl-upload">
      <label className="btn btn-outline">Choose file<input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" aria-label="Keys file (CSV or TXT)" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <span className="muted-note">{file ? `${file.name} · ${file.lines} line${file.lines === 1 ? "" : "s"} read` : "One key per line; in a CSV the first column is used."}</span>
      {fileErr && <p className="sl-err" role="alert">{fileErr}</p>}
    </div>}
    <p className="muted-note">One key per line, up to {KEYS_PER_UPLOAD.toLocaleString("en-US")} per upload. Keys are encrypted right away; you only see the last 4 characters after saving.</p>
    {text.trim() && target && <KeyReportView report={report} pending={pending} />}
    {text.trim() && !target && <p className="muted-note">Pick the product first: the key format depends on the platform.</p>}
    {checkErr && <p className="muted-note" role="status">The &ldquo;already in CoreCart&rdquo; check runs again when you save ({checkErr})</p>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="sl-actions">
      <button className="btn btn-primary" disabled={busy || !keysOk || !!existing || (!!offerId && !text.trim())}>{busy ? "Saving…" : label}</button>
      <button type="button" className="btn btn-outline" onClick={() => router.push("/seller/offers")}>Cancel</button>
    </div>
  </form>;
}

// Product field (screen 4): same matcher as the header search (lib/search.ts via searchSellable), published game keys only.
// ↑ ↓ move, Enter picks, Esc closes. "Can't find? Request new name" → /seller/requests.
function ProductPicker({ products, value, onPick }: { products: Product[]; value: Product | null; onPick: (p: Product | null) => void }) {
  const listId = useId(); const wrap = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(value ? productTitle(value) : ""); const [dq, setDq] = useState(q); const [open, setOpen] = useState(false); const [active, setActive] = useState(0);
  useEffect(() => { if (value) setQ(productTitle(value)); }, [value]);
  useEffect(() => { const t = setTimeout(() => setDq(q), 150); return () => clearTimeout(t); }, [q]);
  const rows = useMemo(() => searchSellable(products, dq, 8), [products, dq]);
  const ready = normalize(q).join("").length >= MIN_QUERY; const show = open && ready && !value;
  useEffect(() => {
    if (!show) return; const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", down); return () => document.removeEventListener("pointerdown", down);
  }, [show]);
  const pick = (p: Product) => { onPick(p); setQ(productTitle(p)); setOpen(false); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!show || !rows.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (e.key === "ArrowDown" ? (a + 1) % rows.length : (a - 1 + rows.length) % rows.length)); }
    if (e.key === "Enter") { e.preventDefault(); pick(rows[Math.min(active, rows.length - 1)]); }
  };
  return <div className="sl-pick">
    <div className="sl-pick-field" ref={wrap}>
      <label className="field"><span>Product name (only products in the CoreCart catalog)</span>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); if (value) onPick(null); }} onFocus={() => setOpen(true)} onKeyDown={key}
          role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={listId} aria-activedescendant={show && rows.length ? `${listId}-${active}` : undefined}
          placeholder="Start typing a game name…" autoComplete="off" /></label>
      {show && <ul id={listId} role="listbox" aria-label="Catalog products" className="sl-drop">
        {rows.map((p, i) => <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={active === i} className={active === i ? "on" : undefined}
          onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(p)}>{productTitle(p)}</li>)}
        {!rows.length && dq === q && <li className="sl-none" role="presentation">No game key matches &ldquo;{q.trim()}&rdquo;.</li>}
      </ul>}
      {value && <p className="muted-note sl-picked">✓ {value.platform} · {value.region?.toUpperCase()}{value.edition ? ` · ${value.edition}` : ""}</p>}
    </div>
    <p className="sl-cant"><span className="muted-note">Can&apos;t find?</span> <Link className="text-link" href="/seller/requests">Request new name</Link></p>
  </div>;
}
