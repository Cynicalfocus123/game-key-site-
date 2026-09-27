"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, dateText } from "@/lib/client/api";
import { filterKeys, KEYS_PER_PAGE, type GameKey, type KeyFilter } from "@/lib/keys";
import { AccountShell, Cover } from "../../components/account-shell";
import { Notice, readQuery } from "../../components/auth-ui";
import { useCurrency } from "../../components/currency-provider";

const FILTERS: { id: KeyFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "new", label: "Not revealed" }, { id: "revealed", label: "Revealed" }];

// Keys library (Handoff v8 C5): search by product name / order ID, filter, 20 per page. Mobile: rows become cards.
export default function KeysPage() {
  const { format } = useCurrency();
  const [keys, setKeys] = useState<GameKey[] | null>(null); const [error, setError] = useState("");
  const [q, setQ] = useState(""); const [filter, setFilter] = useState<KeyFilter>("all"); const [page, setPage] = useState(1);
  useEffect(() => { setQ(readQuery("q") ?? ""); api.listKeys().then((r) => (r.ok ? setKeys(r.keys) : setError(r.error))); }, []);
  const shown = keys ? filterKeys(keys, q, filter) : [];
  const pages = Math.max(1, Math.ceil(shown.length / KEYS_PER_PAGE)); const at = Math.min(page, pages);
  const rows = shown.slice((at - 1) * KEYS_PER_PAGE, at * KEYS_PER_PAGE);
  const count = (f: KeyFilter) => (keys ? filterKeys(keys, "", f).length : 0);

  return <AccountShell title="Keys library">{() => <>
    {error && <Notice tone="error">{error}</Notice>}
    {keys === null ? !error && <p className="muted-note">Loading…</p> : keys.length === 0 ? <div className="dash-card dash-empty">
      <span className="dash-empty-icon" aria-hidden="true">▢</span><strong>No keys yet</strong><p>Game keys appear here right after checkout.</p>
      <Link className="btn btn-primary" href="/">Browse today&apos;s deals</Link>
    </div> : <>
      <div className="keys-tools">
        <label className="keys-search"><span className="sr-only">Search keys</span><input type="search" placeholder="Search by product name / order ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
        <div className="seg" role="group" aria-label="Filter keys">{FILTERS.map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setPage(1); }}>{f.label} <span className="seg-count">{count(f.id)}</span></button>)}</div>
      </div>
      {!rows.length ? <p className="empty">No keys match your search.</p> : <table className="dash-table keys-table">
        <thead><tr><th scope="col"><span className="sr-only">Cover</span></th><th scope="col">Date</th><th scope="col">Order ID</th><th scope="col">Product name</th><th scope="col" className="num">Price</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{rows.map((k) => <tr key={k.id}>
          <td className="cover-cell"><Cover name={k.name} platform={k.platform} size={40} /></td>
          <td data-label="Date">{dateText(k.createdAt)}</td>
          <td data-label="Order ID"><code>{k.orderNumber}</code></td>
          <td data-label="Product" className="key-name"><span>{k.name}{!k.revealedAt && <span className="chip chip-blue">New</span>}<small>{[k.platform, k.region].filter(Boolean).join(" · ")}</small></span></td>
          <td data-label="Price" className="num">{format(k.priceMinor, k.currency)}</td>
          <td className="action-cell"><Link className={k.revealedAt ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"} href={`/account/keys/view?id=${encodeURIComponent(k.id)}`}>{k.revealedAt ? "View key" : "Reveal key"}<span className="sr-only">: {k.name}</span></Link></td>
        </tr>)}</tbody>
      </table>}
      {pages > 1 && <nav className="pager" aria-label="Keys pages"><button type="button" className="btn btn-outline btn-sm" disabled={at <= 1} onClick={() => setPage(at - 1)}>‹ Previous</button><span>Page {at} of {pages}</span><button type="button" className="btn btn-outline btn-sm" disabled={at >= pages} onClick={() => setPage(at + 1)}>Next ›</button></nav>}
    </>}
  </>}</AccountShell>;
}
