"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addressFields } from "@/lib/address-formats";
import { api } from "@/lib/client/api";
import { checkSeller, COMPANY_TYPES, emptySellerInput, emptySupplier, emptyUbo, fileKindLabel, HEARD_FROM, ID_TYPES, lastStep, MAX_LINKS, MAX_PRODUCTS, MAX_SUPPLIERS, MAX_UBOS, needsBack, OPTIONAL_DOCS, PROOF_TYPES, PURCHASE_SOURCES, QUANTITIES, reapplyInput, SELL_ERRORS, SELLER_STATUS_LABEL,
  STEP_INTRO, STEP_LABEL, STEP_TITLE, stepsFor, STOCK_RANGES, SUPPLY_PRODUCTS, SUPPORTING_DOCS, fileKind, type Ceo, type MyApplication, type Rep, type SellerErrors, type SellerFile, type SellerInput, type SellerType, type StepId, type Supplier, type Ubo } from "@/lib/sellers";
import { Notice, PageShell } from "../../components/auth-ui";
import { useAuth } from "../../components/auth-provider";
import { Card, Checks, CountrySelect, FileDrop, OfferPicker, Phone, Radios, Select, Text } from "./kyc-ui";

// T3 seller application, KYC redesign (wireframe screens 1–9, 12; approved 2026-10-01 except Individual, built as drawn).
// Choose Individual or Business → steps (left progress list; phone: bar on top + "All steps") → Final step → Approving.
// Each Continue saves the step to the server draft (resume on any device); Continue stays grey until the step is complete (pressing it
// then shows what is missing). Save for later keeps unfinished answers. Send request needs the confirm + terms ticks.
type View = "type" | StepId | "sent";
const today = () => new Date().toISOString().slice(0, 10);

