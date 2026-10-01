"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { COUNTRY_CODES } from "@/lib/currency/currencies";
import { dialCode } from "@/lib/dial-codes";
import { countryName } from "@/lib/profile";
import { fileKind, formatsOf, mimeLabel, OFFER_TABS, type FileKind, type Offers, type OfferTab, type SellerFile } from "@/lib/sellers";

// Building blocks of /sell/apply (KYC redesign, Difmark / Eneba layout in CoreCart white / blue).
export const flag = (c: string) => (/^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map((x) => 127397 + x.charCodeAt(0))) : "");
export function useCountries() { return useMemo(() => COUNTRY_CODES.map((c) => ({ c, n: countryName(c) })).sort((a, b) => a.n.localeCompare(b.n)), []); }

export const Err = ({ msg, id }: { msg?: string; id?: string }) => (msg ? <small className="field-error" id={id} role="alert">{msg}</small> : null);
export function Text({ label, value, onChange, error, optional, ...rest }: { label: string; value: string; onChange: (v: string) => void; error?: string; optional?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return <label className={`field${error ? " has-error" : ""}`}><span>{label}{optional && <em> (optional)</em>}</span><input value={value} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} {...rest} /><Err msg={error} /></label>;
}
// The label sits next to the select (htmlFor), never around it: a wrapping label would put every option text into the field's name.
export function Select({ label, value, onChange, error, options, optional, placeholder = "Choose…" }: { label: string; value: string; onChange: (v: string) => void; error?: string; options: { v: string; l: string }[]; optional?: boolean; placeholder?: string }) {
  const id = useId();
  return <div className={`field${error ? " has-error" : ""}`}><label htmlFor={id}>{label}{optional && <em> (optional)</em>}</label><select id={id} value={value} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select><Err msg={error} /></div>;
}
export function CountrySelect(p: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const list = useCountries();
  return <Select {...p} placeholder="Select…" options={list.map(({ c, n }) => ({ v: c, l: `${flag(c)} ${n}` }))} />;
}
// Phone with country code: country (flag + dial code) + national number.
export function Phone({ label, country, phone, onCountry, onPhone, error }: { label: string; country: string; phone: string; onCountry: (v: string) => void; onPhone: (v: string) => void; error?: string }) {
  const list = useCountries();
  return <div className={`field kyc-phone${error ? " has-error" : ""}`} role="group" aria-label={label}><span>{label}</span>
    <div><select aria-label={`${label}: country code`} value={country} onChange={(e) => onCountry(e.target.value)}><option value="">Code</option>{list.map(({ c, n }) => <option key={c} value={c}>{flag(c)} {c} {dialCode(c)}{dialCode(c) ? "" : ` ${n}`}</option>)}</select>
      <input aria-label={`${label}: number`} inputMode="tel" autoComplete="tel-national" value={phone} aria-invalid={Boolean(error)} onChange={(e) => onPhone(e.target.value)} placeholder="Phone number" /></div><Err msg={error} /></div>;
}
export function Radios<T extends string>({ legend, name, value, options, onChange, error }: { legend: string; name: string; value: string; options: readonly { v: T; l: string }[]; onChange: (v: T) => void; error?: string }) {
  return <fieldset className={`sell-yesno${error ? " has-error" : ""}`}><legend>{legend}</legend>{options.map((o) => <label key={o.v} className="check"><input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} /> {o.l}</label>)}<Err msg={error} /></fieldset>;
}
export function Checks({ legend, value, options, onChange, error }: { legend: string; value: string[]; options: readonly string[]; onChange: (v: string[]) => void; error?: string }) {
  return <fieldset className={`sell-checks${error ? " has-error" : ""}`}><legend>{legend}</legend><div>{options.map((o) => <label key={o} className="check"><input type="checkbox" checked={value.includes(o)} onChange={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])} /> {o}</label>)}</div><Err msg={error} /></fieldset>;
}
export const Card = ({ n, title, children, info }: { n?: number; title: string; children: React.ReactNode; info?: string }) =>
  <section className="kyc-card" aria-label={title}><h2>{n !== undefined && <span className="kyc-num" aria-hidden="true">{n}</span>}{title}{info && <span className="kyc-info" title={info} aria-hidden="true">i</span>}</h2>{children}</section>;

