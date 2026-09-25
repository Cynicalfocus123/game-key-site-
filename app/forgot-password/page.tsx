"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { AuthCard, AuthLink, DemoInbox, Field, Notice, PageShell } from "../components/auth-ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [link, setLink] = useState<string>(); const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    const r = await api.requestReset(email); setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(true); setLink(r.demoLink);
  };
  return <PageShell narrow><AuthCard title="Reset password" sub="Enter your account email. We will send a reset link.">
    {done ? <><Notice tone="success">If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 1 hour.</Notice><DemoInbox link={link} label="Open reset link" /></> :
    <form onSubmit={submit} noValidate><Field label="Email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />{error && <Notice tone="error">{error}</Notice>}<button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></form>}
    <p className="auth-foot"><AuthLink href="/login">Back to sign in</AuthLink></p>
  </AuthCard></PageShell>;
}
