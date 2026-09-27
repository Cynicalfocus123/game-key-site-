"use client";

import Link from "next/link";
import { AccountShell } from "../../components/account-shell";

// Placeholder until Handoff v12 step 2c (favorites) is built. Header ♡ links here.
export default function Page() {
  return <AccountShell title="Favorites">{() => <div className="empty"><p>Saved games and parts arrive in the next step.</p><Link className="text-link" href="/">Browse today&apos;s deals</Link></div>}</AccountShell>;
}
