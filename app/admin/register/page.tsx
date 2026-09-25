"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { AdminAuthShell } from "../../components/admin-shell";
import { AuthCard, AuthLink, DemoInbox, Field, Notice } from "../../components/auth-ui";

export default function AdminRegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [sent, setSent] = useState<{ email: string; link?: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!form.name.trim() || !form.email.trim()) return setError("Enter your name and email.");
    if (form.password.length < 12) return setError("Admin password must be at least 12 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    const r = await api.signUp({ name: form.name, email: form.email, password: form.password, marketingOptIn: false, callbackPath: "/admin", admin: true });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSent({ email: form.email, link: r.demoLink });
  };
  if (sent) return <AdminAuthShell><AuthCard title="Check your email" sub={<>We sent a verification link to <strong>{sent.email}</strong>. Admin access starts after the email is verified.</>}>
    <DemoInbox link={sent.link} label="Open verification link" />
    {api.mode === "server" && <p className="muted-note">Local development without RESEND_API_KEY prints the link in the terminal running <code>npm run dev</code>.</p>}
    <p className="auth-foot"><AuthLink href="/admin/login">Back to admin sign in</AuthLink></p>
  </AuthCard></AdminAuthShell>;
  return <AdminAuthShell><AuthCard title="Create admin account" sub={api.mode === "demo" ? "Demo: any email becomes an admin in this browser only." : "Only emails approved by the site owner (ADMIN_EMAILS) get admin access. Other emails become normal customer accounts."}>
    <form onSubmit={submit} noValidate>
      <Field label="Full name" name="name" autoComplete="name" required value={form.name} onChange={set("name")} />
      <Field label="Work email" type="email" name="email" autoComplete="email" required value={form.email} onChange={set("email")} />
      <Field label="Password" type="password" name="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters." value={form.password} onChange={set("password")} />
      <Field label="Confirm password" type="password" name="confirm" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")} />
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating account…" : "Create admin account"}</button>
    </form>
    <p className="auth-foot">Already an admin? <AuthLink href="/admin/login">Sign in</AuthLink></p>
  </AuthCard></AdminAuthShell>;
}
