"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import type { AdminTopUpDetail } from "@/lib/client/types";
import { currencyInfo } from "@/lib/currency/currencies";
import { CLOSE_REASON_MAX, METHOD_LABEL, STATUS_CHIP, statusLabel, toMinor } from "@/lib/topup";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice, readQuery } from "../../components/auth-ui";

// Admin top-up detail (future task T1): amounts + rate, timeline, webhook event log, and for pending top-ups
// "Mark failed" / "Cancel" with a required reason (audited). Card top-ups are never credited here (provider webhook only; corrections =
// Adjust balance on the user, S8). Top-up redesign: a bank transfer that is waiting (or expired) gets "Confirm received": the admin types
// the amount that arrived (must equal the top-up) + optional bank reference → wallet credited once + audit + email.
function Detail() {
  const [t, setT] = useState<AdminTopUpDetail | null>(null); const [error, setError] = useState("");
  const [action, setAction] = useState<"fail" | "cancel" | "confirm" | null>(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [received, setReceived] = useState(""); const [bankRef, setBankRef] = useState("");
  useEffect(() => {
    const id = readQuery("id"); if (!id) { setError("Missing top-up id."); return; }
    adminApi.topUp(id).then((r) => (r.ok ? setT(r.topUp) : setError(r.error)));
  }, []);
  if (error && !t) return <><Notice tone="error">{error}</Notice><Link className="text-link" href="/admin/topups">← Back to top-ups</Link></>;
  if (!t) return <p className="muted-note">Loading…</p>;
  const decimals = currencyInfo(t.currency)?.decimals ?? 2;
  const confirm = async () => {
    const minor = toMinor(received, decimals);
    if (!minor) { setError("Enter the amount that arrived, like 50 or 50.00."); return; }
    setBusy(true); setError(""); const r = await adminApi.confirmTopUp(t.id, minor, bankRef); setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setT(r.topUp); setAction(null); setReceived(""); setBankRef(""); setMsg("Bank transfer confirmed. The wallet was credited and the customer was emailed.");
  };
  const save = async () => {
    if (!action || action === "confirm") return;
    if (!reason.trim()) { setError("Enter a reason. It is saved with your name in the audit log."); return; }
    setBusy(true); setError(""); const r = await adminApi.closeTopUp(t.id, action, reason); setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setT(r.topUp); setAction(null); setReason(""); setMsg(action === "fail" ? "Marked failed." : "Top-up cancelled.");
  };
  const bank = t.method === "bank"; const canConfirm = bank && (t.status === "pending" || t.status === "expired");
  const timeline: [string, string | null][] = [["Created", t.createdAt], [bank ? "Waits until" : "Pending deadline", t.status === "pending" ? t.expiresAt : null], [bank ? "Money arrived" : "Paid", t.paidAt], ["Credited", t.creditedAt], [t.status === "credited" ? "" : statusLabel(t), t.closedAt]];
  return <>
    <p className="adm-back"><Link className="text-link" href="/admin/topups">← All top-ups</Link></p>
    <div className="adm-head"><h2>{t.number}</h2><span className={`chip ${STATUS_CHIP[t.status]}`} data-testid="adm-tu-status">{statusLabel(t)}</span></div>
    <div className="acct-tiles">
      <div className="acct-tile"><span>Customer</span><strong className="tu-adm-email"><Link className="text-link" href={`/admin/user?id=${encodeURIComponent(t.userId)}`}>{t.email}</Link></strong></div>
      <div className="acct-tile"><span>Charged</span><strong>{money(t.amountMinor, t.currency)} {t.currency}</strong><small>Rate {t.fxRate} {t.currency} per 1 THB</small></div>
      <div className="acct-tile"><span>Wallet credit</span><strong>{money(t.creditMinor, "THB")}</strong><small>{t.status === "credited" ? "Added to the wallet" : "Added only when paid"}</small></div>
      {bank ? <div className="acct-tile"><span>Bank transfer</span><strong><code data-testid="adm-tu-ref">{t.customerRef ?? "—"}</code></strong><small>Customer reference · {t.providerRef ? `bank ref ${t.providerRef}` : "no bank reference yet"}</small></div>
        : <div className="acct-tile"><span>Provider</span><strong>{t.provider}</strong><small>{t.providerRef ?? "No provider reference yet"}</small></div>}
    </div>
    {t.reviewNote && <Notice tone="error"><strong>Needs review:</strong> a verified payment event was refused, so nothing was credited. The customer may have been charged. Check the provider dashboard.<pre className="tu-review">{t.reviewNote}</pre></Notice>}
    <section className="adm-panel"><h2>Timeline</h2>
      <ul className="adm-list">{timeline.filter(([l, at]) => l && at).map(([l, at]) => <li key={l}><span>{l}</span><span>{dateTime(at)}</span></li>)}</ul>
      {t.failureReason && <p className="muted-note">Note: {t.failureReason}{t.closedBy ? ` (by ${t.closedBy})` : ""}</p>}
      {t.confirmedBy && <p className="muted-note">Method: {METHOD_LABEL[t.method]} · confirmed received by {t.confirmedBy}</p>}
    </section>
    <section className="adm-panel" aria-labelledby="tu-act-h"><h2 id="tu-act-h">Actions</h2>
      {canConfirm && <>
        {action !== "confirm" && <div className="tu-adm-btns"><button type="button" className="btn btn-primary btn-sm" onClick={() => { setAction("confirm"); setMsg(""); setError(""); }}>Confirm received…</button></div>}
        {action === "confirm" && <div className="wal-confirm" role="alertdialog" aria-label="Confirm bank transfer received">
          <p>Check your bank account first: a transfer with reference <strong>{t.customerRef ?? "—"}</strong> for <strong>{money(t.amountMinor, t.currency)} {t.currency}</strong>.</p>
          <label className="field"><span>Amount received ({t.currency})</span><input inputMode="decimal" autoFocus value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d.,]/g, "").slice(0, 14))} placeholder={(t.amountMinor / 10 ** decimals).toFixed(decimals)} /></label>
          <label className="field"><span>Bank reference (optional, saved with the top-up)</span><input value={bankRef} maxLength={80} onChange={(e) => setBankRef(e.target.value)} placeholder="e.g. bank transaction number" /></label>
          <p>This adds <strong>{money(t.creditMinor, "THB")}</strong> to the customer&apos;s wallet once and emails them. It cannot be undone here (use Adjust balance to correct).</p>
          <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={confirm}>{busy ? "Saving…" : "Confirm"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setAction(null); setError(""); }}>Back</button></div>
        </div>}
      </>}
      {t.status === "pending" ? <>
        {!action && <div className="tu-adm-btns"><button type="button" className="btn btn-outline btn-sm" onClick={() => { setAction("fail"); setMsg(""); }}>Mark failed…</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setAction("cancel"); setMsg(""); }}>Cancel…</button></div>}
        {(action === "fail" || action === "cancel") && <div className="wal-confirm" role="alertdialog" aria-label={action === "fail" ? "Mark failed" : "Cancel top-up"}>
          <label className="field"><span>Reason (saved in the audit log; the customer sees it)</span><input value={reason} maxLength={CLOSE_REASON_MAX} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked to cancel" /></label>
          <p>{action === "fail" ? "Mark this top-up as failed?" : "Cancel this top-up?"} It can no longer be paid from this page. Nothing is added to or taken from the wallet.</p>
          <div><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Confirm"}</button><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setAction(null); setError(""); }}>Back</button></div>
        </div>}
      </> : !canConfirm && <p className="muted-note">Only pending top-ups can be marked failed or cancelled.</p>}
      {!bank && <p className="muted-note"><button type="button" className="btn btn-outline btn-sm" disabled title="Needs a payment provider">Refund to card</button> Needs a payment provider. To correct a wallet, use Adjust balance on the <Link className="text-link" href={`/admin/user?id=${encodeURIComponent(t.userId)}`}>user</Link>.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {msg && <Notice tone="success">{msg}</Notice>}
    </section>
    <section className="adm-panel"><h2>Payment events ({t.events.length})</h2>
      {!t.events.length ? <p className="muted-note">No webhook events received yet.</p> : <div className="adm-table-wrap"><table className="adm-table static">
        <thead><tr><th>Received</th><th>Event</th><th>Event id</th><th>Result</th></tr></thead>
        <tbody>{t.events.map((e) => <tr key={e.id}><td>{dateTime(e.receivedAt)}</td><td>{e.type}</td><td><code>{e.eventId}</code></td><td>{e.result}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}

export default function AdminTopUpPage() { return <AdminShell title="Top-up details"><Detail /></AdminShell>; }
