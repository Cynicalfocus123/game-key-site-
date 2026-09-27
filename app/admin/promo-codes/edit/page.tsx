"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { adminApi, money } from "@/lib/client/api";
import { checkPromoInput, cleanPromoCode, fromBkkInput, PROMO_CATEGORIES, promoSummary, randomPromoCode, toBkkInput, type PromoCode, type PromoErrors, type PromoInput } from "@/lib/promo";
import { AdminShell } from "../../../components/admin-shell";
import { Notice } from "../../../components/auth-ui";

// Create / edit promo code (Handoff v12 step 3b): option cards left, live Summary card right (bottom on mobile).
// Only code + discount value are required; every unchecked option = no limit. Dates are Bangkok time.
type Form = {
  code: string; type: "percent" | "fixed"; value: string; hasMax: boolean; maxDiscount: string; appliesTo: "all" | "categories"; categories: string[];
  minReq: "none" | "amount"; minAmount: string; limitUses: boolean; maxUses: string; oncePerCustomer: boolean; startsAt: string; hasEnd: boolean; endsAt: string; enabled: boolean;
};
const thb = (m: number) => money(m, "THB");
const baht = (satang: number | null) => (satang === null ? "" : String(satang / 100));
const satang = (s: string) => (s.trim() === "" ? NaN : /^\d+(\.\d{1,2})?$/.test(s.trim()) ? Math.round(Number(s) * 100) : NaN);
const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
const blank = (): Form => ({ code: "", type: "percent", value: "", hasMax: false, maxDiscount: "", appliesTo: "all", categories: [], minReq: "none", minAmount: "", limitUses: false, maxUses: "",
  oncePerCustomer: false, startsAt: toBkkInput(new Date().toISOString()), hasEnd: false, endsAt: "", enabled: true });
const fromPromo = (p: PromoCode): Form => ({ code: p.code, type: p.type, value: p.type === "percent" ? String(p.value) : baht(p.value), hasMax: p.maxDiscount !== null, maxDiscount: baht(p.maxDiscount),
  appliesTo: p.appliesTo, categories: p.categories, minReq: p.minSubtotal ? "amount" : "none", minAmount: baht(p.minSubtotal), limitUses: p.maxUses !== null, maxUses: p.maxUses === null ? "" : String(p.maxUses),
  oncePerCustomer: p.oncePerCustomer, startsAt: toBkkInput(p.startsAt), hasEnd: p.expiresAt !== null, endsAt: p.expiresAt ? toBkkInput(p.expiresAt) : "", enabled: p.enabled });
function toInput(f: Form): PromoInput {
  return { code: cleanPromoCode(f.code), type: f.type, value: f.type === "percent" ? int(f.value) : satang(f.value), maxDiscount: f.type === "percent" && f.hasMax ? satang(f.maxDiscount) : null,
    appliesTo: f.appliesTo, categories: f.appliesTo === "categories" ? f.categories : [], minSubtotal: f.minReq === "amount" ? satang(f.minAmount) : null,
    startsAt: fromBkkInput(f.startsAt) || "invalid", expiresAt: f.hasEnd ? fromBkkInput(f.endsAt) || "invalid" : null, maxUses: f.limitUses ? int(f.maxUses) : null, oncePerCustomer: f.oncePerCustomer, enabled: f.enabled };
}

const Err = ({ id, msg }: { id: string; msg?: string }) => (msg ? <p className="field-error" id={id} role="alert">{msg}</p> : null);

