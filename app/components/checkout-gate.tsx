"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { DemoInbox, Divider, GoogleButton, Notice } from "./auth-ui";
import { useAuth } from "./auth-provider";
import { useCart, type GateView } from "./cart-provider";
import { Price } from "./currency-provider";
import { useMedia } from "./cart-ui";

// B1–B6: one modal, views switch in place. Opened by every Checkout click while signed out, /checkout, and the desktop header "Sign in".
export function CheckoutGate() {
  const { gate } = useCart();
  return gate ? <GateDialog view={gate.view} next={gate.next} /> : null;
}

function GateDialog({ view, next }: { view: GateView; next: string | null }) {
  const { closeGate, openGate, totals } = useCart(); const { refresh } = useAuth(); const router = useRouter(); const path = usePathname();
  const box = useRef<HTMLDivElement>(null); const wide = useMedia("(min-width: 768px)");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true); const [deals, setDeals] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [demoLink, setDemoLink] = useState<string>(); const [info, setInfo] = useState("");
  const toCheckout = next === "/checkout"; const after = next ?? path ?? "/account";
  const go = (v: GateView) => { setError(""); setInfo(""); setShow(false); openGate(v, next); };

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => { box.current?.querySelector<HTMLElement>("input, .gate-main button:not(.gate-back), .gate-main a")?.focus(); }, [view]);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); closeGate(); return; }
    if (e.key !== "Tab") return;
    const els = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input") ?? []); if (!els.length) return;
    const first = els[0]; const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    // No name field: name comes from the email local part, editable later in Settings.
    const r = await api.signUp({ name: email.trim().split("@")[0].slice(0, 60), email: email.trim(), password, marketingOptIn: deals, callbackPath: after });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDemoLink(r.demoLink); go("check-email");
  };
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    const r = await api.signIn({ email: email.trim(), password, rememberMe: remember, callbackPath: after });
    if (!r.ok) {
      setBusy(false);
      if (r.code !== "EMAIL_NOT_VERIFIED") return setError(r.error);
      if (api.mode === "demo") { const x = await api.resendVerification(email.trim(), after); if (x.ok) setDemoLink(x.demoLink); } // server already re-sent on sign-in
      return go("check-email");
    }
    await refresh(); setBusy(false); closeGate();
    if (next) router.push(next);
  };
  const resend = async () => { const r = await api.resendVerification(email.trim(), after); if (r.ok) { if (r.demoLink) setDemoLink(r.demoLink); setInfo("New link sent."); } else setInfo(r.error); };

  const pwd = <label className="field"><span>Password</span><span className="pw-wrap"><input name="password" type={show ? "text" : "password"} autoComplete={view === "register" ? "new-password" : "current-password"} required minLength={view === "register" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
    <button type="button" className="pw-eye" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button></span>{view === "register" && <small>At least 8 characters.</small>}</label>;
  const emailField = <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>;
  const split = wide && (view === "register" || view === "signin");
  const back = view !== "choice" && toCheckout && <button type="button" className="gate-back text-link as-link" onClick={() => go("choice")}>‹ Back</button>;

  let body: React.ReactNode;
  if (view === "choice") body = <>
    <h2 id="gate-title">Almost there</h2><p className="gate-sub">Your keys are saved to your account, so we need to know who you are.</p>
    <div className="gate-choice">
      <section><p className="eyebrow">NEW TO CORECART</p><h3>Create an account</h3><button type="button" className="btn btn-primary" onClick={() => go("register")}>Continue</button></section>
      <div className="gate-or" aria-hidden="true"><span>or</span></div>
      <section><p className="eyebrow">RETURNING CUSTOMER</p><h3>I already have an account</h3><button type="button" className="btn btn-outline" onClick={() => go("signin")}>Sign in</button></section>
    </div>
    <div className="gate-foot"><span>{totals.count} {totals.count === 1 ? "item" : "items"} · <Price thb={totals.total} /> stay in your cart</span><span>🔒 Secure checkout</span></div>
  </>;
  else if (view === "register") body = <>
    {back}<h2 id="gate-title"><span aria-hidden="true">🔒</span> {toCheckout ? "Create your account to check out" : "Create your account"}</h2>
    <ul className="gate-benefits"><li>Keys safe in your library</li><li>Every order in one place</li><li>Support tickets</li></ul>
    <form onSubmit={register} noValidate>{emailField}{pwd}
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Keep me signed in</span></label>
      <label className="check"><input type="checkbox" name="deals" checked={deals} onChange={(e) => setDeals(e.target.checked)} /><span>Email me CoreCart deals (optional)</span></label>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button></form>
    <Divider /><GoogleButton label="Continue with Google" callbackPath={after} noDivider />
    <p className="gate-legal">By creating an account you agree to our <Link className="text-link" href="/terms">Terms</Link> and <Link className="text-link" href="/privacy">Privacy policy</Link>.</p>
    {!split && <div className="gate-bar"><span>Already have an account?</span><button type="button" className="text-link as-link" onClick={() => go("signin")}>Sign in</button></div>}
  </>;
  else if (view === "signin") body = <>
    {back}<h2 id="gate-title">{toCheckout ? "Sign in to check out" : "Sign in"}</h2>
    <form onSubmit={signIn} noValidate>{emailField}{pwd}
      <div className="gate-row"><label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Keep me signed in</span></label><Link className="text-link" href="/forgot-password" onClick={closeGate}>Forgot password?</Link></div>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>
    <Divider /><GoogleButton label="Continue with Google" callbackPath={after} noDivider />
    {!split && <div className="gate-bar"><span>New to CoreCart?</span><button type="button" className="text-link as-link" onClick={() => go("register")}>Create account</button></div>}
  </>;
  else body = <div className="gate-mail">
    <span className="gate-mail-icon" aria-hidden="true">✉</span><h2 id="gate-title">Check your email</h2>
    <p>We sent a link to <strong>{email || "your email"}</strong>. Open it in this browser to go straight to {toCheckout ? "checkout with your cart" : "your account"}.</p>
    <DemoInbox link={demoLink} label="Open verification link" />
    {info && <Notice tone="success">{info}</Notice>}
    <button type="button" className="btn btn-primary" onClick={() => go("signin")}>I&apos;ve verified — sign in</button>
    <button type="button" className="btn btn-outline" onClick={resend}>Resend email</button>
  </div>;

  return <div className="gate-wrap" role="presentation" onKeyDown={keys}>
    <button type="button" className="gate-bg" aria-label="Close" tabIndex={-1} onClick={closeGate} />
    <div ref={box} className={`gate gate-${view}${split ? " split" : ""}`} role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <button type="button" className="gate-x" aria-label="Close" onClick={closeGate}>×</button>
      <div className="gate-main">{body}</div>
      {split && <aside className="gate-panel"><div className="gate-art" aria-hidden="true"><span>⌘</span></div>
        {view === "signin" ? <><p>New to CoreCart?</p><button type="button" className="btn gate-panel-btn" onClick={() => go("register")}>Create account</button></>
          : <><p>Already have an account?</p><button type="button" className="btn gate-panel-btn" onClick={() => go("signin")}>Sign in</button></>}
      </aside>}
    </div>
  </div>;
}
