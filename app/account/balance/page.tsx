"use client";

import Link from "next/link";
import { AccountShell } from "../../components/account-shell";

// Placeholder until its Part 2 step is built (agents.md Handoff v8).
export default function Page() {
  return <AccountShell title="Balance">{() => <div className="empty"><p>Wallet, gift card balance and redeem arrive in the next dashboard step.</p><Link className="text-link" href="/account/orders">Go to Orders</Link></div>}</AccountShell>;
}