function Editor() {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null); const [form, setForm] = useState<Form | null>(null); const [initial, setInitial] = useState("");
  const [errors, setErrors] = useState<PromoErrors>({}); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search); const edit = q.get("id"); const from = q.get("from");
    const start = (f: Form) => { setForm(f); setInitial(JSON.stringify(f)); };
    if (!edit && !from) { start(blank()); return; }
    adminApi.promoCode((edit ?? from)!).then((r) => {
      if (!r.ok) { setError(r.error); return; }
      if (edit) { setId(edit); start(fromPromo(r.promo)); }
      else start({ ...fromPromo(r.promo), code: `${r.promo.code}-COPY`.slice(0, 32), startsAt: toBkkInput(new Date().toISOString()), enabled: true });
    });
  }, []);
  const dirty = form !== null && JSON.stringify(form) !== initial;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const input = useMemo(() => (form ? toInput(form) : null), [form]);
  const live = useMemo(() => (input ? checkPromoInput(input) : {}), [input]);
  const shown: PromoErrors = tried ? { ...live, ...errors } : errors;
  if (!form || !input) return error ? <Notice tone="error">{error}</Notice> : <p className="muted-note">Loading…</p>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm({ ...form, [k]: v }); if (errors[k as keyof PromoErrors]) setErrors({ ...errors, [k]: undefined }); };
  const toggleCat = (c: string) => set("categories", form.categories.includes(c) ? form.categories.filter((x) => x !== c) : [...form.categories, c]);
  const leave = (e?: React.MouseEvent) => { if (dirty && !window.confirm("Discard unsaved changes?")) { e?.preventDefault(); return false; } return true; };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setTried(true); setError("");
    if (Object.keys(live).length) { setError("Check the highlighted fields."); return; }
    setBusy(true); const r = await adminApi.savePromo(id, input); setBusy(false);
    if (!r.ok) { setErrors(r.errors ?? {}); setError(r.error); return; }
    setInitial(JSON.stringify(form)); router.push(`/admin/promo-codes?saved=${encodeURIComponent(`${r.promo.code} saved.`)}`);
  };
  const summary = promoSummary({ ...input, value: Number.isNaN(input.value) ? 0 : input.value, maxDiscount: Number.isNaN(input.maxDiscount) ? null : input.maxDiscount,
    minSubtotal: Number.isNaN(input.minSubtotal) ? null : input.minSubtotal, maxUses: Number.isNaN(input.maxUses) ? null : input.maxUses,
    startsAt: input.startsAt === "invalid" ? "" : input.startsAt, expiresAt: input.expiresAt === "invalid" ? null : input.expiresAt }, thb);
  const ok = !Object.keys(live).length;
  const aria = (k: keyof PromoErrors) => ({ "aria-invalid": shown[k] ? true : undefined, "aria-describedby": shown[k] ? `err-${k}` : undefined });

  return <form className="pc-editor" onSubmit={save} noValidate>
    <p className="adm-back"><Link className="text-link" href="/admin/promo-codes" onClick={leave}>‹ Promo codes</Link></p>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="pc-layout">
      <div className="pc-cards">
        <section className="adm-panel" aria-labelledby="c-code"><h2 id="c-code">Code</h2>
          <label className="field" htmlFor="pc-code">Promo code</label>
          <div className="pc-row"><input id="pc-code" name="code" className="pc-code-input" value={form.code} maxLength={32} autoComplete="off" spellCheck={false} placeholder="e.g. SAVE10"
            onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} {...aria("code")} />
            <button type="button" className="btn btn-outline" onClick={() => set("code", randomPromoCode())}>Generate</button></div>
          <small className="muted-note">Customers type this at the cart. Letters, numbers and dashes.</small><Err id="err-code" msg={shown.code} />
        </section>

        <section className="adm-panel" aria-labelledby="c-disc"><h2 id="c-disc">Discount</h2>
          <div className="seg pc-type" role="radiogroup" aria-label="Discount type">
            {(["percent", "fixed"] as const).map((t) => <button key={t} type="button" role="radio" aria-checked={form.type === t} aria-pressed={form.type === t} onClick={() => set("type", t)}>{t === "percent" ? "Percentage" : "Fixed amount"}</button>)}
          </div>
          <label className="field pc-value" htmlFor="pc-value">{form.type === "percent" ? "Percentage off" : "Amount off (THB)"}</label>
          <div className="pc-affix"><span aria-hidden="true">{form.type === "percent" ? "%" : "฿"}</span><input id="pc-value" name="value" inputMode="decimal" value={form.value} onChange={(e) => set("value", e.target.value)} {...aria("value")} /></div>
          <Err id="err-value" msg={shown.value} />
          {form.type === "percent" && <><label className="pc-check"><input type="checkbox" checked={form.hasMax} onChange={(e) => set("hasMax", e.target.checked)} /> Limit the discount to a maximum amount</label>
            {form.hasMax && <><div className="pc-affix pc-sub"><span aria-hidden="true">฿</span><input name="maxDiscount" aria-label="Maximum discount (THB)" inputMode="decimal" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} {...aria("maxDiscount")} /></div><Err id="err-maxDiscount" msg={shown.maxDiscount} /></>}</>}
        </section>

        <fieldset className="adm-panel"><legend>Applies to</legend>
          <label className="pc-check"><input type="radio" name="appliesTo" checked={form.appliesTo === "all"} onChange={() => set("appliesTo", "all")} /> All products</label>
          <label className="pc-check"><input type="radio" name="appliesTo" checked={form.appliesTo === "categories"} onChange={() => set("appliesTo", "categories")} /> Specific categories</label>
          {form.appliesTo === "categories" && <div className="pc-cats" {...aria("categories")}>{PROMO_CATEGORIES.map((c) => <div key={c.id}>
            <label className="pc-check"><input type="checkbox" checked={form.categories.includes(c.id)} onChange={() => toggleCat(c.id)} /> {c.label}</label>
            {c.subs && <div className="pc-subs"><small>Or only these platforms:</small>{c.subs.map((s) => <label key={s.id} className="pc-check"><input type="checkbox" disabled={form.categories.includes(c.id)} checked={form.categories.includes(c.id) || form.categories.includes(s.id)} onChange={() => toggleCat(s.id)} /> {s.label}</label>)}</div>}
          </div>)}</div>}
          <Err id="err-categories" msg={shown.categories} />
        </fieldset>

        <fieldset className="adm-panel"><legend>Minimum requirement</legend>
          <label className="pc-check"><input type="radio" name="minReq" checked={form.minReq === "none"} onChange={() => set("minReq", "none")} /> No minimum</label>
          <label className="pc-check"><input type="radio" name="minReq" checked={form.minReq === "amount"} onChange={() => set("minReq", "amount")} /> Minimum order amount</label>
          {form.minReq === "amount" && <><div className="pc-affix pc-sub"><span aria-hidden="true">฿</span><input name="minSubtotal" aria-label="Minimum order amount (THB)" inputMode="decimal" value={form.minAmount} onChange={(e) => set("minAmount", e.target.value)} {...aria("minSubtotal")} /></div>
            <small className="muted-note">Cart subtotal before the discount.</small><Err id="err-minSubtotal" msg={shown.minSubtotal} /></>}
        </fieldset>

        <fieldset className="adm-panel"><legend>Usage limits</legend>
          <label className="pc-check"><input type="checkbox" checked={form.limitUses} onChange={(e) => set("limitUses", e.target.checked)} /> Limit the total number of uses</label>
          {form.limitUses && <><input className="pc-sub pc-num" name="maxUses" aria-label="Total uses" inputMode="numeric" value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} {...aria("maxUses")} /><Err id="err-maxUses" msg={shown.maxUses} /></>}
          <label className="pc-check"><input type="checkbox" checked={form.oncePerCustomer} onChange={(e) => set("oncePerCustomer", e.target.checked)} /> One use per customer</label>
          <small className="muted-note">Uses are counted when real checkout arrives (payments step).</small>
        </fieldset>

        <fieldset className="adm-panel"><legend>Active dates</legend>
          <div className="pc-dates">
            <label className="field">Start (Bangkok time)<input type="datetime-local" name="startsAt" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} {...aria("dates")} /></label>
            {form.hasEnd && <label className="field">End (Bangkok time)<input type="datetime-local" name="endsAt" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} {...aria("dates")} /></label>}
          </div>
          <label className="pc-check"><input type="checkbox" checked={form.hasEnd} onChange={(e) => set("hasEnd", e.target.checked)} /> Set end date</label>
          <Err id="err-dates" msg={shown.dates} />
        </fieldset>
      </div>

      <aside className="adm-panel pc-summary" aria-labelledby="c-sum">
        <h2 id="c-sum">Summary</h2>
        <p className="pc-sum-code">{input.code || <span className="muted-note">No code yet</span>}</p>
        <ul aria-live="polite">{summary.map((s) => <li key={s}>{s}</li>)}</ul>
        <label className="pc-check"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Enabled</label>
        {tried && !ok && <p className="field-error">Fix the highlighted fields to save.</p>}
        <div className="pc-save"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Create promo code"}</button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { if (leave()) { setInitial(JSON.stringify(form)); router.push("/admin/promo-codes"); } }}>Discard</button></div>
        {dirty && <small className="muted-note">Unsaved changes</small>}
      </aside>
    </div>
  </form>;
}

export default function Page() {
  const [title, setTitle] = useState("Create promo code");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("id")) setTitle("Edit promo code"); }, []);
  return <AdminShell title={title}><Editor /></AdminShell>;
}
