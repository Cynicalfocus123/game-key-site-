"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, dateText } from "@/lib/client/api";
import { allGames } from "@/lib/catalog";
import { guideFor, maskedKey, type GameKey } from "@/lib/keys";
import { AccountShell, Cover } from "../../../components/account-shell";
import { Notice, readQuery } from "../../../components/auth-ui";

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

// Key detail (Handoff v8 C6): facts, masked key → Reveal key (ends refund window), copy, Activate on {platform}, Print as a gift, My library.
export default function KeyViewPage() {
  const [key, setKey] = useState<GameKey | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const code = useRef<HTMLElement>(null);
  useEffect(() => { const id = readQuery("id"); if (!id) { setError("Key not found."); return; } api.getKey(id).then((r) => (r.ok ? setKey(r.key) : setError(r.error))); }, []);
  const reveal = async () => { if (!key) return; setBusy(true); const r = await api.revealKey(key.id); setBusy(false); if (r.ok) setKey(r.key); else setError(r.error); };
  const guide = guideFor(key?.platform);
  const worksOn = guide?.worksOn ?? allGames().find((g) => g.name === key?.name)?.os ?? "See activation guide";
  const platformName = guide?.name ?? key?.platform ?? "the platform";

  return <AccountShell title={key?.name ?? "Your key"} crumb={key?.name ?? "Key"} parent={{ href: "/account/keys", label: "Keys library" }}>{() => <>
    {error && <><Notice tone="error">{error}</Notice><Link className="text-link" href="/account/keys">‹ Back to keys library</Link></>}
    {!key ? !error && <p className="muted-note">Loading…</p> : <div className="key-detail">
      <div className="key-cover"><Cover name={key.name} platform={key.platform} size={132} /></div>
      <div className="key-main">
        <dl className="key-facts">
          <div><dt>Region</dt><dd>{key.region ?? "Global"}</dd>{guide && <Link className="text-link" href={`/help/activate/${guide.slug}#region`}>Check region restrictions</Link>}</div>
          <div><dt>Platform</dt><dd>{key.platform ?? "—"}</dd>{guide && <Link className="text-link" href={`/help/activate/${guide.slug}`}>Activation guide</Link>}</div>
          <div><dt>Product type</dt><dd>Digital key <span className="tip" tabIndex={0} role="note" aria-label="A code you enter on the platform to add the game to your account. Nothing is shipped.">?<span className="tip-box" aria-hidden="true">A code you enter on the platform to add the game to your account. Nothing is shipped.</span></span></dd></div>
          <div><dt>Works on</dt><dd>{worksOn}</dd></div>
        </dl>

        <section className="key-panel" aria-labelledby="key-h">
          <h2 id="key-h">Your key</h2>
          {!key.revealedAt ? <>
            <div className="key-row"><code className="key-code masked" aria-label="Key hidden">{maskedKey}</code><button type="button" className="btn btn-primary" onClick={reveal} disabled={busy}>{busy ? "Revealing…" : "Reveal key"}</button></div>
            <p className="key-warn">Revealing the key ends the refund window.</p>
          </> : <>
            <div className="key-row"><code className="key-code" ref={code}>{key.code}</code><CopyButton text={key.code ?? ""} target={code} /></div>
            <div className="key-actions">
              {guide ? <a className="btn btn-primary" href={guide.url} target="_blank" rel="noopener noreferrer">Activate on {platformName} <span aria-hidden="true">↗</span></a>
                : <Link className="btn btn-primary" href="/help/activate">How to activate</Link>}
              <Link className="btn btn-outline" href={`/account/keys/print?id=${encodeURIComponent(key.id)}`}>Print as a gift</Link>
            </div>
            <p className="key-later">Don&apos;t want to use it now? You can always find the code in your library. <Link className="text-link" href="/account/keys">My library</Link></p>
            <p className="key-refund">Since it&apos;s a digital product and the key was displayed, you are not eligible for a refund unless the key is invalid or faulty.</p>
          </>}
        </section>

        <ul className="key-meta">
          <li>Sold by <strong>CoreCart</strong></li>
          <li>Order <Link className="text-link" href="/account/orders"><code>{key.orderNumber}</code></Link> · {dateText(key.createdAt)}</li>
          <li>{key.revealedAt ? <>Revealed {timeText(key.revealedAt)}</> : "Not revealed yet"}</li>
        </ul>
        <Link className="text-link key-report" href={`/account/tickets?new=1&key=${encodeURIComponent(key.id)}`}>Report a problem with this key</Link>
      </div>
    </div>}
  </>}</AccountShell>;
}
