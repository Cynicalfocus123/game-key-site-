"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import type { SessionUser } from "@/lib/client/types";
import { COUNTRY_CODES } from "@/lib/currency/currencies";
import { AVATARS, countryName } from "@/lib/profile";
import { AccountShell, Avatar } from "../../components/account-shell";
import { useAuth } from "../../components/auth-provider";
import { Field, Notice } from "../../components/auth-ui";
import { useCurrency } from "../../components/currency-provider";

type Msg = { tone: "success" | "error"; text: string } | null;
const countries = COUNTRY_CODES.map((c) => ({ code: c, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name));

function ProfileForm({ user }: { user: SessionUser }) {
  const { refresh } = useAuth();
  const [name, setName] = useState(user.name); const [avatar, setAvatar] = useState(user.avatar ?? ""); const [country, setCountry] = useState(user.country ?? "");
  const [msg, setMsg] = useState<Msg>(null); const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim()) return setMsg({ tone: "error", text: "Enter your name." });
    setBusy(true); const r = await api.updateProfile({ name: name.trim(), avatar: avatar || null, country: country || null }); setBusy(false);
    if (r.ok) { await refresh(); setMsg({ tone: "success", text: "Profile saved." }); } else setMsg({ tone: "error", text: r.error });
  };
  return <form className="settings-block" id="profile" onSubmit={save}><h2>Profile</h2>
    <Field label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
    <fieldset className="avatar-pick"><legend>Avatar</legend>
      {AVATARS.map((a) => <label key={a} className={avatar === a ? "on" : ""}><input type="radio" name="avatar" value={a} checked={avatar === a} onChange={() => setAvatar(a)} /><Avatar user={{ name, email: user.email, avatar: a }} size={40} /><span className="sr-only">{a}</span></label>)}
    </fieldset>
    <label className="field">Country<select name="country" value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Choose your country</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
    {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
  </form>;
}

function CurrencyForm({ user }: { user: SessionUser }) {
  const { refresh } = useAuth(); const { currency, currencies, setCurrency } = useCurrency();
  const [msg, setMsg] = useState<Msg>(null);
  const pick = async (code: string) => {
    const r = await api.setCurrency(code);
    if (r.ok) { setCurrency(code); await refresh(); setMsg({ tone: "success", text: "Currency saved." }); } else setMsg({ tone: "error", text: r.error });
  };
  return <div className="settings-block" id="currency"><h2>Currency</h2>
    <label className="field">Show prices in<select name="currency" value={user.currency ?? ""} onChange={(e) => pick(e.target.value)}>
      {!user.currency && <option value="">Automatic ({currency.code})</option>}
      {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
    </select></label>
    {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
  </div>;
}

function DealsForm({ user }: { user: SessionUser }) {
  const { refresh } = useAuth(); const [on, setOn] = useState(Boolean(user.marketingOptIn)); const [msg, setMsg] = useState<Msg>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); const r = await api.updateProfile({ marketingOptIn: on });
    if (r.ok) { await refresh(); setMsg({ tone: "success", text: on ? "You will get CoreCart deals by email." : "No deal emails. Order emails still arrive." }); } else setMsg({ tone: "error", text: r.error });
  };
  return <form className="settings-block" id="deals" onSubmit={save}><h2>Deal emails</h2>
    <label className="check"><input type="checkbox" name="deals" checked={on} onChange={(e) => setOn(e.target.checked)} /><span>Email me CoreCart deals and new releases (optional). Unsubscribe any time.</span></label>
    {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    <button className="btn btn-outline">{user.marketingChoiceAt ? "Update choice" : "Save choice"}</button>
  </form>;
}

function PasswordForm() {
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [msg, setMsg] = useState<Msg>(null); const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (next.length < 8) return setMsg({ tone: "error", text: "New password must be at least 8 characters." });
    setBusy(true); const r = await api.changePassword(cur, next); setBusy(false);
    if (r.ok) { setCur(""); setNext(""); setMsg({ tone: "success", text: "Password changed. Other devices were signed out." }); } else setMsg({ tone: "error", text: r.error });
  };
  return <form className="settings-block" id="password" onSubmit={save}><h2>Password</h2><Field label="Current password" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /><Field label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={next} onChange={(e) => setNext(e.target.value)} />{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}<button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button><small className="muted-note">Google-only accounts have no password here.</small></form>;
}

export default function SettingsPage() {
  return <AccountShell title="Settings">{(user) => <><ProfileForm user={user} /><CurrencyForm user={user} /><DealsForm user={user} /><PasswordForm /><div className="settings-block" id="email"><h2>Email</h2><p>{user.email} {user.emailVerified ? "· verified" : "· not verified"}</p></div></>}</AccountShell>;
}
