"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import type { AdminTopUpPage, AdminTopUpQuery, BankEvent, BankSettings } from "@/lib/client/types";
import { bankReady, METHOD_LABEL, STATUS_CHIP, STATUS_LABEL, statusLabel, TOPUP_STATUSES } from "@/lib/topup";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";
import { useCurrency } from "../../components/currency-provider";

// Admin top-ups (future task T1): search (email / TU- or BT- number / CC- transfer reference), status, provider, date range (Bangkok days),
// 50 per page. Row opens /admin/topup?id=. Card top-ups are credited only by the provider webhook; bank transfers by "Confirm received" on
// the detail page. Top-up redesign: "Bank transfer details" panel (empty = the customer's Bank transfer card shows "Coming soon").
const PROVIDERS = ["bank", "dev", "demo", "stripe", "omise", "2c2p"];
const href = (id: string) => `/admin/topup?id=${encodeURIComponent(id)}`;

function BankPanel() {
  const { currencies } = useCurrency();
  const chargeable = currencies.filter((c) => c.chargeable);
  const [saved, setSaved] = useState<BankSettings | null>(null); const [form, setForm] = useState<BankSettings | null>(null); const [history, setHistory] = useState<BankEvent[]>([]);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [open, setOpen] = useState(false); // opened on first load while not set up; after that only the admin opens / closes it
  useEffect(() => {
    let live = true; // a late answer must not overwrite what the admin is typing
    adminApi.bankSettings().then((r) => { if (!live) return; if (r.ok) { setSaved(r.settings); setForm(r.settings); setHistory(r.history); setOpen(!bankReady(r.settings)); } else setMsg({ tone: "error", text: r.error }); });
    return () => { live = false; };
  }, []);
  if (!form || !saved) return msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null;
  const set = (k: keyof Omit<BankSettings, "currencies">) => (e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; setForm((f) => f && { ...f, [k]: v }); setMsg(null); };
  const toggle = (code: string) => { setForm((f) => f && { ...f, currencies: f.currencies.includes(code) ? f.currencies.filter((c) => c !== code) : [...f.currencies, code] }); setMsg(null); };
  const changed = JSON.stringify(form) !== JSON.stringify(saved);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await adminApi.saveBankSettings(form); setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: r.error }); return; }
    setSaved(r.settings); setForm(r.settings); setHistory(r.history); setMsg({ tone: "success", text: bankReady(r.settings) ? "Saved. Customers now see these bank details." : "Saved. Bank transfer shows \"Coming soon\"." });
  };
  return <details className="adm-panel tu-bank" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary><h2>Bank transfer details</h2><span className={`chip ${bankReady(saved) ? "chip-green" : "chip-amber"}`}>{bankReady(saved) ? "On" : "Coming soon"}</span></summary>
    <form onSubmit={save} noValidate>
      <p className="muted-note">Shown on the customer&apos;s Wallet (Bank transfer). Leave bank name, account name and account number empty to hide it (&quot;Coming soon&quot;). Every change is saved in the history below.</p>
      <div className="tu-bank-grid">
        <label className="field"><span>Bank name</span><input value={form.bankName} maxLength={80} onChange={set("bankName")} /></label>
        <label className="field"><span>Account name</span><input value={form.accountName} maxLength={80} onChange={set("accountName")} /></label>
        <label className="field"><span>Account number / IBAN</span><input value={form.accountNumber} maxLength={40} onChange={set("accountNumber")} /></label>
        <label className="field"><span>SWIFT / BIC (optional)</span><input value={form.swift} maxLength={11} onChange={set("swift")} /></label>
      </div>
      <fieldset className="tu-bank-cur"><legend>Currencies we accept by bank transfer</legend>
        {chargeable.map((c) => <label key={c.code} className="check"><input type="checkbox" checked={form.currencies.includes(c.code)} onChange={() => toggle(c.code)} /> {c.code}</label>)}
      </fieldset>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="tu-adm-btns"><button className="btn btn-primary btn-sm" disabled={busy || !changed}>{busy ? "Saving…" : "Save bank details"}</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || !changed} onClick={() => { setForm(saved); setMsg(null); }}>Discard</button></div>
      {history.length > 0 && <><h3 className="tu-bank-h">History</h3><ul className="adm-list">{history.map((h, i) => <li key={i}><span>{h.detail}</span><span>{dateTime(h.at)} · {h.by ?? "Deleted admin"}</span></li>)}</ul></>}
    </form>
  </details>;
}

