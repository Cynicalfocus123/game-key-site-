"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { ADDRESS_COUNTRIES, addressFields, checkAddress, sameAddress, type AddressErrors, type AddressKey, type BillingAddress } from "@/lib/address-formats";
import { countryName } from "@/lib/profile";
import { useAuth } from "./auth-provider";

// Billing address section (task 5, wireframe approved 2026-09-30). Country first; the fields, order, labels, required marks and postcode rule
// follow the country (lib/address-formats.ts, same checks on the server). User 2026-09-30: a new address is always saved to the account
// (automatically, a moment after the form is complete). onChange gets the complete address, or null while something is missing or wrong.
type Values = Partial<Record<AddressKey, string>>;
const SAVE_DELAY = 1200;

// onCountry = the chosen country at once (tax rate follows it before the address is complete).
export function BillingAddressForm({ onChange, onCountry, idPrefix = "ba" }: { onChange?: (a: BillingAddress | null) => void; onCountry?: (c: string) => void; idPrefix?: string }) {
  const { user } = useAuth();
  const [country, setCountry] = useState(""); const [values, setValues] = useState<Values>({}); const [touched, setTouched] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<BillingAddress | null>(null); const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">(""); const [serverError, setServerError] = useState(""); const [serverErrors, setServerErrors] = useState<AddressErrors>({});
  const countries = useMemo(() => ADDRESS_COUNTRIES.map((c) => ({ code: c, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name)), []);

  // Saved address first, else the account country (else Thailand, the store's country). Only the latest load applies: an older answer
  // arriving late (effect run twice, user refreshed) must not overwrite what the customer already chose or typed.
  useEffect(() => {
    if (user === undefined || loaded) return;
    let live = true;
    api.billingAddress().then((r) => {
      if (!live) return;
      const a = r.ok ? r.address : null;
      if (a) { setSaved(a); setCountry(a.country); const { country: _c, ...rest } = a; setValues(rest); }
      else setCountry(user?.country && ADDRESS_COUNTRIES.includes(user.country) ? user.country : "TH");
      setLoaded(true);
    });
    return () => { live = false; };
  }, [user, loaded]);

  const fields = useMemo(() => (country ? addressFields(country) : []), [country]);
  const check = useMemo(() => (country ? checkAddress({ country, ...values }) : null), [country, values]);
  const valid = check?.ok ? check.address : null;
  const errors: AddressErrors = check && !check.ok ? check.errors : {};
  const cb = useRef(onChange); cb.current = onChange;
  useEffect(() => { cb.current?.(valid); }, [valid]);
  const cc = useRef(onCountry); cc.current = onCountry;
  useEffect(() => { if (country) cc.current?.(country); }, [country]);

  // Always save a new complete address (debounced so typing does not save every letter).
  useEffect(() => {
    if (!loaded || !valid || sameAddress(valid, saved)) return;
    const t = setTimeout(async () => {
      setStatus("saving"); setServerError("");
      const r = await api.saveBillingAddress(valid);
      if (r.ok) { setSaved(r.address); setStatus("saved"); setServerErrors({}); }
      else { setStatus("error"); setServerError(r.error); setServerErrors(r.errors ?? {}); }
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [valid, saved, loaded]);

  const set = (k: AddressKey, v: string) => { setValues((x) => ({ ...x, [k]: v })); setStatus((s) => (s === "saved" ? "" : s)); setServerErrors({}); };
  const touch = (k: string) => setTouched((t) => (t.has(k) ? t : new Set(t).add(k)));
  if (!loaded) return <p className="muted-note">Loading billing address…</p>;

  return <fieldset className="ba" aria-describedby={`${idPrefix}-sub`}>
    <legend className="ba-h">Billing address</legend>
    <p className="ba-sub" id={`${idPrefix}-sub`}>The address your card is registered to. Fields marked <b className="ba-req">*</b> are required.</p>
    <div className="ba-grid">
      <label className="field ba-span-6"><span>Country <b className="ba-req" aria-hidden="true">*</b></span>
        <select name="country" autoComplete="country" value={country} required onChange={(e) => { setCountry(e.target.value); setStatus(""); }}>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
      {fields.map((fl) => { const id = `${idPrefix}-${fl.key}`; const err = (touched.has(fl.key) && errors[fl.key]) || serverErrors[fl.key];
        return <label key={`${country}-${fl.key}`} className={`field ba-span-${fl.span}`} htmlFor={id}>
          <span>{fl.label}{fl.required ? <> <b className="ba-req" aria-hidden="true">*</b></> : <small> (optional)</small>}</span>
          {fl.options ? <select id={id} name={fl.key} autoComplete={fl.auto} required={fl.required} aria-invalid={Boolean(err) || undefined} aria-describedby={err ? `${id}-err` : undefined}
              value={values[fl.key] ?? ""} onChange={(e) => { set(fl.key, e.target.value); touch(fl.key); }} onBlur={() => touch(fl.key)}>
              <option value="">Choose…</option>{fl.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input id={id} name={fl.key} autoComplete={fl.auto} required={fl.required} maxLength={100} placeholder={fl.example} aria-invalid={Boolean(err) || undefined} aria-describedby={err ? `${id}-err` : undefined}
              value={values[fl.key] ?? ""} onChange={(e) => set(fl.key, e.target.value)} onBlur={() => touch(fl.key)} />}
          {err && <small className="field-error" id={`${id}-err`} role="alert">{err}</small>}
        </label>; })}
    </div>
    <p className="ba-status" role="status" aria-live="polite">{status === "saving" ? "Saving to your account…" : status === "saved" ? "✓ Saved to your account" : status === "error" ? serverError : ""}</p>
  </fieldset>;
}
