"use client";

import Link from "next/link";
import { AccountShell } from "../../components/account-shell";

// Placeholder until its Part 2 step is built (agents.md Handoff v8).
export default function Page() {
  return <AccountShell title="Keys library">{() => <div className="empty"><p>Search, filters and key reveal arrive in the next dashboard step. Your keys are in Orders until then.</p><Link className="text-link" href="/account/orders">Go to Orders</Link></div>}</AccountShell>;
}
