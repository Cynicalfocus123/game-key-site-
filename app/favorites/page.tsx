"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../components/auth-provider";
import { FavoritesList } from "../components/favorites-list";
import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

// Guest favorites (step 5 known issue: the header ♡ asked guests to sign in). Saved in this browser; they join the account on sign-in.
export default function GuestFavoritesPage() {
  const { user } = useAuth(); const router = useRouter();
  useEffect(() => { if (user) router.replace("/account/favorites"); }, [user, router]);
  return <><SiteHeader /><main className="acct-main fav-guest">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Favorites</span></nav>
    <h1>Favorites</h1>
    <p className="muted-note">Saved in this browser. <Link className="text-link" href="/login?next=/account/favorites">Sign in</Link> to keep them on every device.</p>
    <FavoritesList />
  </main><SiteFooter /></>;
}
