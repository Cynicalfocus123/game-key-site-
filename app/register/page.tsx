"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { AuthCard, AuthLink, DemoInbox, Field, GoogleButton, Notice, PageShell } from "../components/auth-ui";
import { useAuth } from "../components/auth-provider";

export default function RegisterPage() {
  const router = useRouter(); const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", terms: false, marketing: false });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [sent, setSent] = useState<{ email: string; link?: string } | null>(null); const [resent, setResent] = useState("");
  useEffect(() => { if (user) router.replace("/account"); }, [user, router]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (!form.terms) return setError("Accept the Terms and Privacy Policy to continue.");
    setBusy(true);
    const r = await api.signUp({ name: form.name, email: form.email, password: form.password, marketingOptIn: form.marketing });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSent({ email: form.email, link: r.demoLink });
  };
  const resend = async () => { if (!sent) return; const r = await api.resendVerification(sent.email); if (r.ok) { setSent({ ...sent, link: r.demoLink ?? sent.link }); setResent("New link sent."); } else setResent(r.error); };

  if (sent) return <PageShell narrow><AuthCard title="Check your email" sub={<>We sent a verification link to <strong>{sent.email}</strong>. Open it to activate your account.</>}>
    <DemoInbox link={sent.link} label="Open verification link" />
    {api.mode === "server" && <p className="muted-note">Local development without RESEND_API_KEY prints the link in the terminal running <code>npm run dev</code>.</p>}
    <button className="btn btn-outline" onClick={resend}>Resend link</button>{resent && <Notice>{resent}</Notice>}
    <p className="auth-foot">Wrong email? <button className="text-link as-link" onClick={() => setSent(null)}>Start again</button></p>
  </AuthCard></PageShell>;

  return <PageShell narrow><AuthCard title="Create your account" sub="Buy game keys and PC hardware, track orders, and save payment methods.">
    <GoogleButton label="Sign up with Google" />
    <form onSubmit={submit} noValidate>
      <Field label="Full name" name="name" autoComplete="name" required value={form.name} onChange={set("name")} />
      <Field label="Email" type="email" name="email" autoComplete="email" required value={form.email} onChange={set("email")} />
      <Field label="Password" type="password" name="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." value={form.password} onChange={set("password")} />
      <Field label="Confirm password" type="password" name="confirm" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")} />
      <label className="check"><input type="checkbox" checked={form.terms} onChange={set("terms")} /><span>I agree to the <AuthLink href="/terms">Terms</AuthLink> and <AuthLink href="/privacy">Privacy Policy</AuthLink>, including processing of my personal data under Thailand PDPA.</span></label>
      <label className="check"><input type="checkbox" checked={form.marketing} onChange={set("marketing")} /><span>Send me deals and new releases by email (optional).</span></label>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    <p className="auth-foot">Already have an account? <AuthLink href="/login">Sign in</AuthLink></p>
  </AuthCard></PageShell>;
}
