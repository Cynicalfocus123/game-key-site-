"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, isDemo } from "@/lib/client/api";
import type { EmailFailure, SentMail } from "@/lib/client/types";
import { coverFor } from "@/lib/catalog";
import { EMAIL_LIST, renderEmail, sampleEmail, type EmailId } from "@/lib/emails";
import { AdminShell, dateTime } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

const site = () => (typeof window === "undefined" ? "" : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}`);
const cover = (n: string) => { const c = coverFor(n); return c ? (c.startsWith("/") ? `${site()}${c}` : c) : null; };
const groups = [...new Set(EMAIL_LIST.map((e) => e.group))];

// Email previews (email task #27): every email with sample data at 600 px (desktop) or 375 px (phone), "Send test to me",
// and the outbox (demo: emails "sent" in this browser; dev server without RESEND_API_KEY: last 30 emails in memory).
export default function AdminEmailsPage() {
  const [pick, setPick] = useState<EmailId>("verify"); const [sentPick, setSentPick] = useState<SentMail | null>(null);
  const [width, setWidth] = useState<"desktop" | "phone">("desktop"); const [view, setView] = useState<"html" | "text">("html");
  const [outbox, setOutbox] = useState<SentMail[] | null | undefined>(undefined); /* undefined = loading, null = master admin only (N2) */ const [resend, setResend] = useState(false);
  const [failures, setFailures] = useState<EmailFailure[] | null>(null); // N4: master admin only
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const loadOutbox = useCallback(() => adminApi.emailOutbox().then((r) => { if (r.ok) { setOutbox(r.outbox); setResend(r.resend); setFailures(r.failures); } else setError(r.error); }), []);
  useEffect(() => { loadOutbox(); }, [loadOutbox]);
  const mail = useMemo(() => sentPick ?? { ...renderEmail(pick, sampleEmail(pick, site(), cover) as never, site()), to: "sample@example.com" }, [pick, sentPick]);
  const info = EMAIL_LIST.find((e) => e.id === (sentPick?.template ?? pick));
  const test = async () => { setBusy(true); setNote(""); setError(""); const r = await adminApi.sendTestEmail(pick); setBusy(false); if (r.ok) { setNote(`Test email sent to ${r.to}${isDemo ? " (demo outbox below)" : resend ? "" : " (dev: printed in the npm run dev terminal and kept in the outbox below)"}.`); loadOutbox(); } else setError(r.error); };
  return <AdminShell title="Emails">
    <p className="muted-note">Every CoreCart email uses the same layout. Previews use sample data. {isDemo ? "Demo: emails are kept in this browser (outbox below)." : resend ? "Real sending is on (Resend)." : "Real sending is off (no RESEND_API_KEY): emails print in the server terminal and the last 30 show in the outbox below."}</p>
    <div className="mail-admin">
      <nav className="mail-list" aria-label="Email templates">
        {groups.map((g) => <div key={g}><h2>{g}</h2>{EMAIL_LIST.filter((e) => e.group === g).map((e) =>
          <button key={e.id} type="button" aria-pressed={!sentPick && pick === e.id} onClick={() => { setPick(e.id); setSentPick(null); setNote(""); }}>{e.label}</button>)}</div>)}
        <label className="acct-picker mail-picker"><span>Email template</span><select aria-label="Email template" value={pick} onChange={(e) => { setPick(e.target.value as EmailId); setSentPick(null); }}>{EMAIL_LIST.map((e) => <option key={e.id} value={e.id}>{e.group} · {e.label}</option>)}</select></label>
      </nav>
      <section className="mail-view" aria-label="Preview">
        <div className="mail-tools">
          <div className="seg" role="group" aria-label="Preview width">{(["desktop", "phone"] as const).map((w) => <button key={w} type="button" aria-pressed={width === w} onClick={() => setWidth(w)}>{w === "desktop" ? "Desktop 600" : "Phone 375"}</button>)}</div>
          <div className="seg" role="group" aria-label="Format">{(["html", "text"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "html" ? "Email" : "Plain text"}</button>)}</div>
          {!sentPick && <button type="button" className="btn btn-primary btn-sm" onClick={test} disabled={busy}>{busy ? "Sending…" : "Send test to me"}</button>}
        </div>
        {note && <Notice tone="success">{note}</Notice>}{error && <Notice tone="error">{error}</Notice>}
        <dl className="mail-meta"><dt>Subject</dt><dd>{mail.subject}</dd><dt>To</dt><dd>{mail.to}</dd><dt>Sent when</dt><dd>{info?.when ?? "—"}</dd>{sentPick && <><dt>Sent</dt><dd>{dateTime(sentPick.sentAt)}</dd></>}</dl>
        {view === "html" ? <div className={`mail-frame mail-${width}`}><iframe title={`Preview: ${mail.subject}`} srcDoc={mail.html} sandbox="" /></div> : <pre className="mail-text">{mail.text}</pre>}
      </section>
    </div>
    <section className="adm-panel mail-outbox" aria-labelledby="outbox-title">
      <h2 id="outbox-title">{isDemo ? "Demo outbox (this browser)" : "Dev outbox (this server, not saved)"}</h2>
      {outbox === undefined ? <p className="muted-note">Loading…</p> : outbox === null ? <p className="muted-note">Only the master admin can see the outbox: it holds real emails of real accounts.</p> : outbox.length === 0 ? <p className="muted-note">{resend ? "Emails go out through Resend; nothing is kept here." : "No emails yet. Register, place a sample order or send a test."}</p> :
        <table className="dash-table"><thead><tr><th scope="col">Sent</th><th scope="col">To</th><th scope="col">Subject</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{outbox.map((m, i) => <tr key={`${m.sentAt}-${i}`}><td data-label="Sent">{dateTime(m.sentAt)}</td><td data-label="To">{m.to}</td><td data-label="Subject">{m.subject}{m.redacted && <span className="muted-note"> (sign-in code / link hidden)</span>}</td>
            <td><button type="button" className="text-link as-link" onClick={() => { setSentPick(m); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open<span className="sr-only"> {m.subject}</span></button></td></tr>)}</tbody></table>}
    </section>
    {failures && failures.length > 0 && <section className="adm-panel mail-outbox" aria-labelledby="fail-title">
      <h2 id="fail-title">Failed sends ({failures.length})</h2>
      <p className="muted-note">The email provider refused these, or they could not be sent after 3 tries. The person saw the usual message, so ask them to use "Send a new code" or "Forgot password" again once the cause is fixed.</p>
      <table className="dash-table"><thead><tr><th scope="col">When</th><th scope="col">To</th><th scope="col">Email</th><th scope="col">Why</th></tr></thead>
        <tbody>{failures.map((f, i) => <tr key={`${f.at}-${i}`}><td data-label="When">{dateTime(f.at)}</td><td data-label="To">{f.to}</td><td data-label="Email">{EMAIL_LIST.find((x) => x.id === f.template)?.label ?? f.template}</td><td data-label="Why">{f.error} ({f.attempts} {f.attempts === 1 ? "try" : "tries"})</td></tr>)}</tbody></table>
    </section>}
  </AdminShell>;
}