export default function SellApplyPage() {
  const { user } = useAuth(); const router = useRouter();
  const [input, setInput] = useState<SellerInput>(emptySellerInput); const [files, setFiles] = useState<SellerFile[]>([]); const [completed, setCompleted] = useState<StepId[]>([]);
  const [view, setView] = useState<View>("type"); const [pickType, setPickType] = useState<SellerType | "">("");
  const [errors, setErrors] = useState<SellerErrors>({}); const [show, setShow] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(""); const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<MyApplication | null | undefined>(undefined); const [sent, setSent] = useState<MyApplication | null>(null); const [allSteps, setAllSteps] = useState(false);
  useEffect(() => { if (user === null) router.replace("/login?next=%2Fsell%2Fapply"); }, [user, router]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const r = await api.sellerStatus(); if (!r.ok) { setError(r.error); setExisting(null); return; }
      if (r.draft) {
        const d = r.draft; setInput(d.input); setFiles(d.files); setCompleted(d.completed); setPickType(d.input.sellerType);
        const steps = d.input.sellerType ? stepsFor(d.input.sellerType) : []; setView(steps.length ? steps[Math.min(d.completed.length, steps.length - 1)]! : "type");
      } else if (r.application?.status === "rejected" && new URLSearchParams(location.search).get("again")) { // Apply again: old answers as a new draft
        const det = await api.sellerDetails(); if (det.ok && det.details) { const i = reapplyInput(det.details.answers); setInput(i); setPickType(i.sellerType); }
      }
      setExisting(r.application);
    })();
  }, [user]);

  if (!user || existing === undefined) return <PageShell><p className="muted-note">Loading…</p></PageShell>;
  if (!user.emailVerified) return <PageShell narrow><section className="auth-card"><h1>Verify your email first</h1><p className="auth-sub">Open the link we sent to {user.email}, then come back.</p></section></PageShell>;
  const blocked = existing && (existing.status === "pending" || existing.status === "approved") ? existing : null;
  const done = sent ?? blocked;
  const type = (done?.sellerType ?? input.sellerType) || pickType || "individual";
  const steps = stepsFor(type as SellerType);

  // ---- state helpers ----
  const clear = (...keys: string[]) => setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n; });
  const set = <K extends keyof SellerInput>(k: K, v: SellerInput[K]) => { setInput((i) => ({ ...i, [k]: v })); clear(k as string); setSaved(""); };
  const setRep = <K extends keyof Rep>(k: K, v: Rep[K]) => { setInput((i) => ({ ...i, rep: { ...i.rep, [k]: v } })); clear(`rep.${k === "phoneCountry" ? "phone" : k}`); };
  const setCeo = <K extends keyof Ceo>(k: K, v: Ceo[K]) => { setInput((i) => ({ ...i, ceo: { ...i.ceo, [k]: v } })); clear(`ceo.${k === "phoneCountry" ? "phone" : k}`); };
  const setUbo = (n: number, k: keyof Ubo, v: string) => { setInput((i) => ({ ...i, ubos: i.ubos.map((u, j) => (j === n ? { ...u, [k]: v } : u)) })); clear(`ubos.${n}.${k}`); };
  const setSup = <K extends keyof Supplier>(n: number, k: K, v: Supplier[K]) => { setInput((i) => ({ ...i, suppliers: i.suppliers.map((s, j) => (j === n ? { ...s, [k]: v } : s)) })); clear(`suppliers.${n}.${k}`); };
  const e = (k: string) => (show ? errors[k] : undefined);
  const fileOf = (ids: string[]) => ids.map((id) => files.find((f) => f.id === id)).filter((f): f is SellerFile => Boolean(f));
  const addKind = (k: keyof SellerInput["files"]) => (f: SellerFile) => { setFiles((l) => [...l, f]); setInput((i) => ({ ...i, files: { ...i.files, [k]: [...i.files[k], f.id] } })); clear(k, "idFront", "idBack", "selfie", "invoices"); };
  const rmKind = (k: keyof SellerInput["files"]) => (id: string) => setInput((i) => ({ ...i, files: { ...i.files, [k]: i.files[k].filter((x) => x !== id) } }));
  const drop = (k: keyof SellerInput["files"], title: string, err: string, rules?: string[]) => <FileDrop kind={k} title={title} rules={rules} files={fileOf(input.files[k])} onAdd={addKind(k)} onRemove={rmKind(k)} error={e(err)} />;

  // ---- navigation ----
  const step = view !== "type" && view !== "sent" ? view : null;
  const isLast = step !== null && step === lastStep(type as SellerType);
  const stepErrors = step ? checkSeller(input, step, isLast) : {};
  const ready = step !== null && !Object.keys(stepErrors).length;
  const go = (v: View) => { setView(v); setShow(false); setError(""); setSaved(""); window.scrollTo(0, 0); };
  const save = async (asStep: StepId | null) => {
    setBusy(true); setError(""); setSaved(""); const r = await api.saveSellerDraft(input, asStep); setBusy(false);
    if (!r.ok) { setError(r.error); if (r.errors) { setErrors(r.errors); setShow(true); } return false; }
    setCompleted(r.draft.completed); setInput((i) => ({ ...r.draft.input, idNumber: i.idNumber, confirm: i.confirm, terms: i.terms })); setFiles((l) => [...l.filter((f) => !r.draft.files.some((x) => x.id === f.id)), ...r.draft.files]);
    return true;
  };
  const chooseType = async () => {
    if (!pickType) { setError(SELL_ERRORS.type); return; }
    const next = { ...input, sellerType: pickType }; setInput(next);
    setBusy(true); const r = await api.saveSellerDraft(next, null); setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setCompleted(r.draft.completed); go(stepsFor(pickType)[Math.min(r.draft.completed.length, stepsFor(pickType).length - 1)]!);
  };
  const cont = async () => {
    if (!step) return;
    if (!ready) { setErrors(stepErrors); setShow(true); setError("Fill in the highlighted fields."); return; }
    if (!(await save(step))) return;
    if (!isLast) { go(steps[steps.indexOf(step) + 1]!); return; }
    setBusy(true); const r = await api.submitSeller(input); setBusy(false);
    if (r.ok) { setSent(r.application); go("sent"); }
    else { setError(r.error); if (r.errors) { setErrors(r.errors); setShow(true); } }
  };
  const back = () => { if (!step) return; const n = steps.indexOf(step); if (n > 0) go(steps[n - 1]!); else go("type"); };
  const later = async () => { if (await save(null)) setSaved("Saved. You can finish later from your dashboard."); };

  // ---- progress list (left; phone: bar on top + All steps) ----
  const doneSet = new Set<string>(done ? steps : completed);
  const nDone = done ? steps.length : completed.length;
  const total = steps.length + 2;
  const progress = <nav className={`kyc-prog${allSteps ? " open" : ""}`} aria-label="Progress">
    <h2>Progress ({Math.min(nDone + (done ? 1 : 0), total)}/{total})</h2>
    <ol>{[...steps, "final", "approving"].map((s, n) => {
      const isStep = s !== "final" && s !== "approving";
      const state = isStep ? (doneSet.has(s) ? "done" : view === s ? "now" : "") : s === "final" ? (done ? "done" : "") : done ? (done.status === "approved" ? "done" : "wait") : "";
      const label = isStep ? STEP_LABEL[s as StepId] : s === "final" ? "Final step" : "Approving";
      const badge = state === "done" ? (s === "approving" ? "Approved" : "Completed") : state === "now" ? "In progress" : state === "wait" ? "Waiting for admin" : isStep ? "Not started" : "";
      const canOpen = isStep && !done && (doneSet.has(s) || n <= completed.length);
      return <li key={s} className={state}>{canOpen && view !== s ? <button type="button" className="kyc-st" onClick={() => { setAllSteps(false); go(s as StepId); }}><span className="kyc-ic" aria-hidden="true">{state === "done" ? "✓" : n + 1}</span><span><b>{label}</b>{badge && <small className={`kyc-badge b-${state || "grey"}`}>{badge}</small>}</span></button>
        : <div className="kyc-st" aria-current={view === s ? "step" : undefined}><span className="kyc-ic" aria-hidden="true">{state === "done" ? "✓" : n + 1}</span><span><b>{label}</b>{badge && <small className={`kyc-badge b-${state || "grey"}`}>{badge}</small>}</span></div>}</li>;
    })}</ol>
    {!done && input.sellerType && <button type="button" className="as-link text-link kyc-change" onClick={() => go("type")}>Change seller type</button>}
  </nav>;
  const curIndex = step ? steps.indexOf(step) : done ? steps.length : 0;
  const mobileBar = <div className="kyc-mbar"><span><b>Progress ({nDone}/{total})</b> · {done ? "Final step" : step ? `Step ${curIndex + 1} of ${steps.length} · ${STEP_LABEL[step]}` : "Seller type"}</span>
    <button type="button" className="as-link text-link" aria-expanded={allSteps} onClick={() => setAllSteps((x) => !x)}>All steps {allSteps ? "▴" : "▾"}</button>
    <div className="seller-bar"><i style={{ width: `${Math.round((nDone / total) * 100)}%` }} /></div></div>;

  const crumbs = <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/sell">Sell on CoreCart</Link> <span aria-hidden="true">›</span> <span aria-current="page">Apply</span></nav>;

  // ---- 1. seller type ----
  if (view === "type" && !done) return <PageShell>{crumbs}
    <h1 className="sell-title">Become a seller</h1><p className="kyc-sub">Choose how you sell. You can switch until you send the request.</p>
    {existing?.status === "rejected" && <Notice>Your earlier application {existing.number} was not approved{existing.reason ? `: “${existing.reason}”` : ""}. {input.merchantName ? "Your earlier answers are filled in." : <Link className="text-link" href="/sell/apply?again=1">Fill in my earlier answers</Link>}</Notice>}
    <div className="kyc-choice" role="radiogroup" aria-label="Seller type">
      {([["individual", "Personal seller", "You sell as a private person.", ["3 steps · about 10 minutes", "ID or passport + selfie"]], ["business", "Business seller", "You sell for a registered company.", ["5 steps · about 25 minutes", "Company papers + representative ID + selfie"]]] as const).map(([id, t, d, li]) =>
        <label key={id} className={`kyc-ch${pickType === id ? " on" : ""}`}><span className="check"><input type="radio" name="sellerType" checked={pickType === id} onChange={() => { setPickType(id); setError(""); }} /> {id === "individual" ? "Individual" : "Business"}</span><b>{t}</b>{d}<ul>{li.map((x) => <li key={x}>{x}</li>)}</ul></label>)}
    </div>
    {input.sellerType && pickType && pickType !== input.sellerType && <Notice>Switching type keeps the answers both types share (merchant name, country, ID, offers). Steps of the other type count again only after Continue.</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="sell-actions kyc-type-actions"><Link className="btn btn-outline" href="/account">Back to dashboard</Link><button type="button" className={`btn btn-go${pickType ? "" : " off"}`} disabled={busy} onClick={chooseType}>{busy ? "Saving…" : "Continue"}</button></div>
  </PageShell>;

  // ---- Final step / Approving ----
  if (done) return <PageShell>{crumbs}
    <h1 className="sell-title">{STEP_TITLE[type as SellerType]}</h1><p className="kyc-sub">{STEP_INTRO[type as SellerType]}</p>
    <div className="kyc">{mobileBar}{progress}
      <section className="kyc-card kyc-sent" aria-label={sent ? "Request sent" : "Application status"}><div className="kyc-art" aria-hidden="true">✓</div>
        <h2>{done.status === "approved" ? `Your ${type === "business" ? "business " : ""}seller account is active` : "Your request has been sent"}</h2>
        <p>{done.status === "approved" ? <>Request <b>{done.number}</b> was approved. Seller tools come soon.</> : <>{type === "business" ? "Congratulations on submitting your business verification! " : "Congratulations! "}Request <b>{done.number}</b>{type === "business" && input.companyName ? <> for <b>{input.companyName}</b></> : ""} is with our team. No further action needed from you.</>}</p>
        {done.status !== "approved" && <div className="kyc-blue"><p>● We are reviewing your request; it will be processed within <b>1–3 business days</b>.</p><p>● After the review you will receive a response from the website administration by email{type === "business" ? " (to the account email and the representative email)" : ""}.</p><p>Status: <span className="chip chip-amber">{SELLER_STATUS_LABEL.pending}</span></p></div>}
        <div className="kyc-sent-btns"><Link className="btn btn-outline" href="/account">Go to dashboard</Link><Link className="btn btn-go" href="/sell/details">Go to details</Link></div>
      </section></div>
  </PageShell>;

  // ---- steps ----
  const countryRegion = addressFields(input.businessCountry || "US").find((f) => f.key === "region");
  const idCard = (n: number, who: string) => <>
    <Card n={n} title={`Identity document${who}`} info="Passport, ID card, residence card or driving licence. All 4 corners visible, text readable, no glare.">
      <div className="sell-grid">
        <Select label="Document type" value={input.idType} onChange={(v) => { set("idType", v as SellerInput["idType"]); clear("idBack"); }} error={e("idType")} options={ID_TYPES.map((t) => ({ v: t.id, l: t.label }))} />
        <Text label="Document number" value={input.idNumber} onChange={(v) => set("idNumber", v)} error={e("idNumber")} autoComplete="off" maxLength={40} />
      </div>
      {input.idType && <>
        {drop("id_front", ID_TYPES.find((t) => t.id === input.idType)!.front, "idFront", ["All 4 corners visible", "Text readable, no glare"])}
        {needsBack(input.idType) && drop("id_back", ID_TYPES.find((t) => t.id === input.idType)!.back!, "idBack", ["All 4 corners visible"])}
      </>}
      {!input.idType && show && <small className="field-error">{e("idFront")}</small>}
    </Card>
    <Card n={n + 1} title="Upload selfie with the document" info="A photo of you holding the same document next to your face.">
      {drop("selfie", "Selfie holding the same document", "selfie", ["Face + document visible"])}
    </Card>
  </>;
  const ticks = <Card title="Confirm and send">
    <label className={`check${e("confirm") ? " has-error" : ""}`}><input type="checkbox" checked={input.confirm} onChange={(x) => set("confirm", x.target.checked)} /> I confirm the details are true and CoreCart may check them. *</label>{e("confirm") && <small className="field-error" role="alert">{e("confirm")}</small>}
    <label className={`check${e("terms") ? " has-error" : ""}`}><input type="checkbox" checked={input.terms} onChange={(x) => set("terms", x.target.checked)} /> <span>I agree to the <Link className="text-link" href="/terms" target="_blank">terms and conditions</Link>. *</span></label>{e("terms") && <small className="field-error" role="alert">{e("terms")}</small>}
  </Card>;

  let body: React.ReactNode = null;
  if (step === "basic" && type === "individual") body = <Card n={1} title="Your details" info="Shown to the CoreCart team only, except the merchant name (shown to buyers).">
    <div className="sell-grid">
      <Text label="First name" value={input.firstName} onChange={(v) => set("firstName", v)} error={e("firstName")} autoComplete="given-name" />
      <Text label="Last name" value={input.lastName} onChange={(v) => set("lastName", v)} error={e("lastName")} autoComplete="family-name" />
      <Text label="Merchant name (shown to buyers)" value={input.merchantName} onChange={(v) => set("merchantName", v)} error={e("merchantName")} maxLength={40} />
      <Text label="Store / website" optional value={input.storeUrl} onChange={(v) => set("storeUrl", v)} error={e("storeUrl")} placeholder="https://" inputMode="url" />
      <CountrySelect label="Country of residence" value={input.businessCountry} onChange={(v) => set("businessCountry", v)} error={e("businessCountry")} />
      <CountrySelect label="Citizenship" value={input.citizenship} onChange={(v) => set("citizenship", v)} error={e("citizenship")} />
      <Select label="How did you hear about us?" value={input.heardFrom} onChange={(v) => set("heardFrom", v)} error={e("heardFrom")} options={HEARD_FROM.map((v) => ({ v, l: v }))} />
    </div></Card>;
  if (step === "proofs") body = <>
    <Card n={1} title="Choose your offer type" info="Tick everything you sell. Ticks stay when you switch tabs."><OfferPicker offers={input.offers} onChange={(o) => set("offers", o)} error={e("offers")} /></Card>
    {idCard(2, "")}
  </>;
  if (step === "product") body = <>
    <Card n={1} title="Write the description">
      <Radios legend="Where do you purchase your products?" name="purchaseSource" value={input.purchaseSource} options={PURCHASE_SOURCES.map((p) => ({ v: p.id, l: p.label }))} onChange={(v) => set("purchaseSource", v)} error={e("purchaseSource")} />
      {drop("invoice", "Invoice / Agreement", "invoices")}
      <label className={`field${e("procurement") ? " has-error" : ""}`}><span>Product procurement source</span><textarea rows={4} maxLength={2000} value={input.procurement} placeholder="Where do your keys come from? Name the suppliers / publishers …" onChange={(x) => set("procurement", x.target.value)} /><small>{input.procurement.trim().length} / 2000 (at least 20)</small>{e("procurement") && <small className="field-error" role="alert">{e("procurement")}</small>}</label>
      <Radios legend="How many products do you have in stock?" name="stockRange" value={input.stockRange} options={STOCK_RANGES.map((v) => ({ v, l: v }))} onChange={(v) => set("stockRange", v)} error={e("stockRange")} />
      <Radios legend="Do you sell on other platforms?" name="otherPlatforms" value={input.otherPlatforms} options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }] as const} onChange={(v) => set("otherPlatforms", v)} error={e("otherPlatforms")} />
      {input.otherPlatforms === "yes" && <label className={`field${e("profiles") ? " has-error" : ""}`}><span>Provide a link to your profiles (one per line)</span><textarea rows={3} value={input.profiles} placeholder="https://www.g2a.com/…" onChange={(x) => set("profiles", x.target.value)} />{e("profiles") && <small className="field-error" role="alert">{e("profiles")}</small>}</label>}
    </Card>{ticks}</>;
  if (step === "basic" && type === "business") body = <Card n={1} title="Company details" info="As written on your company registration.">
    <div className="sell-grid">
      <Text label="Company name" value={input.companyName} onChange={(v) => set("companyName", v)} error={e("companyName")} autoComplete="organization" />
      <Text label="Merchant name (shown to buyers)" value={input.merchantName} onChange={(v) => set("merchantName", v)} error={e("merchantName")} maxLength={40} />
      <Text label="Registration number" value={input.companyReg} onChange={(v) => set("companyReg", v)} error={e("companyReg")} />
      <Text label="Registration (place / type)" value={input.companyRegPlace} onChange={(v) => set("companyRegPlace", v)} error={e("companyRegPlace")} placeholder="e.g. Bangkok · Co., Ltd." />
      <Text label="Tax ID / VAT" optional value={input.companyTax} onChange={(v) => set("companyTax", v)} error={e("companyTax")} />
      <CountrySelect label="Country" value={input.businessCountry} onChange={(v) => { set("businessCountry", v); set("state", ""); }} error={e("businessCountry")} />
      <Text label="Address 1" value={input.address1} onChange={(v) => set("address1", v)} error={e("address1")} autoComplete="address-line1" />
      <Text label="Address 2" optional value={input.address2} onChange={(v) => set("address2", v)} autoComplete="address-line2" />
    </div>
    <div className="sell-grid3">
      {countryRegion?.options ? <Select label="State / province" value={input.state} onChange={(v) => set("state", v)} error={e("state")} options={countryRegion.options.map((o) => ({ v: o.value, l: o.label }))} optional={!countryRegion.required} />
        : <Text label="State / province" value={input.state} onChange={(v) => set("state", v)} error={e("state")} optional={!countryRegion?.required} />}
      <Text label="Postal code" value={input.postalCode} onChange={(v) => set("postalCode", v)} error={e("postalCode")} autoComplete="postal-code" />
      <Text label="City" value={input.city} onChange={(v) => set("city", v)} error={e("city")} autoComplete="address-level2" />
    </div></Card>;
  if (step === "documents") body = <>
    <Card n={1} title="Company documentation" info="The official certificate of incorporation.">{drop("certificate", "Certificate of Incorporation", "certificate")}</Card>
    <Card n={2} title="Supporting business documents"><Docs input={input} fileOf={fileOf} addKind={addKind} rmKind={rmKind} e={e} /></Card>
  </>;
  if (step === "representative") body = <>
    <Card n={1} title="Representative" info="The person acting for the company.">
      <p className="kyc-note-muted">The person acting for the company.</p>
      <div className="sell-grid">
        <Text label="Full name" value={input.rep.fullName} onChange={(v) => setRep("fullName", v)} error={e("rep.fullName")} autoComplete="name" />
        <Text label="Date of birth" type="date" max={today()} value={input.rep.dob} onChange={(v) => setRep("dob", v)} error={e("rep.dob")} />
        <Text label="Email address" type="email" value={input.rep.email} onChange={(v) => setRep("email", v)} error={e("rep.email")} autoComplete="email" />
        <Phone label="Phone number" country={input.rep.phoneCountry} phone={input.rep.phone} onCountry={(v) => setRep("phoneCountry", v)} onPhone={(v) => setRep("phone", v)} error={e("rep.phone")} />
        <Text label="Basis of representation" value={input.rep.basis} onChange={(v) => setRep("basis", v)} error={e("rep.basis")} placeholder="e.g. CEO, Director, power of attorney" />
        <CountrySelect label="Citizenship" value={input.rep.citizenship} onChange={(v) => setRep("citizenship", v)} error={e("rep.citizenship")} />
      </div></Card>
    <Card n={2} title="CEO information">
      <label className="check"><input type="checkbox" checked={input.ceoSame} onChange={(x) => set("ceoSame", x.target.checked)} /> CEO information and representative details are the same</label>
      {!input.ceoSame && <div className="sell-grid">
        <Text label="Full name" value={input.ceo.fullName} onChange={(v) => setCeo("fullName", v)} error={e("ceo.fullName")} />
        <Text label="Date of birth" type="date" max={today()} value={input.ceo.dob} onChange={(v) => setCeo("dob", v)} error={e("ceo.dob")} />
        <Text label="Email address" type="email" value={input.ceo.email} onChange={(v) => setCeo("email", v)} error={e("ceo.email")} />
        <Phone label="Phone number" country={input.ceo.phoneCountry} phone={input.ceo.phone} onCountry={(v) => setCeo("phoneCountry", v)} onPhone={(v) => setCeo("phone", v)} error={e("ceo.phone")} />
        <CountrySelect label="Country" value={input.ceo.country} onChange={(v) => setCeo("country", v)} error={e("ceo.country")} />
        <Text label="Address" value={input.ceo.address} onChange={(v) => setCeo("address", v)} error={e("ceo.address")} />
        <Text label="City" value={input.ceo.city} onChange={(v) => setCeo("city", v)} error={e("ceo.city")} />
        <Text label="ZIP code" value={input.ceo.zip} onChange={(v) => setCeo("zip", v)} error={e("ceo.zip")} />
      </div>}
    </Card>
    <Card n={3} title="UBO information" info="Ultimate Beneficial Owners: people who own or control the company.">
      <p className="kyc-note-muted">List all UBOs (Ultimate Beneficial Owners) of the company. If there is more than 1 UBO, list all shareholders with 25% or more shares.</p>
      {input.ubos.map((u, n) => <fieldset key={n} className="kyc-sub-card"><legend>UBO {n + 1}</legend>
        {input.ubos.length > 1 && <button type="button" className="as-link text-link kyc-remove" onClick={() => set("ubos", input.ubos.filter((_, j) => j !== n))}>Remove<span className="sr-only"> UBO {n + 1}</span></button>}
        <div className="sell-grid">
          <Text label="Full name" value={u.fullName} onChange={(v) => setUbo(n, "fullName", v)} error={e(`ubos.${n}.fullName`)} />
          <Text label="Date of birth" type="date" max={today()} value={u.dob} onChange={(v) => setUbo(n, "dob", v)} error={e(`ubos.${n}.dob`)} />
          <CountrySelect label="Country" value={u.country} onChange={(v) => setUbo(n, "country", v)} error={e(`ubos.${n}.country`)} />
          <Text label="Address" value={u.address} onChange={(v) => setUbo(n, "address", v)} error={e(`ubos.${n}.address`)} />
          <Text label="City" value={u.city} onChange={(v) => setUbo(n, "city", v)} error={e(`ubos.${n}.city`)} />
          <Text label="ZIP code" value={u.zip} onChange={(v) => setUbo(n, "zip", v)} error={e(`ubos.${n}.zip`)} />
        </div></fieldset>)}
      {input.ubos.length < MAX_UBOS && <button type="button" className="kyc-add" onClick={() => set("ubos", [...input.ubos, emptyUbo()])}>+ Add another UBO <small>(up to {MAX_UBOS})</small></button>}
      {e("ubos") && <small className="field-error" role="alert">{e("ubos")}</small>}
    </Card>
    {idCard(4, " of the representative")}
  </>;
  if (step === "trade") body = <>
    <p className="kyc-lead">Please provide the following information about at least 1 of your suppliers (officially licensed distributor / developer / publisher).</p>
    <div className="kyc-amber">ⓘ We will require proof of partnership.</div>
    {input.suppliers.map((s, n) => <div key={n} className="kyc-supplier">
      <Card n={n * 2 + 1} title={`Supplier details${input.suppliers.length > 1 ? ` (${n + 1})` : ""}`}>
        {input.suppliers.length > 1 && <button type="button" className="as-link text-link kyc-remove" onClick={() => set("suppliers", input.suppliers.filter((_, j) => j !== n))}>Remove supplier {n + 1}</button>}
        <Text label="Supplier name" value={s.name} onChange={(v) => setSup(n, "name", v)} error={e(`suppliers.${n}.name`)} />
        <Radios legend="Company type" name={`ctype${n}`} value={s.companyType} options={COMPANY_TYPES.map((v) => ({ v, l: v }))} onChange={(v) => setSup(n, "companyType", v)} error={e(`suppliers.${n}.companyType`)} />
        <div className="sell-grid">
          <Text label="Company name" value={s.companyName} onChange={(v) => setSup(n, "companyName", v)} error={e(`suppliers.${n}.companyName`)} />
          <Text label="Company number" optional value={s.companyNumber} onChange={(v) => setSup(n, "companyNumber", v)} />
          <CountrySelect label="Country" value={s.country} onChange={(v) => setSup(n, "country", v)} error={e(`suppliers.${n}.country`)} />
          <Text label="Address" value={s.address} onChange={(v) => setSup(n, "address", v)} error={e(`suppliers.${n}.address`)} />
          <Text label="City" value={s.city} onChange={(v) => setSup(n, "city", v)} error={e(`suppliers.${n}.city`)} />
          <Text label="ZIP code" value={s.zip} onChange={(v) => setSup(n, "zip", v)} error={e(`suppliers.${n}.zip`)} />
        </div>
        <Checks legend="Types of products" value={s.productTypes} options={SUPPLY_PRODUCTS} onChange={(v) => setSup(n, "productTypes", v)} error={e(`suppliers.${n}.productTypes`)} />
      </Card>
      <Card n={n * 2 + 2} title="Confirmation from supplier">
        <p>Direct contract (excerpt) OR written confirmation from this supplier that your stock has a legitimate source and is resold for retail. It must show who you and the supplier are.</p>
        <p>Or: a B2B invoice for a recent purchase (dated within the last month) from this supplier.</p>
        <p className="kyc-red">Invoices from marketplaces (Amazon, eBay, AliExpress …) or end-user purchases are not accepted.</p>
        <Radios legend="What are you uploading?" name={`proof${n}`} value={s.proofType} options={PROOF_TYPES.map((p) => ({ v: p.id, l: p.label }))} onChange={(v) => setSup(n, "proofType", v)} error={e(`suppliers.${n}.proofType`)} />
        {s.proofType === "invoice" && <div className="kyc-amber"><b>Important:</b> if you apply with an invoice only, your sales will be held for a <b>10-day freeze period</b> after approval.</div>}
        <FileDrop kind="supplier_proof" title="Contract / confirmation / invoice" files={fileOf(s.files)} onAdd={(f) => { setFiles((l) => [...l, f]); setSup(n, "files", [...input.suppliers[n]!.files, f.id]); }} onRemove={(id) => setSup(n, "files", input.suppliers[n]!.files.filter((x) => x !== id))} error={e(`suppliers.${n}.files`)} />
      </Card></div>)}
    {input.suppliers.length < MAX_SUPPLIERS && <button type="button" className="kyc-add" onClick={() => set("suppliers", [...input.suppliers, emptySupplier()])}>+ Add another supplier <small>(up to {MAX_SUPPLIERS})</small></button>}
  </>;
  if (step === "offers") body = <>
    <Card n={1} title="Choose your offer type" info="Tick everything you sell. Ticks stay when you switch tabs."><OfferPicker offers={input.offers} onChange={(o) => set("offers", o)} error={e("offers")} /></Card>
    <Card n={2} title="Products you plan to sell">
      {input.products.map((p, n) => <div key={n} className="kyc-row-input"><Text label={`Product ${n + 1}`} value={p} onChange={(v) => { set("products", input.products.map((x, j) => (j === n ? v : x))); clear(`products.${n}`); }} error={e(`products.${n}`)} placeholder="e.g. Steam keys" maxLength={80} />
        {input.products.length > 1 && <button type="button" className="as-link text-link" onClick={() => set("products", input.products.filter((_, j) => j !== n))}>Remove<span className="sr-only"> product {n + 1}</span></button>}</div>)}
      {input.products.length < MAX_PRODUCTS && <button type="button" className="kyc-add" onClick={() => set("products", [...input.products, ""])}>+ Add another product <small>(up to {MAX_PRODUCTS})</small></button>}
      <Radios legend="What is the expected quantity you will upload for each of the products?" name="quantity" value={input.quantity} options={QUANTITIES.map((v) => ({ v, l: v }))} onChange={(v) => set("quantity", v)} error={e("quantity")} />
      <Radios legend="Will you be using our API services?" name="api" value={input.api} options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }] as const} onChange={(v) => set("api", v)} error={e("api")} />
      <fieldset className="sell-yesno kyc-links"><legend>Where do you currently distribute your stock? <em>(optional — links to your profiles on other platforms)</em></legend>
        {input.links.map((l, n) => <div key={n} className="kyc-row-input"><Text label={`Link ${n + 1}`} value={l} onChange={(v) => { set("links", input.links.map((x, j) => (j === n ? v : x))); clear(`links.${n}`); }} error={e(`links.${n}`)} placeholder="https://" inputMode="url" />
          <button type="button" className="as-link text-link" onClick={() => set("links", input.links.filter((_, j) => j !== n))}>Remove<span className="sr-only"> link {n + 1}</span></button></div>)}
        {input.links.length < MAX_LINKS && <button type="button" className="kyc-add" onClick={() => set("links", [...input.links, ""])}>+ Add {input.links.length ? "another " : "a "}link <small>(up to {MAX_LINKS})</small></button>}
      </fieldset>
    </Card>{ticks}</>;

  return <PageShell>{crumbs}
    <h1 className="sell-title">{STEP_TITLE[type as SellerType]}</h1><p className="kyc-sub">{STEP_INTRO[type as SellerType]}</p>
    <div className="kyc">{mobileBar}{progress}
      <form className="kyc-main" noValidate aria-label={step ? STEP_LABEL[step] : "Seller application"} onSubmit={(x) => { x.preventDefault(); cont(); }}>
        {body}
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="success">{saved}</Notice>}
        <div className="sell-actions kyc-actions">
          <button type="button" className="btn btn-outline" onClick={back}>Back</button>
          <span>{type === "business" && <button type="button" className="btn btn-outline-blue" disabled={busy} onClick={later}>Save for later</button>}
            <button className={`btn btn-go${ready ? "" : " off"}`} aria-describedby={ready ? undefined : "kyc-hint"} disabled={busy}>{busy ? "Saving…" : isLast ? "Send request" : "Continue"}</button></span>
        </div>
        {!ready && <p className="kyc-hint" id="kyc-hint">{isLast ? "Send request" : "Continue"} stays grey until every required field is filled. Each step is saved to your account when you press Continue.</p>}
      </form>
    </div>
  </PageShell>;
}

