"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { guideFor, type GameKey } from "@/lib/keys";
import { Cover } from "../../../components/account-shell";
import { useAuth } from "../../../components/auth-provider";

// Print as a gift (Handoff v8 C7): own page without header/footer, black-and-white friendly, optional To / From / message.
export default function PrintKeyPage() {
  const { user } = useAuth(); const router = useRouter();
  const [key, setKey] = useState<GameKey | null>(null); const [error, setError] = useState("");
  const [to, setTo] = useState(""); const [from, setFrom] = useState(""); const [msg, setMsg] = useState("");
  const id = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("id");
  useEffect(() => {
    if (user === null) { router.replace(`/login?next=${encodeURIComponent(`/account/keys/print?id=${id ?? ""}`)}`); return; }
    if (!user) return;
    if (!id) { setError("Key not found."); return; }
    api.getKey(id).then((r) => (r.ok ? setKey(r.key) : setError(r.error)));
  }, [user, id, router]);
  const guide = guideFor(key?.platform);
  const back = <Link className="text-link" href={key ? `/account/keys/view?id=${encodeURIComponent(key.id)}` : "/account/keys"}>‹ Back to key</Link>;

  return <main className="gift-page">
    <div className="gift-tools no-print">{back}<button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!key?.code}>Print</button></div>
    {error ? <p role="alert">{error}</p> : !key ? <p className="muted-note">Loading…</p> : !key.code ? <div className="gift-card"><p>Reveal the key first, then print it as a gift.</p>{back}</div> : <>
      <form className="gift-form no-print" onSubmit={(e) => e.preventDefault()} aria-label="Gift message">
        <label className="field"><span>To (optional)</span><input value={to} onChange={(e) => setTo(e.target.value)} maxLength={60} /></label>
        <label className="field"><span>From (optional)</span><input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={60} /></label>
        <label className="field gift-msg"><span>Message (optional)</span><textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} rows={3} /></label>
      </form>
      <article className="gift-card">
        <p className="gift-logo">core<span>cart</span></p>
        <h1>A gift for you</h1>
        {(to || from) && <p className="gift-names">{to && <>To <strong>{to}</strong></>}{to && from && " · "}{from && <>From <strong>{from}</strong></>}</p>}
        {msg && <p className="gift-note">{msg}</p>}
        <div className="gift-item"><Cover name={key.name} platform={key.platform} size={72} /><div><h2>{key.name}</h2><p>{[key.platform, key.region].filter(Boolean).join(" · ")}</p></div></div>
        <p className="gift-code-label">Your key</p>
        <p className="gift-code"><code>{key.code}</code></p>
        {guide && <><h3>How to activate on {guide.name}</h3><ol>{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol><p className="gift-small">More help: {guide.site}</p></>}
      </article>
    </>}
  </main>;
}
