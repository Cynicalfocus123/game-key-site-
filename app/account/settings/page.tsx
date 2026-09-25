"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { AccountShell } from "../../components/account-shell";
import { useAuth } from "../../components/auth-provider";
import { Field, Notice } from "../../components/auth-ui";

function NameForm({ initial }: { initial: string }) {
  const { refresh } = useAuth(); const [name, setName] = useState(initial); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const save = async (e: React.FormEvent) => { e.preventDefault(); if (!name.trim()) return; const r = await api.updateName(name); if (r.ok) { await refresh(); setMsg({ tone: "success", text: "Name updated." }); } else setMsg({ tone: "error", text: r.error }); };
  return <form className="settings-block" onSubmit={save}><h2>Profile</h2><Field label="Full name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}<button className="btn btn-primary">Save name</button></form>;
}

function PasswordForm() {
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (next.length < 8) return setMsg({ tone: "error", text: "New password must be at least 8 characters." });
    setBusy(true); const r = await api.changePassword(cur, next); setBusy(false);
    if (r.ok) { setCur(""); setNext(""); setMsg({ tone: "success", text: "Password changed. Other devices were signed out." }); } else setMsg({ tone: "error", text: r.error });
  };
  return <form className="settings-block" onSubmit={save}><h2>Password</h2><Field label="Current password" type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /><Field label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={next} onChange={e => setNext(e.target.value)} />{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}<button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button><small className="muted-note">Google-only accounts have no password here.</small></form>;
}

export default function SettingsPage() {
  return <AccountShell title="Settings">{user => <><NameForm initial={user.name} /><PasswordForm /><div className="settings-block"><h2>Email</h2><p>{user.email} {user.emailVerified ? "· verified" : "· not verified"}</p></div></>}</AccountShell>;
}
