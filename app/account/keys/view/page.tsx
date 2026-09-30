"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, dateText } from "@/lib/client/api";
import { type GameKey } from "@/lib/keys";
import { AccountShell, Cover } from "../../../components/account-shell";
import { Notice, readQuery } from "../../../components/auth-ui";
import { KeyFacts, keyHref, keyInfo } from "../../../components/key-facts";

const timeText = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Copy with a 2 s "Copied ✓" state. Falls back to selecting the text when the clipboard is blocked.
function CopyButton({ text, target }: { text: string; target: React.RefObject<HTMLElement | null> }) {
  const [done, setDone] = useState(false); const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { const r = document.createRange(); if (target.current) { r.selectNodeContents(target.current); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); } return; }
    setDone(true); clearTimeout(t.current); t.current = setTimeout(() => setDone(false), 2000);
  };
  return <button type="button" className={`btn btn-outline key-copy${done ? " is-done" : ""}`} onClick={copy} aria-live="polite">{done ? "Copied ✓" : "Copy"}</button>;
}

// Key detail (Handoff v8 C6): facts, key, copy, Activate on {platform}, Print as a gift, My library. Revealed keys only (task 8, user 2026-09-30):
// an unrevealed key goes to Get your product (/account/keys/get), the one place a key is revealed.
export default function KeyViewPage() {
  const [key, setKey] = useState<GameKey | null>(null); const [error, setError] = useState(""); const router = useRouter();
  const code = useRef<HTMLElement>(null);
  useEffect(() => { const id = readQuery("id"); if (!id) { setError("Key not found."); return; }
    api.getKey(id).then((r) => { if (!r.ok) setError(r.error); else if (!r.key.revealedAt) router.replace(keyHref(r.key)); else setKey(r.key); }); }, [router]);
  const { guide, platformName } = key ? keyInfo(key) : { guide: null, platformName: "" };

  return <AccountShell title={key?.name ?? "Your key"} crumb={key?.name ?? "Key"} parent={{ href: "/account/keys", label: "Keys library" }}>{() => <>
    {error && <><Notice tone="error">{error}</Notice><Link className="text-link" href="/account/keys">‹ Back to keys library</Link></>}
    {!key?.revealedAt ? !error && <p className="muted-note">Loading…</p> : <div className="key-detail">
      <div className="key-cover"><Cover name={key.name} platform={key.platform} size={132} /></div>
      <div className="key-main">
        <KeyFacts keyItem={key} />

        <section className="key-panel" aria-labelledby="key-h">
          <h2 id="key-h">Your key</h2>
          <div className="key-row"><code className="key-code" ref={code}>{key.code}</code><CopyButton text={key.code ?? ""} target={code} /></div>
          <div className="key-actions">
            {guide ? <a className="btn btn-primary" href={guide.url} target="_blank" rel="noopener noreferrer">Activate on {platformName} <span aria-hidden="true">↗</span></a>
              : <Link className="btn btn-primary" href="/help/activate">How to activate</Link>}
            <Link className="btn btn-outline" href={`/account/keys/print?id=${encodeURIComponent(key.id)}`}>Print as a gift</Link>
          </div>
          <p className="key-later">Don&apos;t want to use it now? You can always find the code in your library. <Link className="text-link" href="/account/keys">My library</Link></p>
          <p className="key-refund">Since it&apos;s a digital product and the key was displayed, you are not eligible for a refund unless the key is invalid or faulty.</p>
        </section>

        <ul className="key-meta">
          <li>Sold by <strong>CoreCart</strong></li>
          <li>Order <Link className="text-link" href="/account/orders"><code>{key.orderNumber}</code></Link> · {dateText(key.createdAt)}</li>
          <li>Revealed {timeText(key.revealedAt)}</li>
        </ul>
        <Link className="text-link key-report" href={`/account/tickets?new=1&key=${encodeURIComponent(key.id)}`}>Report a problem with this key</Link>
      </div>
    </div>}
  </>}</AccountShell>;
}
