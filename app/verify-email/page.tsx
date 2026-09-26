"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { AuthCard, AuthLink, Notice, PageShell, readQuery, safeNext } from "../components/auth-ui";
import { useAuth } from "../components/auth-provider";

// Demo mode verifies here. Server mode verifies through /api/auth/verify-email and redirects to /account.
export default function VerifyEmailPage() {
  const router = useRouter(); const { refresh } = useAuth();
  const [state, setState] = useState<"working" | "error">("working"); const [error, setError] = useState("");
  useEffect(() => {
    const token = readQuery("token");
    if (!token) { setState("error"); setError("Verification link is missing its token."); return; }
    api.verifyEmail(token).then(async r => { if (!r.ok) { setState("error"); setError(r.error); return; } await refresh(); const next = readQuery("next"); router.replace(`${safeNext(next) ?? "/account"}?verified=1`); });
  }, [refresh, router]);
  return <PageShell narrow><AuthCard title={state === "working" ? "Verifying your email…" : "Verification failed"}>
    {state === "error" && <><Notice tone="error">{error}</Notice><p className="auth-foot"><AuthLink href="/login">Sign in to get a new link</AuthLink></p></>}
  </AuthCard></PageShell>;
}