// "Choose your offer type": 3 tabs, ticks stay when switching tabs; each tab shows how many are ticked.
export function OfferPicker({ offers, onChange, error }: { offers: Offers; onChange: (o: Offers) => void; error?: string }) {
  const [tab, setTab] = useState<OfferTab>("video"); const t = OFFER_TABS.find((x) => x.id === tab)!;
  const icon: Record<OfferTab, string> = { video: "🎮", online: "🌐", other: "📦" };
  return <div className={error ? "has-error" : ""}>
    <div className="kyc-tabs" role="tablist" aria-label="Offer type">{OFFER_TABS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}><i aria-hidden="true">{icon[x.id]}</i>{x.label}{offers[x.id].length > 0 && <small> ({offers[x.id].length})</small>}</button>)}</div>
    <div className="kyc-offers" role="tabpanel" aria-label={t.label}><p>List of offers that are available in {t.label}:</p>
      <div className="sell-checks"><div>{t.offers.map((o) => { const on = offers[tab].includes(o); return <label key={o} className="check"><input type="checkbox" checked={on} onChange={() => onChange({ ...offers, [tab]: on ? offers[tab].filter((x) => x !== o) : [...offers[tab], o] })} /> {o}</label>; })}</div></div></div>
    <Err msg={error} />
  </div>;
}

// Drag-and-drop upload box + requirements panel (screen 3). Each file is sent at once (checked by content on the server); rows show a
// preview (images picked in this visit), name, size, Replace (single-file boxes) and Remove. Selfie: JPEG / PNG / PDF; others + GIF.
export function FileDrop({ kind, title, rules = [], files, max: maxIn, onAdd, onRemove, error }: { kind: FileKind; title: string; rules?: string[]; files: SellerFile[]; max?: number; onAdd: (f: SellerFile) => void; onRemove: (id: string) => void; error?: string }) {
  const k = fileKind(kind)!; const max = maxIn ?? k.max;
  const [busy, setBusy] = useState(false); const [msgs, setMsgs] = useState<string[]>([]); const [over, setOver] = useState(false);
  const previews = useRef(new Map<string, string>()); const input = useRef<HTMLInputElement>(null); const replacing = useRef<string | null>(null);
  useEffect(() => () => { previews.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  const accept = k.types.join(",");
  const send = async (list: File[]) => {
    if (!list.length) return; setMsgs([]); setBusy(true); const out: string[] = [];
    const room = replacing.current ? 1 : max - files.length;
    for (const f of list.slice(0, room)) {
      const r = await api.uploadSellerFile(kind, f);
      if (r.ok) { if (f.type.startsWith("image/")) previews.current.set(r.file.id, URL.createObjectURL(f)); if (replacing.current) { onRemove(replacing.current); replacing.current = null; } onAdd(r.file); }
      else out.push(`✕ ${f.name}: ${r.error}`);
    }
    if (list.length > room) out.push(`Up to ${max} file${max === 1 ? "" : "s"} here.`);
    replacing.current = null; setMsgs(out); setBusy(false);
  };
  const full = files.length >= max;
  return <div className={`kyc-up${error ? " has-error" : ""}`} role="group" aria-label={title}>
    <div className="kyc-up-main">
      {!full && <div className={`kyc-drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); send(Array.from(e.dataTransfer.files)); }}>
        <span className="kyc-doc" aria-hidden="true" /><b>{title}</b>
        <span>Drag {max > 1 ? "files" : "a file"} here or <button type="button" className="as-link text-link" disabled={busy} onClick={() => input.current?.click()}>Browse</button>{max > 1 ? ` (up to ${max})` : ""}</span>
        {busy && <span className="kyc-busy" role="status"><i />Uploading…</span>}
      </div>}
      <input ref={input} type="file" className="sr-only" tabIndex={-1} accept={accept} multiple={max > 1} aria-label={`${title}: choose file`} onChange={(e) => { send(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      {files.length > 0 && <ul className="kyc-files">{files.map((f) => { const pv = previews.current.get(f.id); return <li key={f.id}>
        {pv ? <img className="kyc-thumb" src={pv} alt="" /> : <span className="kyc-thumb kyc-thumb-doc" aria-hidden="true">{mimeLabel(f.mime)}</span>}
        <span className="kyc-fname"><b>{f.name}</b><small>{mimeLabel(f.mime)} · {(f.size / 1024 / 1024).toFixed(1)} MB</small></span>
        <span className="kyc-facts">{max === 1 && <button type="button" className="as-link text-link" disabled={busy} onClick={() => { replacing.current = f.id; input.current?.click(); }}>Replace<span className="sr-only"> {f.name}</span></button>}
          <button type="button" className="as-link text-link" disabled={busy} onClick={() => onRemove(f.id)}>Remove<span className="sr-only"> {f.name}</span></button></span></li>; })}</ul>}
      {msgs.map((m) => <small key={m} className="field-error" role="alert">{m}</small>)}
      <Err msg={error} />
    </div>
    <div className="kyc-rules"><b>Requirements</b><span>{formatsOf(kind)}</span><span>Max 10 MB{max > 1 ? " each" : ""}</span>{rules.map((r) => <span key={r}>{r}</span>)}</div>
  </div>;
}
