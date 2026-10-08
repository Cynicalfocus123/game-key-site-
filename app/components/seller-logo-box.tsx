"use client";

import { useRef, useState } from "react";
import { marketApi } from "@/lib/client/api";
import type { SellerHome } from "@/lib/marketplace";
import { bytesDataUrl, checkLogo, LOGO_ERRORS, LOGO_MAX_BYTES, LOGO_RULES_TEXT, LOGO_SIZES, type LogoInfo } from "@/lib/seller-logo";
import { Notice } from "./auth-ui";
import { SellerLogo } from "./market-ui";

// "Store profile" box on /seller (wireframe Claude outputs/wireframes/seller-logo-wireframe.png, user 2026-10-08): profile picture only,
// no banner. The file is checked as soon as it is picked (content, not the name): any problem = red text right next to the upload and
// Save off. Preview at the 3 real sizes (store page 96, seller card 56, offer row 40), fitted in the square frame. The API repeats the checks.
const LABEL: Record<number, string> = { 96: "Store page", 56: "Seller card", 40: "Offer row" };
export function StoreProfile({ home, setHome }: { home: SellerHome; setHome: (h: SellerHome) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; size: number; info: LogoInfo; dataUrl: string } | null>(null);
  const [fileName, setFileName] = useState(""); const [error, setError] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  const store = home.store; const shown = picked?.dataUrl ?? store.logo;
  const pick = async (f: File | undefined) => {
    setMsg(null); setPicked(null); setError(""); if (!f) { setFileName(""); return; }
    setFileName(f.name);
    if (f.size > LOGO_MAX_BYTES) { setError(LOGO_ERRORS.big); return; }
    const bytes = new Uint8Array(await f.arrayBuffer()); const c = checkLogo(bytes);
    if (!c.ok) { setError(c.error); return; }
    setPicked({ name: f.name, size: f.size, info: c.info, dataUrl: bytesDataUrl(bytes, c.info.type) });
  };
  const save = async () => {
    if (!picked || busy) return; setBusy(true); const r = await marketApi.saveLogo(picked.dataUrl); setBusy(false);
    if (!r.ok) { setError(r.error); return; } // server refused (same texts) → red next to the upload
    setHome({ ...home, store: r.store }); setPicked(null); setFileName(""); if (input.current) input.current.value = "";
    setMsg({ tone: "success", text: "✓ Logo saved. Buyers see it on your offers, seller card and store page." });
  };
  const remove = async () => {
    setBusy(true); const r = await marketApi.removeLogo(); setBusy(false); setConfirm(false);
    if (!r.ok) { setMsg({ tone: "error", text: r.error }); return; }
    setHome({ ...home, store: r.store }); setMsg({ tone: "success", text: "✓ Logo removed. Your store shows its first letter again." });
  };
  return <section className="sl-panel sl-profile" aria-labelledby="profile-h">
    <h2 id="profile-h">Store profile</h2>
    <p className="muted-note">Buyers see this on your offers, the seller card and your store page.</p>
    <div className="sl-profile-grid">
      <div>
        <p className="sl-profile-label" id="logo-label">Store logo</p>
        <div className="sl-upload">
          <button type="button" className="btn btn-outline" onClick={() => input.current?.click()} aria-describedby="logo-rules logo-check">Choose file…</button>
          <input ref={input} className="sr-only" type="file" accept=".webp,.avif,image/webp,image/avif" aria-labelledby="logo-label" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
          {fileName && <span className="sl-file">{picked ? `${picked.name} · ${Math.max(1, Math.round(picked.size / 1024))} KB · ${picked.info.width} × ${picked.info.height} px` : fileName}</span>}
        </div>
        <div id="logo-check" aria-live="polite">
          {error && <p className="sl-logo-error" role="alert">{error}</p>}
          {picked && <p className="sl-logo-ok">✓ Logo fits. Check the preview, then Save.</p>}
        </div>
        <p className="muted-note sl-rules" id="logo-rules">{LOGO_RULES_TEXT}</p>
      </div>
      <div>
        <p className="sl-profile-label">Preview (how buyers see it)</p>
        <div className="sl-previews">{LOGO_SIZES.map((n) => <figure key={n} data-size={n}><SellerLogo name={store.name} logo={shown} size={n} /><figcaption>{LABEL[n]} {n} px</figcaption></figure>)}</div>
      </div>
    </div>
    {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    {confirm ? <div className="sl-confirm" role="group" aria-label="Remove logo">
      <p>Remove your logo? Buyers will see the first letter of your store name instead.</p>
      <div className="sl-actions"><button type="button" className="btn btn-primary" onClick={remove} disabled={busy}>Remove logo</button><button type="button" className="btn btn-outline" onClick={() => setConfirm(false)}>Keep it</button></div>
    </div> : <div className="sl-actions">
      <button type="button" className="btn btn-primary" onClick={save} disabled={!picked || busy}>{busy ? "Saving…" : "Save profile"}</button>
      {store.logo && <button type="button" className="btn btn-outline" onClick={() => { setMsg(null); setConfirm(true); }} disabled={busy}>Remove logo</button>}
    </div>}
  </section>;
}
