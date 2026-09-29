"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { COUNTRY_CODES } from "@/lib/currency/currencies";
import { countryName } from "@/lib/profile";
import { checkSeller, emptySellerInput, FILE_KINDS, firstBadStep, HEARD_FROM, ID_TYPES, PRODUCT_TYPES, SOURCES, STEPS, STOCK_SIZES, type FileKind, type MyApplication, type SellerErrors, type SellerFile, type SellerInput } from "@/lib/sellers";
import { Notice, PageShell } from "../../components/auth-ui";
import { useAuth } from "../../components/auth-provider";

// T3 seller application, 4 steps (Personal, Stock, Company, KYC). Next checks the step with the same rules as the API.
// Draft (answers + uploaded file list, never the ID number) stays in this browser until it is sent.
const DRAFT = "corecart-sell-draft";
type Draft = { input: SellerInput; files: SellerFile[]; step: number };

export default function SellApplyPage() {
  const { user } = useAuth(); const router = useRouter();
  const [input, setInput] = useState<SellerInput>(emptySellerInput); const [files, setFiles] = useState<SellerFile[]>([]); const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<SellerErrors>({}); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MyApplication | null>(null); const [existing, setExisting] = useState<MyApplication | null | undefined>(undefined);
  useEffect(() => { if (user === null) router.replace("/login?next=%2Fsell%2Fapply"); }, [user, router]);
  useEffect(() => {
    if (!user) return;
    api.sellerStatus().then((r) => setExisting(r.ok ? r.application : null));
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null") as Draft | null; if (d?.input) { setInput({ ...emptySellerInput(), ...d.input, idNumber: "", confirm: false }); setFiles(d.files ?? []); setStep(Math.min(3, d.step ?? 0)); } } catch { /* no draft */ }
  }, [user]);
  useEffect(() => { if (!done && existing !== undefined) try { localStorage.setItem(DRAFT, JSON.stringify({ input: { ...input, idNumber: "", confirm: false }, files, step } satisfies Draft)); } catch { /* storage blocked */ } }, [input, files, step, done, existing]);
  const set = <K extends keyof SellerInput>(k: K, v: SellerInput[K]) => { setInput((i) => ({ ...i, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const toggle = (k: "sources" | "productTypes", v: string) => set(k, input[k].includes(v) ? input[k].filter((x) => x !== v) : [...input[k], v]);
  const countries = useMemo(() => COUNTRY_CODES.map((c) => ({ c, n: countryName(c) })).sort((a, b) => a.n.localeCompare(b.n)), []);

  if (!user || existing === undefined) return <PageShell><p className="muted-note">Loading…</p></PageShell>;
  if (!user.emailVerified) return <PageShell narrow><section className="auth-card"><h1>Verify your email first</h1><p className="auth-sub">Open the link we sent to {user.email}, then come back.</p></section></PageShell>;
  const blocked = !done && existing && (existing.status === "pending" || existing.status === "approved");
  if (done || blocked) { const a = (done ?? existing)!; return <PageShell narrow><section className="auth-card sell-done" aria-label="Application sent">
    <h1>{done ? "Application sent" : a.status === "approved" ? "You are already a seller" : "Application under review"}</h1>
    <p className="auth-sub">Application <strong>{a.number}</strong> for {a.merchantName}. {a.status === "approved" ? "Seller tools come soon." : "We check it within 3 working days and email you."}</p>
    <Link className="btn btn-primary" href="/account">Go to my account</Link>
  </section></PageShell>; }

  const addFile = (f: SellerFile) => { setFiles((l) => [...l, f]); setInput((i) => ({ ...i, files: { ...i.files, [f.kind]: [...i.files[f.kind], f.id] } })); setErrors((e) => ({ ...e, invoices: undefined, keys: undefined, idFront: undefined, idBack: undefined })); };
  const removeFile = (f: SellerFile) => { setFiles((l) => l.filter((x) => x.id !== f.id)); setInput((i) => ({ ...i, files: { ...i.files, [f.kind]: i.files[f.kind].filter((x) => x !== f.id) } })); };
  const next = () => { const e = checkSeller(input, step); setErrors(e); setError(""); if (Object.keys(e).length) { setError("Check the highlighted fields."); return; } setStep(step + 1); window.scrollTo(0, 0); };
  const submit = async () => {
    const e = checkSeller(input); setErrors(e); setError("");
    if (Object.keys(e).length) { setStep(firstBadStep(e) ?? step); setError("Check the highlighted fields."); return; }
    setBusy(true); const r = await api.submitSeller(input); setBusy(false);
    if (r.ok) { setDone(r.application); try { localStorage.removeItem(DRAFT); } catch { /* storage blocked */ } window.scrollTo(0, 0); }
    else { setError(r.error); if (r.errors) { setErrors(r.errors); setStep(firstBadStep(r.errors) ?? step); } }
  };
  const err = (k: keyof SellerErrors) => errors[k] ? <small className="field-error" role="alert">{errors[k]}</small> : null;
  const text = (k: "firstName" | "lastName" | "merchantName" | "storeUrl" | "companyName" | "companyReg" | "companyTax" | "idNumber", label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    <label className={`field${errors[k] ? " has-error" : ""}`}><span>{label}</span><input name={k} value={input[k]} aria-invalid={Boolean(errors[k])} onChange={(e) => set(k, e.target.value)} {...extra} />{err(k)}</label>;
  const select = (k: "businessCountry" | "citizenship" | "stockSize" | "heardFrom", label: string, options: { v: string; l: string }[]) =>
    <label className={`field${errors[k] ? " has-error" : ""}`}><span>{label}</span><select name={k} value={input[k]} aria-invalid={Boolean(errors[k])} onChange={(e) => set(k, e.target.value)}><option value="">Choose…</option>{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>{err(k)}</label>;
  const checks = (k: "sources" | "productTypes", label: string, options: readonly string[]) =>
    <fieldset className={`sell-checks${errors[k] ? " has-error" : ""}`}><legend>{label}</legend><div>{options.map((o) => <label key={o} className="check"><input type="checkbox" checked={input[k].includes(o)} onChange={() => toggle(k, o)} /> {o}</label>)}</div>{err(k)}</fieldset>;
  const fileBox = (kind: FileKind, label: string, errKey: keyof SellerErrors | null, hint: string) =>
    <FileBox kind={kind} label={label} hint={hint} files={files.filter((f) => f.kind === kind && input.files[kind].includes(f.id))} onAdd={addFile} onRemove={removeFile} error={errKey ? errors[errKey] : undefined} />;

  return <PageShell>
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/sell">Sell on CoreCart</Link> <span aria-hidden="true">›</span> <span aria-current="page">Apply</span></nav>
    <h1 className="sell-title">Seller application</h1>
    <ol className="sell-steps" aria-label={`Step ${step + 1} of 4: ${STEPS[step]}`}>{STEPS.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "now" : ""} aria-current={i === step ? "step" : undefined}><span>{i < step ? "✓" : i + 1}</span>{s}</li>)}</ol>
    <p className="sell-step-mobile">Step {step + 1} of 4 · {STEPS[step]}</p>
    <form className="dash-card sell-form" onSubmit={(e) => { e.preventDefault(); if (step < 3) next(); else submit(); }} noValidate aria-label={`Step ${step + 1}: ${STEPS[step]}`}>
      {step === 0 && <>
        <h2>Personal details</h2>
        <div className="sell-grid">{text("firstName", "First name", { autoComplete: "given-name" })}{text("lastName", "Last name", { autoComplete: "family-name" })}</div>
        {text("merchantName", "Merchant name (shown to buyers)", { maxLength: 40 })}
        {text("storeUrl", "Store or website (optional)", { placeholder: "https://", inputMode: "url" })}
        <label className={`field${errors.profiles ? " has-error" : ""}`}><span>Marketplace profiles (optional, one link per line)</span><textarea name="profiles" rows={3} value={input.profiles} onChange={(e) => set("profiles", e.target.value)} placeholder="G2A, Kinguin, Eneba …" />{err("profiles")}</label>
        <label className={`field${errors.why ? " has-error" : ""}`}><span>Why do you want to sell on CoreCart?</span><textarea name="why" rows={4} maxLength={1000} value={input.why} onChange={(e) => set("why", e.target.value)} /><small>{input.why.trim().length} / 1000 (at least 20)</small>{err("why")}</label>
      </>}
      {step === 1 && <>
        <h2>Your stock</h2>
        {checks("sources", "Where do your keys come from?", SOURCES)}
        <div className="sell-grid">{select("businessCountry", "Business location", countries.map((c) => ({ v: c.c, l: c.n })))}{select("citizenship", "Citizenship", countries.map((c) => ({ v: c.c, l: c.n })))}</div>
        {select("stockSize", "How many codes do you have in stock?", STOCK_SIZES.map((v) => ({ v, l: v })))}
        {checks("productTypes", "What do you want to sell?", PRODUCT_TYPES)}
        {fileBox("invoice", "Sample invoices (1–5)", "invoices", "JPG, PNG, WebP or PDF, 5 MB each.")}
        {fileBox("key", "Photos of keys you hold (1–5)", "keys", "JPG, PNG or WebP, 5 MB each.")}
        {select("heardFrom", "How did you hear about us?", HEARD_FROM.map((v) => ({ v, l: v })))}
      </>}
      {step === 2 && <>
        <h2>Company</h2>
        <fieldset className="sell-yesno"><legend>Do you sell as a registered company?</legend>
          <label className="check"><input type="radio" name="isCompany" checked={input.isCompany} onChange={() => set("isCompany", true)} /> Yes</label>
          <label className="check"><input type="radio" name="isCompany" checked={!input.isCompany} onChange={() => set("isCompany", false)} /> No</label>
        </fieldset>
        {input.isCompany ? <>
          {text("companyName", "Company name")}
          <div className="sell-grid">{text("companyReg", "Registration number")}{text("companyTax", "Tax ID / VAT number")}</div>
          <label className={`field${errors.companyAddress ? " has-error" : ""}`}><span>Company address</span><textarea name="companyAddress" rows={3} value={input.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} />{err("companyAddress")}</label>
        </> : <p className="muted-note">You apply as a private business seller.</p>}
      </>}
      {step === 3 && <>
        <h2>ID check (KYC)</h2>
        <label className={`field${errors.idType ? " has-error" : ""}`}><span>ID type</span><select name="idType" value={input.idType} onChange={(e) => set("idType", e.target.value as SellerInput["idType"])}><option value="">Choose…</option>{ID_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>{err("idType")}</label>
        {text("idNumber", "ID number", { autoComplete: "off", maxLength: 40 })}
        {fileBox("id_front", "ID front", "idFront", "Photo, JPG / PNG / WebP, 5 MB.")}
        {input.idType !== "passport" && fileBox("id_back", "ID back", "idBack", "Photo, JPG / PNG / WebP, 5 MB.")}
        {fileBox("selfie", "Selfie holding your ID (optional)", null, "Helps us check faster.")}
        <p className="muted-note">ID images are private: only CoreCart staff who review sellers can see them. Every view is logged.</p>
        <label className={`check${errors.confirm ? " has-error" : ""}`}><input type="checkbox" name="confirm" checked={input.confirm} onChange={(e) => set("confirm", e.target.checked)} /> I confirm the details are true and CoreCart may check them.</label>{err("confirm")}
      </>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="sell-actions">
        {step > 0 && <button type="button" className="btn btn-outline" onClick={() => { setStep(step - 1); setError(""); }}>← Back</button>}
        <button className="btn btn-primary" disabled={busy}>{step < 3 ? "Next →" : busy ? "Sending…" : "Submit application"}</button>
      </div>
    </form>
  </PageShell>;
}

// One upload box: pick files → each is sent at once (checked by content on the server), listed with name + size + Remove.
function FileBox({ kind, label, hint, files, onAdd, onRemove, error }: { kind: FileKind; label: string; hint: string; files: SellerFile[]; onAdd: (f: SellerFile) => void; onRemove: (f: SellerFile) => void; error?: string }) {
  const max = FILE_KINDS.find((k) => k.id === kind)!.max; const pdf = FILE_KINDS.find((k) => k.id === kind)!.pdf;
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const pick = async (list: FileList | null) => {
    if (!list?.length) return; setMsg(""); setBusy(true);
    for (const f of Array.from(list).slice(0, max - files.length)) { const r = await api.uploadSellerFile(kind, f); if (r.ok) onAdd(r.file); else setMsg(`${f.name}: ${r.error}`); }
    if (list.length > max - files.length) setMsg(`Up to ${max} file${max === 1 ? "" : "s"} here.`);
    setBusy(false);
  };
  return <div className={`sell-file${error ? " has-error" : ""}`} role="group" aria-label={label}>
    <span className="sell-file-label">{label}</span><small>{hint}</small>
    {files.length > 0 && <ul>{files.map((f) => <li key={f.id}><span>{f.name}</span><small>{(f.size / 1024 / 1024).toFixed(2)} MB</small><button type="button" className="text-link as-link" onClick={() => onRemove(f)}>Remove<span className="sr-only"> {f.name}</span></button></li>)}</ul>}
    {files.length < max && <label className="btn btn-outline btn-sm sell-file-pick">{busy ? "Uploading…" : files.length ? "Add another file" : "Choose file"}
      <input type="file" className="sr-only" accept={pdf ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"} multiple={max > 1} disabled={busy} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} aria-label={`${label}: choose file`} />
    </label>}
    {msg && <small className="field-error" role="alert">{msg}</small>}
    {error && <small className="field-error" role="alert">{error}</small>}
  </div>;
}
