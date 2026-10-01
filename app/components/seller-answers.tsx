"use client";

import { dialCode } from "@/lib/dial-codes";
import { countryName } from "@/lib/profile";
import { idTypeLabel, isV2, OFFER_TABS, proofLabel, profileLines, purchaseLabel, type Answers } from "@/lib/sellers";

// Every answer of a seller application as labeled rows in cards (screen 11: no "·"-joined summaries). Used by /admin/seller (with the
// full document number) and the applicant's read-only /sell/details (last 4 digits only). Older 4-step applications show their own keys.
type Row = [string, React.ReactNode];
const cn = (c?: string) => (c ? countryName(c) : "");
const date = (d?: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const phone = (c: string, p: string) => (p ? `${dialCode(c)} ${p}`.trim() : "");
function Card({ title, rows, wide }: { title: string; rows: Row[]; wide?: boolean }) {
  return <section className={`sa-card${wide ? " sa-wide" : ""}`} aria-label={title}><h3>{title}</h3>
    <dl className="sa-dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl></section>;
}
export function SellerAnswers({ answers: a, idNumber, extra }: { answers: Answers; idNumber: React.ReactNode; extra?: Row[] }) {
  if (!isV2(a)) return <div className="sa-cards">
    {extra && <Card title="Application" rows={extra} />}
    <Card title="Applicant (older 4-step form)" rows={[["First name", a.firstName], ["Last name", a.lastName], ["Merchant name", a.merchantName], ["Store / website", a.storeUrl], ["Marketplace profiles", a.profiles && <span className="sa-pre">{a.profiles}</span>], ["Why sell on CoreCart", a.why && <span className="sa-pre">{a.why}</span>],
      ["Business location", cn(a.businessCountry)], ["Citizenship", cn(a.citizenship)], ["Key sources", a.sources?.join(", ")], ["Codes in stock", a.stockSize], ["Product types", a.productTypes?.join(", ")], ["Heard about us", a.heardFrom]]} />
    <Card title="Company" rows={a.isCompany ? [["Company name", a.companyName], ["Registration number", a.companyReg], ["Tax ID / VAT", a.companyTax], ["Address", a.companyAddress && <span className="sa-pre">{a.companyAddress}</span>]] : [["Registered company", "No"]]} />
    <Card title="KYC" rows={[["ID type", idTypeLabel(a.idType ?? "")], ["ID number", idNumber]]} />
  </div>;
  const offers: Row[] = OFFER_TABS.map((t) => [t.label, a.offers[t.id].join(", ")]);
  const id: Row[] = [["Document type", idTypeLabel(a.idType)], ["Document number", idNumber]];
  if (a.sellerType === "individual") return <div className="sa-cards">
    {extra && <Card title="Application" rows={extra} />}
    <Card title="1 · Basic details" rows={[["First name", a.firstName], ["Last name", a.lastName], ["Merchant name", a.merchantName], ["Store / website", a.storeUrl], ["Country of residence", cn(a.businessCountry)], ["Citizenship", cn(a.citizenship)], ["Heard about us", a.heardFrom]]} />
    <Card title="2 · Proofs" rows={[...offers, ...id]} />
    <Card title="3 · Product description" rows={[["Where products come from", purchaseLabel(a.purchaseSource)], ["Procurement source", <span key="p" className="sa-pre">{a.procurement}</span>], ["Products in stock", a.stockRange], ["Sells on other platforms", a.otherPlatforms === "yes" ? "Yes" : a.otherPlatforms === "no" ? "No" : ""],
      ["Profile links", a.otherPlatforms === "yes" && <Links list={profileLines(a.profiles)} />]]} />
  </div>;
  return <div className="sa-cards">
    {extra && <Card title="Application" rows={extra} />}
    <Card title="1 · Company details" rows={[["Company name", a.companyName], ["Merchant name", a.merchantName], ["Registration number", a.companyReg], ["Registration place / type", a.companyRegPlace], ["Tax ID / VAT", a.companyTax], ["Country", cn(a.businessCountry)],
      ["Address", [a.address1, a.address2].filter(Boolean).join(", ")], ["State / province", a.state], ["Postal code", a.postalCode], ["City", a.city]]} />
    <Card title="3 · Representative" rows={[["Full name", a.rep.fullName], ["Date of birth", date(a.rep.dob)], ["Email", a.rep.email], ["Phone", phone(a.rep.phoneCountry, a.rep.phone)], ["Basis of representation", a.rep.basis], ["Citizenship", cn(a.rep.citizenship)], ...id,
      ["CEO", a.ceoSame ? "Same as representative" : "See CEO information"]]} />
    {!a.ceoSame && <Card title="CEO information" rows={[["Full name", a.ceo.fullName], ["Date of birth", date(a.ceo.dob)], ["Email", a.ceo.email], ["Phone", phone(a.ceo.phoneCountry, a.ceo.phone)], ["Country", cn(a.ceo.country)], ["Address", a.ceo.address], ["City", a.ceo.city], ["ZIP code", a.ceo.zip]]} />}
    <section className="sa-card" aria-label={`UBOs (${a.ubos.length})`}><h3>UBOs ({a.ubos.length})</h3>
      <div className="adm-table-wrap"><table className="adm-table sa-ubo"><thead><tr><th>Full name</th><th>Born</th><th>Country</th><th>Address</th><th>City</th><th>ZIP</th></tr></thead>
        <tbody>{a.ubos.map((u, n) => <tr key={n}><td>{u.fullName}</td><td>{date(u.dob)}</td><td>{cn(u.country)}</td><td>{u.address}</td><td>{u.city}</td><td>{u.zip}</td></tr>)}</tbody></table></div></section>
    {a.suppliers.map((s, n) => <Card key={n} title={`4 · Trade reference ${n + 1}${a.suppliers.length > 1 ? ` of ${a.suppliers.length}` : ""}`} rows={[["Supplier name", s.name], ["Company type", s.companyType], ["Company name", s.companyName], ["Company number", s.companyNumber], ["Country", cn(s.country)], ["Address", s.address], ["City", s.city], ["ZIP code", s.zip],
      ["Types of products", s.productTypes.join(", ")], ["Proof", `${proofLabel(s.proofType)} · ${s.files.length} file${s.files.length === 1 ? "" : "s"} (Files below)`]]} />)}
    <Card title="5 · Offer details" rows={[...offers, ["Products", a.products.join(" · ")], ["Expected quantity per product", a.quantity], ["API services", a.api === "yes" ? "Yes" : a.api === "no" ? "No" : ""], ["Distribution links", a.links.length ? <Links list={a.links} /> : "None"]]} />
  </div>;
}
// Links are shown as text (never opened from the admin page by accident); one per line.
const Links = ({ list }: { list: string[] }) => <span className="sa-links">{list.map((l, n) => <span key={n}>{l}</span>)}</span>;
