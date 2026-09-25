"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, isDemo } from "@/lib/client/api";
import type { SiteConfig } from "@/lib/client/types";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";

export function DemoBanner() {
  if (!isDemo) return null;
  return <p className="demo-banner" role="note"><strong>Demo mode.</strong> This GitHub Pages preview has no server. Accounts, orders and cards stay in this browser only. Do not use a real password.</p>;
}

export function PageShell({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return <><SiteHeader /><main className={narrow ? "auth-main" : "acct-main"}><DemoBanner />{children}</main><SiteFooter /></>;
}

export function AuthCard({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return <section className="auth-card"><h1>{title}</h1>{sub && <p className="auth-sub">{sub}</p>}{children}</section>;
}

export function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="field"><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  return <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function DemoInbox({ link, label }: { link?: string; label: string }) {
  if (!link) return null;
  return <div className="demo-inbox"><strong>Demo inbox</strong><span>A real site emails this link. In demo mode it shows here.</span><a className="btn btn-primary" href={link}>{label}</a></div>;
}

export function useConfig() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  useEffect(() => { api.config().then(setConfig); }, []);
  return config;
}

export function GoogleButton({ label, callbackPath = "/account" }: { label: string; callbackPath?: string }) {
  const config = useConfig(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    const r = await api.signInGoogle(callbackPath);
    if (!r.ok) { setError(r.error); setBusy(false); return; }
    if (isDemo) window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${callbackPath}`;
  };
  const disabled = busy || config?.google === false;
  const devBuild = process.env.NODE_ENV !== "production";
  if (config?.google === false && !devBuild) return null;
  return <><button type="button" className="btn btn-google" onClick={go} disabled={disabled}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>{busy ? "Connecting…" : label}</button>{config?.google === false && devBuild && <small className="muted-note">Google login needs GOOGLE_CLIENT_ID in .env.local.</small>}{error && <Notice tone="error">{error}</Notice>}<Divider /></>;
}

export const Divider = () => <div className="auth-divider"><span>or</span></div>;
export const AuthLink = ({ href, children }: { href: string; children: React.ReactNode }) => <Link className="text-link" href={href}>{children}</Link>;
export const readQuery = (key: string) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(key));
