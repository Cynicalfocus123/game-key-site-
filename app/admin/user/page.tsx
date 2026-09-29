"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import type { AdminUserDetail, AdminWallet } from "@/lib/client/types";
import { typeLabel, type Bucket } from "@/lib/gift-cards";
import { BUCKET_LABEL, REASON_MAX, toSatang, type AdjustDirection } from "@/lib/wallet";
import { auditText, roleLabel, ROLES, type Role } from "@/lib/users";
import { matchText, SELLER_STATUS_CHIP, SELLER_STATUS_LABEL, type SellerStatus } from "@/lib/sellers";
import { STATUS_CHIP, STATUS_LABEL, type TopUp } from "@/lib/topup";
import { useAuth } from "../../components/auth-provider";
import { AdminShell, MethodBadge, dateTime, device, useAdminMe } from "../../components/admin-shell";
import { isAdminRole } from "@/lib/admin-perms";
import { Notice, readQuery } from "../../components/auth-ui";

// Static export cannot pre-render one page per user, so the user id comes from ?id=.
function Detail() {
  const [data, setData] = useState<AdminUserDetail | null>(null); const [error, setError] = useState("");
  const load = () => {
    const id = readQuery("id");
    if (!id) { setError("Missing user id."); return; }
    adminApi.user(id).then(r => r.ok ? setData(r.data) : setError(r.error));
  };
  useEffect(load, []);
  if (error) return <><Notice tone="error">{error}</Notice><Link className="text-link" href="/admin/users">← Back to users</Link></>;
  if (!data) return <p className="muted-note">Loading…</p>;
  const { user: u } = data;
  return <>
    <p className="adm-back"><Link className="text-link" href="/admin/users">← All users</Link></p>
    <div className="adm-head"><h2>{u.name}</h2><span>{u.email}</span></div>
    <div className="acct-tiles">
      <div className="acct-tile"><span>Registered</span><strong>{dateTime(u.createdAt)}</strong><small>Terms accepted {dateTime(u.termsAcceptedAt)}</small></div>
      <div className="acct-tile"><span>Email</span><strong className={u.emailVerified ? "ok" : "warn"}>{u.emailVerified ? "Verified" : "Not verified"}</strong><small>Marketing: {u.marketingOptIn ? "yes" : "no"}</small></div>
      <div className="acct-tile"><span>Role</span><strong>{roleLabel(u.role)}{u.status === "closed" ? " · Closed" : ""}</strong><small>Updated {dateTime(u.updatedAt)}</small></div>
      <div className="acct-tile"><span>Orders</span><strong>{data.orders.count}</strong><small>{data.orders.byCurrency.length ? data.orders.byCurrency.map((c) => money(c.totalMinor, c.currency)).join(" · ") : "No orders"}{data.orders.byCurrency.length > 0 && " total"}</small></div>
    </div>
    {u.status === "closed" && <Notice tone="error">Account closed {dateTime(u.closedAt)} {u.closedBySelf ? "by the account owner" : "by an admin"}: “{u.closedReason}”. Sign-in is blocked. {u.closedEmail && u.closedEmail !== u.email ? `Its email ${u.closedEmail} was taken by a new sign-up.` : ""}</Notice>}
    {data.matches.length > 0 && <div className="sa-matches" role="alert"><strong>⚠ Returning person</strong><ul>{data.matches.map((m, i) => <li key={i}>{matchText(m)}{m.at ? ` · ${dateTime(m.at)}` : ""} · {m.applicationId ? <Link className="text-link" href={`/admin/seller?id=${encodeURIComponent(m.applicationId)}`}>Open {m.number}</Link> : <a className="text-link" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/user/?id=${encodeURIComponent(m.userId)}`}>Open closed account</a>}</li>)}</ul></div>}
    {data.applications.length > 0 && <section className="adm-panel"><h2>Seller applications</h2><ul className="adm-list">{data.applications.map((a) => <li key={a.id}><Link className="text-link" href={`/admin/seller?id=${encodeURIComponent(a.id)}`}>{a.number}</Link><span className={`chip ${SELLER_STATUS_CHIP[a.status as SellerStatus]}`}>{SELLER_STATUS_LABEL[a.status as SellerStatus]}</span><span>{dateTime(a.createdAt)}</span></li>)}</ul></section>}
    <RolePanel data={data} onSaved={load} />
    <ClosePanel data={data} onSaved={load} />
    <Wallet userId={u.id} email={u.email} initial={data.wallet} topUps={data.topUps} />
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

// S7: role change (confirm step, audited) + history of admin actions on this user.
function RolePanel({ data, onSaved }: { data: AdminUserDetail; onSaved: () => void }) {
  const { user: me } = useAuth(); const self = me?.id === data.user.id; const perms = useAdminMe();
  // T2: only the master admin changes admin roles; other admins see customer / seller only.
  const locked = !perms.master && isAdminRole(data.user.role); const roles = ROLES.filter((r) => perms.master || !isAdminRole(r.id));
  const [role, setRole] = useState<Role>(data.user.role as Role); const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const save = async () => {
    setBusy(true); setError(""); const r = await adminApi.setUserRole(data.user.id, role); setBusy(false); setConfirm(false);
    if (r.ok) { setSaved(`Role changed to ${roleLabel(role)}.`); onSaved(); } else setError(r.error);
  };
  return <section className="adm-panel" aria-labelledby="role-h"><h2 id="role-h">Role</h2>
    {self ? <p className="muted-note">This is your account. {perms.master ? "Another master admin" : "The master admin"} can change your role.</p> : locked ? <p className="muted-note">Only the master admin can change or remove an admin.</p> : <div className="adm-role">
      <label className="field"><span>Role</span><select value={role} disabled={confirm || busy} onChange={(e) => { setRole(e.target.value as Role); setSaved(""); setError(""); }}>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
      {!confirm && <button type="button" className="btn btn-outline btn-sm" disabled={role === data.user.role} onClick={() => setConfirm(true)}>Change role</button>}
    </div>}
    {confirm && <div className="wal-confirm" role="alertdialog" aria-label="Confirm role change">
      <p>Change {data.user.email} from <strong>{roleLabel(data.user.role)}</strong> to <strong>{roleLabel(role)}</strong>?{role === "admin" ? " A new admin starts with no sections: tick them on the Admins page." : role === "master_admin" ? " A master admin has every section and manages admins." : ""}{isAdminRole(data.user.role) && !isAdminRole(role) ? " They lose admin access at once." : ""}</p>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Confirm"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setConfirm(false); setRole(data.user.role as Role); }}>Cancel</button></div>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
    {data.audit.length > 0 && <><h3 className="wal-sub">Admin history</h3><ul className="adm-list adm-audit">{data.audit.map((a, i) => <li key={i}><span>{dateTime(a.createdAt)}</span><span>{auditText(a)}</span><span>{a.by ?? "—"}</span></li>)}</ul></>}
  </section>;
}

// T3: close (reason) / reopen (note) an account. Data is kept; closed = sign-in blocked, sessions ended. Admin accounts cannot be closed.
function ClosePanel({ data, onSaved }: { data: AdminUserDetail; onSaved: () => void }) {
  const { user: me } = useAuth(); const closed = data.user.status === "closed";
  const [open, setOpen] = useState(false); const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  if (me?.id === data.user.id || isAdminRole(data.user.role)) return null;
  const go = async () => {
    setBusy(true); setError(""); const r = closed ? await adminApi.reopenUser(data.user.id, text) : await adminApi.closeUser(data.user.id, text); setBusy(false);
    if (r.ok) { setSaved(closed ? "Account reopened." : "Account closed."); setOpen(false); setText(""); onSaved(); } else setError(r.error);
  };
  return <section className="adm-panel" aria-labelledby="close-h"><h2 id="close-h">{closed ? "Reopen account" : "Close account"}</h2>
    <p className="muted-note">{closed ? "Sign-in works again. The old email comes back unless a newer account uses it." : "Blocks sign-in and ends every session. Nothing is deleted; the account moves to the Closed tab."}</p>
    {!open ? <button type="button" className={`btn btn-sm ${closed ? "btn-outline" : "btn-outline btn-danger"}`} onClick={() => { setOpen(true); setSaved(""); }}>{closed ? "Reopen account…" : "Close account…"}</button> :
    <div className="wal-confirm" role="alertdialog" aria-label={closed ? "Confirm reopen" : "Confirm close"}>
      <p>{closed ? `Reopen ${data.user.email}?` : `Close ${data.user.email}? They are signed out everywhere and cannot sign in.`}</p>
      <label className="field"><span>{closed ? "Note (required)" : "Reason (required)"}</span><input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} autoFocus /></label>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={go}>{busy ? "Saving…" : closed ? "Reopen" : "Close account"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancel</button></div>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
  </section>;
}

// Future task S8: balances + full ledger + Adjust balance (credit / debit with a reason the customer sees, confirm step). T1: top-ups list.
function Wallet({ userId, email, initial, topUps }: { userId: string; email: string; initial: AdminWallet; topUps: TopUp[] }) {
  const [w, setW] = useState(initial); const [open, setOpen] = useState(false); const me = useAdminMe(); const canAdjust = me.master || me.perms.includes("wallet"); // T2
  return <section className="adm-panel wal" aria-labelledby="wal-h">
    <div className="wal-head"><h2 id="wal-h">Balance</h2>{!open && canAdjust && <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>Adjust balance</button>}</div>
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
    <h3 className="wal-sub">Top-ups ({topUps.length}{topUps.length === 20 ? ", latest" : ""})</h3>
    {!topUps.length ? <p className="muted-note">No top-ups yet.</p> : <div className="adm-table-wrap"><table className="adm-table static">
      <thead><tr><th>Number</th><th className="num">Charged</th><th className="num">Wallet credit</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>{topUps.map((t) => <tr key={t.id}><td><Link className="text-link" href={`/admin/topup?id=${encodeURIComponent(t.id)}`}>{t.number}</Link></td><td className="num">{money(t.amountMinor, t.currency)} {t.currency}</td>
        <td className="num">{money(t.creditMinor, "THB")}</td><td><span className={`chip ${STATUS_CHIP[t.status]}`}>{STATUS_LABEL[t.status]}</span></td><td>{dateTime(t.createdAt)}</td></tr>)}</tbody>
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
