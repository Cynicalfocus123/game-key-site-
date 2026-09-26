"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { AuthCard, AuthLink, DemoInbox, Field, GoogleButton, Notice, PageShell, readQuery, safeNext } from "../components/auth-ui";
import { useAuth } from "../components/auth-provider";

export default function LoginPage() {
  const router = useRouter(); const { user, refresh } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [unverified, setUnverified] = useState(false); const [demoLink, setDemoLink] = useState<string>(); const [info, setInfo] = useState("");
  const next = () => safeNext(readQuery("next")) ?? "/account";
  useEffect(() => { if (readQuery("reset") === "1") setInfo("Password changed. Sign in with your new password."); if (readQuery("error")) setError("Google sign-in failed or was cancelled."); }, []);
  useEffect(() => { if (user) router.replace(next()); }, [user, router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setUnverified(false); setBusy(true);
    const r = await api.signIn({ email, password });
    setBusy(false);
    if (!r.ok) { setError(r.error); if (r.code === "EMAIL_NOT_VERIFIED") setUnverified(true); return; }
    await refresh(); router.replace(next());
  };
  const resend = async () => { const r = await api.resendVerification(email); if (r.ok) { setDemoLink(r.demoLink); setInfo("Verification link sent. Check your email."); } };
  return <PageShell narrow><AuthCard title="Sign in" sub="Welcome back to CoreCart.">
    <GoogleButton label="Continue with Google" callbackPath={next()} />
    <form onSubmit={submit} noValidate>
      <Field label="Email" type="email" name="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      <Field label="Password" type="password" name="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      <p className="field-row"><AuthLink href="/forgot-password">Forgot password?</AuthLink></p>
      {info && <Notice tone="success">{info}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {unverified && api.mode === "demo" && <button type="button" className="btn btn-outline" onClick={resend}>Send verification link again</button>}
      <DemoInbox link={demoLink} label="Open verification link" />
      <button className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <p className="auth-foot">New to CoreCart? <AuthLink href="/register">Create account</AuthLink></p>
  </AuthCard></PageShell>;
}
