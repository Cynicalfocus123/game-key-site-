"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminAuthShell } from "../../components/admin-shell";

// Admin accounts are never created from the website. They are made on the server with `npm run admin:create`.
// This old address only forwards to the admin sign-in page.
export default function AdminRegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/login"); }, [router]);
  return <AdminAuthShell><p className="muted-note">Redirecting to admin sign in…</p></AdminAuthShell>;
}
