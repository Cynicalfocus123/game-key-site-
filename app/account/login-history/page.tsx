"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { LoginRow } from "@/lib/client/types";
import { LOGIN_HISTORY_DAYS } from "@/lib/profile";
import { AccountShell } from "../../components/account-shell";
import { device, methodLabel } from "../../components/admin-shell";
import { Notice } from "../../components/auth-ui";

// Login history (Handoff v8 C2): own sign-ins, last 90 days, masked IP.
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function LoginHistoryPage() {
  const [rows, setRows] = useState<LoginRow[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { api.loginHistory().then((r) => (r.ok ? setRows(r.logins) : setError(r.error))); }, []);
  return <AccountShell title="Login history">{() => <>
    <div className="dash-intro"><p>Sign-ins to your account in the last {LOGIN_HISTORY_DAYS} days.</p><p>Not you? <Link className="text-link" href="/account/settings#password">Change password</Link></p></div>
    {error && <Notice tone="error">{error}</Notice>}
    {rows === null ? !error && <p className="muted-note">Loading…</p> : rows.length === 0 ? <p className="empty">No sign-ins in the last {LOGIN_HISTORY_DAYS} days.</p> :
      <table className="dash-table">
        <thead><tr><th scope="col">Date</th><th scope="col">Method</th><th scope="col">Device</th><th scope="col">IP address</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={`${r.createdAt}-${i}`}>
          <td data-label="Date"><span>{when(r.createdAt)}{i === 0 && <span className="chip chip-blue">Latest</span>}</span></td>
          <td data-label="Method">{methodLabel(r.method)}</td>
          <td data-label="Device">{device(r.userAgent)}</td>
          <td data-label="IP address"><code>{r.ip}</code></td>
        </tr>)}</tbody>
      </table>}
  </>}</AccountShell>;
}
