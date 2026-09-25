"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { AuthCard, AuthLink, Field, Notice, PageShell, readQuery } from "../components/auth-ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null); const [pw, setPw] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { setToken(readQuery("token")); if (readQuery("error")) setError("Reset link is invalid or expired. Request a new one."); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== confirm) return setError("Passwords do not match.");
    if (!token) return setError("Reset link is missing its token. Request a new one.");
    setBusy(true); const r = await api.resetPassword(token, pw); setBusy(false);
    if (!r.ok) return setError(r.error);
    router.replace("/login?reset=1");
  };
  return <PageShell narrow><AuthCard title="Choose a new password" sub="All other sessions sign out after the change.">
    <form onSubmit={submit} noValidate>
      <Field label="New password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." value={pw} onChange={e => setPw(e.target.value)} />
      <Field label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
    </form>
    <p className="auth-foot"><AuthLink href="/forgot-password">Request a new link</AuthLink></p>
  </AuthCard></PageShell>;
}
