"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi, api } from "@/lib/client/api";
import { AdminAuthShell } from "../../components/admin-shell";
import { useAuth } from "../../components/auth-provider";
import { AuthCard, AuthLink, Field, GoogleButton, Notice, readQuery } from "../../components/auth-ui";

export default function AdminLoginPage() {
  const router = useRouter(); const { refresh } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const next = () => { const n = readQuery("next"); return n && /^\/admin(\/|$|\?)/.test(n) ? n : "/admin"; };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const r = await api.signIn({ email, password, callbackPath: "/admin" });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    if (!await adminApi.me()) { await api.signOut(); await refresh(); setBusy(false); return setError("This account has no admin access."); }
    await refresh(); router.replace(next());
  };
  return <AdminAuthShell><AuthCard title="Admin sign in" sub="CoreCart staff only.">
    <GoogleButton label="Continue with Google" callbackPath="/admin" />
    <form onSubmit={submit} noValidate>
      <Field label="Email" type="email" name="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      <Field label="Password" type="password" name="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      <p className="field-row"><AuthLink href="/forgot-password">Forgot password?</AuthLink></p>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <p className="auth-foot">New admin? <AuthLink href="/admin/register">Create admin account</AuthLink></p>
  </AuthCard></AdminAuthShell>;
}
