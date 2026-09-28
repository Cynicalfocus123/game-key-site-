"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import type { AdminUserDetail, AdminWallet } from "@/lib/client/types";
import { typeLabel, type Bucket } from "@/lib/gift-cards";
import { BUCKET_LABEL, REASON_MAX, toSatang, type AdjustDirection } from "@/lib/wallet";
import { AdminShell, MethodBadge, dateTime, device } from "../../components/admin-shell";
import { Notice, readQuery } from "../../components/auth-ui";

// Static export cannot pre-render one page per user, so the user id comes from ?id=.
function Detail() {
  const [data, setData] = useState<AdminUserDetail | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    const id = readQuery("id");
    if (!id) { setError("Missing user id."); return; }
    adminApi.user(id).then(r => r.ok ? setData(r.data) : setError(r.error));
  }, []);
  if (error) return <><Notice tone="error">{error}</Notice><Link className="text-link" href="/admin/users">← Back to users</Link></>;
  if (!data) return <p className="muted-note">Loading…</p>;
  const { user: u } = data;
  return <>
    <p className="adm-back"><Link className="text-link" href="/admin/users">← All users</Link></p>
    <div className="adm-head"><h2>{u.name}</h2><span>{u.email}</span></div>
    <div className="acct-tiles">
      <div className="acct-tile"><span>Registered</span><strong>{dateTime(u.createdAt)}</strong><small>Terms accepted {dateTime(u.termsAcceptedAt)}</small></div>
      <div className="acct-tile"><span>Email</span><strong className={u.emailVerified ? "ok" : "warn"}>{u.emailVerified ? "Verified" : "Not verified"}</strong><small>Marketing: {u.marketingOptIn ? "yes" : "no"}</small></div>
      <div className="acct-tile"><span>Role</span><strong>{u.role}</strong><small>Updated {dateTime(u.updatedAt)}</small></div>
      <div className="acct-tile"><span>Orders</span><strong>{data.orders.count}</strong><small>{money(data.orders.totalCents)} total</small></div>
    </div>
    <Wallet userId={u.id} email={u.email} initial={data.wallet} />
    <section className="adm-panel"><h2>Sign-in methods</h2>
      <ul className="adm-list">{data.accounts.length ? data.accounts.map(a => <li key={a.method}><MethodBadge method={a.method} /><span>Linked {dateTime(a.createdAt)}</span></li>) : <li>None</li>}</ul>
    </section>
    <section className="adm-panel"><h2>Active sessions ({data.sessions.length})</h2>
      {data.sessions.length === 0 ? <p className="muted-note">Not signed in on any device.</p> :
        <div className="adm-table-wrap"><table className="adm-table static"><thead><tr><th>Started</th><th>Expires</th><th>IP address</th><th>Device</th></tr></thead>
          <tbody>{data.sessions.map((s, i) => <tr key={i}><td>{dateTime(s.createdAt)}</td><td>{dateTime(s.expiresAt)}</td><td>{s.ipAddress || "—"}</td><td title={s.userAgent ?? ""}>{device(s.userAgent)}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="adm-panel"><h2>Sign-in history (last 50)</h2>
      {data.logins.length === 0 ? <p className="muted-note">No sign-ins recorded yet.</p> :
        <div className="adm-table-wrap"><table className="adm-table static"><thead><tr><th>Time</th><th>Method</th><th>IP address</th><th>Device</th></tr></thead>
          <tbody>{data.logins.map((l, i) => <tr key={i}><td>{dateTime(l.createdAt)}</td><td><MethodBadge method={l.method} /></td><td>{l.ipAddress || "—"}</td><td title={l.userAgent ?? ""}>{device(l.userAgent)}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

// Future task S8: balances + full ledger + Adjust balance (credit / debit with a reason the customer sees, confirm step).
function Wallet({ userId, email, initial }: { userId: string; email: string; initial: AdminWallet }) {
  const [w, setW] = useState(initial); const [open, setOpen] = useState(false);
  return <section className="adm-panel wal" aria-labelledby="wal-h">
    <div className="wal-head"><h2 id="wal-h">Balance</h2>{!open && <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>Adjust balance</button>}</div>
    <div className="acct-tiles wal-tiles">
      <div className="acct-tile"><span>Wallet</span><strong>{money(w.walletMinor, "THB")}</strong></div>
      <div className="acct-tile"><span>Gift card balance</span><strong>{money(w.giftMinor, "THB")}</strong></div>
      <div className="acct-tile"><span>Total owed</span><strong>{money(w.walletMinor + w.giftMinor, "THB")}</strong></div>
    </div>
    {open && <Adjust userId={userId} email={email} w={w} onDone={(nw) => { if (nw) setW(nw); setOpen(false); }} />}
    <h3 className="wal-sub">Transactions ({w.transactions.length})</h3>
    {!w.transactions.length ? <p className="muted-note">No transactions yet.</p> : <div className="adm-table-wrap"><table className="adm-table static">
      <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Balance</th><th className="num">Amount</th><th className="num">Balance after</th><th>By</th></tr></thead>
      <tbody>{w.transactions.map((t) => <tr key={t.id}><td>{dateTime(t.createdAt)}</td><td>{typeLabel(t.type)}</td><td className="wal-ref">{t.ref}</td><td>{BUCKET_LABEL[t.bucket]}</td>
        <td className={`num ${t.amountMinor < 0 ? "wal-minus" : "wal-plus"}`}>{t.amountMinor < 0 ? "−" : "+"}{money(Math.abs(t.amountMinor), "THB")}</td><td className="num">{money(t.balanceMinor, "THB")}</td><td>{t.by ?? "Customer"}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}

function Adjust({ userId, email, w, onDone }: { userId: string; email: string; w: AdminWallet; onDone: (w?: AdminWallet) => void }) {
  const [dir, setDir] = useState<AdjustDirection>("credit"); const [bucket, setBucket] = useState<Bucket>("wallet");
  const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const minor = toSatang(amount); const current = bucket === "gift" ? w.giftMinor : w.walletMinor;
  const review = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!minor) return setError("Enter an amount in THB, like 250 or 99.50.");
    if (!reason.trim()) return setError("Enter a reason. The customer sees it in their balance history.");
    if (dir === "debit" && minor > current) return setError("A debit cannot take the balance below ฿0.");
    setConfirm(true);
  };
  const save = async () => {
    setBusy(true); setError(""); const r = await adminApi.adjustBalance({ userId, direction: dir, bucket, amountMinor: minor!, reason }); setBusy(false);
    if (r.ok) onDone(r.wallet); else { setError(r.error); setConfirm(false); }
  };
  return <form className="wal-form" onSubmit={review} noValidate>
    <fieldset disabled={confirm || busy}>
      <legend className="sr-only">Adjust balance</legend>
      <div className="wal-dir" role="radiogroup" aria-label="Credit or debit">
        {(["credit", "debit"] as const).map((d) => <label key={d} className="check"><input type="radio" name="dir" value={d} checked={dir === d} onChange={() => setDir(d)} /> {d === "credit" ? "Credit (add)" : "Debit (take away)"}</label>)}
      </div>
      <div className="wal-fields">
        <label className="field"><span>Balance</span><select value={bucket} onChange={(e) => setBucket(e.target.value as Bucket)}><option value="wallet">Wallet ({money(w.walletMinor, "THB")})</option><option value="gift">Gift card balance ({money(w.giftMinor, "THB")})</option></select></label>
        <label className="field"><span>Amount (THB)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
      </div>
      <label className="field"><span>Reason (the customer sees this)</span><input value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Refund for order CC-12345678" /></label>
    </fieldset>
    {error && <Notice tone="error">{error}</Notice>}
    {confirm ? <div className="wal-confirm" role="alertdialog" aria-label="Confirm adjustment">
      <p>{dir === "credit" ? "Add" : "Take"} <strong>{money(minor!, "THB")}</strong> {dir === "credit" ? "to" : "from"} the {BUCKET_LABEL[bucket].toLowerCase()} of {email}? New balance: <strong>{money(current + (dir === "credit" ? minor! : -minor!), "THB")}</strong>. Reason: “{reason.trim()}”. This cannot be edited later (a new adjustment can reverse it).</p>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Confirm"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setConfirm(false)}>Back</button></div>
    </div> : <div className="wal-actions"><button className="btn btn-primary btn-sm">Review</button><button type="button" className="btn btn-outline btn-sm" onClick={() => onDone()}>Cancel</button></div>}
  </form>;
}

export default function AdminUserPage() {
  return <AdminShell title="User details"><Detail /></AdminShell>;
}