function TopUps() {
  const router = useRouter();
  const [q, setQ] = useState<AdminTopUpQuery>({ q: "", status: "", provider: "", from: "", to: "", page: 1 });
  const [data, setData] = useState<AdminTopUpPage | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => adminApi.topUps(q).then((r) => { if (r.ok) { setData(r.data); setError(""); } else setError(r.error); }), q.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);
  const set = (k: keyof AdminTopUpQuery) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setQ({ ...q, [k]: e.target.value, page: 1 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <>
    <p className="muted-note">Wallet top-ups. Card top-ups are credited only by the payment provider&apos;s webhook; bank transfers when you confirm the money arrived (open the top-up). To correct a balance use Adjust balance on the user.</p>
    <BankPanel />
    {error && <Notice tone="error">{error}</Notice>}
    <div className="adm-filters">
      <label className="field adm-search"><span>Search</span><input type="search" placeholder="Email, TU- / BT- number or CC- reference" value={q.q} onChange={set("q")} /></label>
      <label className="field"><span>Status</span><select value={q.status} onChange={set("status")}><option value="">All statuses</option>{TOPUP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}{s === "pending" ? " / waiting for transfer" : ""}</option>)}</select></label>
      <label className="field"><span>Provider</span><select value={q.provider} onChange={set("provider")}><option value="">All providers</option>{PROVIDERS.map((p) => <option key={p} value={p}>{p === "bank" ? "bank (bank transfer)" : p}</option>)}</select></label>
      <label className="field"><span>From</span><input type="date" value={q.from} onChange={set("from")} /></label>
      <label className="field"><span>To</span><input type="date" value={q.to} onChange={set("to")} /></label>
    </div>
    {!data ? !error && <p className="muted-note">Loading…</p> : !data.topUps.length ? <p className="empty">{data.total ? "No top-ups match." : "No top-ups yet."}</p> : <>
      <p className="muted-note adm-count">{data.total} top-up{data.total === 1 ? "" : "s"}</p>
      <div className="adm-table-wrap"><table className="adm-table tu-admin-table">
        <thead><tr><th>Number</th><th>Customer</th><th>Method</th><th className="num">Charged</th><th className="num">Wallet credit</th><th>Status</th><th>Provider</th><th>Created</th></tr></thead>
        <tbody>{data.topUps.map((t) => <tr key={t.id} onClick={() => router.push(href(t.id))}>
          <td><Link href={href(t.id)} onClick={(e) => e.stopPropagation()}><strong>{t.number}</strong></Link></td>
          <td>{t.email}{t.method === "bank" && t.customerRef && <small className="tu-ref"> {t.customerRef}</small>}</td>
          <td>{METHOD_LABEL[t.method]}</td>
          <td className="num">{money(t.amountMinor, t.currency)} {t.currency}</td>
          <td className="num">{money(t.creditMinor, "THB")}</td>
          <td><span className={`chip ${STATUS_CHIP[t.status]}`}>{statusLabel(t)}</span></td>
          <td>{t.provider}</td>
          <td>{dateTime(t.createdAt)}</td>
        </tr>)}</tbody>
      </table></div>
      {pages > 1 && <div className="adm-pager"><button type="button" className="btn btn-outline btn-sm" disabled={data.page <= 1} onClick={() => setQ({ ...q, page: data.page - 1 })}>Previous</button>
        <span className="muted-note">Page {data.page} of {pages}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={data.page >= pages} onClick={() => setQ({ ...q, page: data.page + 1 })}>Next</button></div>}
    </>}
  </>;
}

export default function Page() { return <AdminShell title="Top-ups"><TopUps /></AdminShell>; }
