"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dateText, marketApi } from "@/lib/client/api";
import type { Product } from "@/lib/catalog";
import { catalogMatch, emptyRequest, MARKET_ERRORS, OPEN_REQUESTS_MAX, parseRequest, PLATFORM_OPTIONS, REGION_OPTIONS, type ProductRequest, type RequestErrors, type RequestInput } from "@/lib/marketplace";
import { useCatalog } from "../../components/catalog";
import { Notice } from "../../components/auth-ui";
import { productTitle, SellerShell } from "../../components/seller-ui";

// "Request new name" (wireframe screen 4B): a product that is not in the catalog yet. Same checks as the API (parseRequest);
// before sending, the catalog search runs again (catalogMatch) → "already in the catalog — sell it". My requests below.
export default function SellerRequestsPage() {
  return <SellerShell title="Request a new product" crumb="Product requests">{() => <Requests />}</SellerShell>;
}

const sellHref = (productId: string) => `/seller/offers/new?product=${encodeURIComponent(productId)}`;

function Requests() {
  const products = useCatalog();
  const [form, setForm] = useState<RequestInput>(emptyRequest()); const [errors, setErrors] = useState<RequestErrors>({});
  const [match, setMatch] = useState<Product | null>(null); const [sent, setSent] = useState<ProductRequest | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [list, setList] = useState<ProductRequest[] | null>(null); const [listErr, setListErr] = useState("");
  const load = () => marketApi.requests().then((r) => (r.ok ? setList(r.requests) : setListErr(r.error)));
  useEffect(() => { load(); }, []);
  const set = (k: keyof RequestInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); setMatch(null); setError(""); setSent(null);
  };
  const open = (list ?? []).filter((r) => r.status === "waiting").length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSent(null);
    const p = parseRequest(form as unknown as Record<string, unknown>);
    if (!p.ok) { setErrors(p.errors); return; }
    const m = catalogMatch(products, p.input); if (m) { setMatch(m); return; }
    setBusy(true); const r = await marketApi.sendRequest(p.input); setBusy(false);
    if (!r.ok) {
      const m409 = r.productId ? products.find((x) => x.id === r.productId) : undefined; // 409: the API found it in the catalog
      if (m409) { setMatch(m409); return; }
      if (r.errors) setErrors(r.errors);
      setError(r.error); return;
    }
    setSent(r.request); setForm(emptyRequest()); setErrors({}); load();
  };
  const err = (k: keyof RequestInput) => errors[k] ? <span className="sl-err" id={`rq-${k}-err`} role="alert">{errors[k]}</span> : null;
  const aria = (k: keyof RequestInput) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `rq-${k}-err` : undefined });

  return <>
    <p className="muted-note sl-lead">We add it to the catalog after a check. You can then sell it from New offer. Up to {OPEN_REQUESTS_MAX} open requests at a time.</p>
    <form className="sl-form sl-request" onSubmit={submit} noValidate>
      <label className="field"><span>Product name *</span><input value={form.name} onChange={set("name")} maxLength={120} autoComplete="off" {...aria("name")} />{err("name")}</label>
      <div className="sl-3">
        <label className="field"><span>Platform *</span><select value={form.platform} onChange={set("platform")} {...aria("platform")}>{PLATFORM_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select>{err("platform")}</label>
        <label className="field"><span>Region *</span><select value={form.region} onChange={set("region")} {...aria("region")}>{REGION_OPTIONS.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}</select>{err("region")}</label>
        <label className="field"><span>Edition</span><input value={form.edition} onChange={set("edition")} placeholder="Standard" maxLength={60} {...aria("edition")} />{err("edition")}</label>
      </div>
      <label className="field"><span>Link to the product (store page, optional)</span><input value={form.link} onChange={set("link")} placeholder="https://store.steampowered.com/app/…" inputMode="url" {...aria("link")} />{err("link")}</label>
      <label className="field"><span>Note for the admin (optional)</span><textarea value={form.note} onChange={set("note")} rows={2} maxLength={500} {...aria("note")} />{err("note")}</label>
      {match && <Notice>{MARKET_ERRORS.inCatalog} <strong>{productTitle(match)}</strong> <Link className="text-link" href={sellHref(match.id)}>Sell it ›</Link></Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="sl-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button><Link className="btn btn-outline" href="/seller/offers/new">Cancel</Link></div>
      {sent && <Notice tone="success">✓ Request {sent.number} sent. We&apos;ll email you when it is added (or why not). See <a className="text-link" href="#my-requests">My requests</a>.</Notice>}
    </form>

    <section className="sl-panel" id="my-requests" aria-labelledby="myreq-h">
      <div className="sl-phead"><h2 id="myreq-h">My requests</h2><span className="muted-note">{open} open of {OPEN_REQUESTS_MAX}</span></div>
      {listErr ? <Notice tone="error">{listErr}</Notice> : list === null ? <p className="muted-note">Loading…</p> : !list.length ? <p className="muted-note sl-empty">No requests yet.</p>
        : <div className="ord-wrap"><table className="sl-table sl-req">
          <thead><tr><th scope="col">No.</th><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Date</th></tr></thead>
          <tbody>{list.map((r) => <tr key={r.id}>
            <td className="c-no">{r.number}</td>
            <td className="c-name">{[r.name, r.platform, r.region.toUpperCase(), r.edition].filter(Boolean).join(" · ")}</td>
            <td className="c-status">{r.status === "waiting" ? <span className="chip chip-amber">Waiting</span>
              : r.status === "added" ? <><span className="chip chip-green">Added</span>{r.productId && <> <Link className="text-link" href={sellHref(r.productId)}>Sell it ›</Link></>}</>
              : <><span className="chip chip-red">Rejected</span>{r.reason && <span className="muted-note sl-sub">{r.reason}</span>}</>}</td>
            <td className="c-date">{dateText(r.createdAt)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </>;
}