// Business step 2: the 7 supporting documents as mini steps ("N of 7 done"); one opens at a time with its own upload box. Doc 4 optional.
function Docs({ input, fileOf, addKind, rmKind, e }: { input: SellerInput; fileOf: (ids: string[]) => SellerFile[]; addKind: (k: keyof SellerInput["files"]) => (f: SellerFile) => void; rmKind: (k: keyof SellerInput["files"]) => (id: string) => void; e: (k: string) => string | undefined }) {
  const firstOpen = SUPPORTING_DOCS.find((k) => !input.files[k].length && !OPTIONAL_DOCS.includes(k)) ?? null;
  const [open, setOpen] = useState<string | null>(firstOpen);
  const n = SUPPORTING_DOCS.filter((k) => input.files[k].length).length;
  return <div className="kyc-mini"><div className="kyc-mini-head">Upload documents ({n} of {SUPPORTING_DOCS.length} done)</div>
    {SUPPORTING_DOCS.map((k, i) => { const fs = input.files[k]; const opt = OPTIONAL_DOCS.includes(k); const isOpen = open === k; const err = e(k);
      return <div key={k} className={`kyc-mini-row${isOpen ? " open" : ""}${err ? " has-error" : ""}`}>
        <button type="button" className="kyc-mini-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}>
          <span className={`kyc-ic${fs.length ? " ok" : ""}`} aria-hidden="true">{fs.length ? "✓" : i + 1}</span>
          <span><b>{fileKindLabel(k)}{opt && <em> (if applicable)</em>}</b><small>{fileKind(k)!.hint}</small></span>
          <span className="kyc-mini-state">{fs.length ? `${fs.length} file${fs.length === 1 ? "" : "s"} ›` : opt ? "Skip" : "Upload"}</span></button>
        {isOpen && <FileDrop kind={k} title={fileKindLabel(k).replace(/^\d /, "")} files={fileOf(fs)} onAdd={addKind(k)} onRemove={rmKind(k)} error={err} />}
        {!isOpen && err && <small className="field-error" role="alert">{err}</small>}
      </div>; })}
  </div>;
}
