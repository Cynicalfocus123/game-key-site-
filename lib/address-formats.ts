// Billing address formats per country (task 5, wireframe approved 2026-09-30: Claude outputs/wireframes/billing-address-wireframe.png).
// Own table, no package. Shared by the payment page, Add card (Payment methods), the demo store and the server (same checks everywhere).
// Every country in COUNTRY_CODES gets a layout: a special one below, or DEFAULT. Thailand labels are English + Thai (user 2026-09-30).
import { COUNTRY_CODES } from "@/lib/currency/currencies";

export type AddressKey = "line1" | "line2" | "house" | "flat" | "subdistrict" | "district" | "city" | "region" | "postcode";
export const ADDRESS_KEYS: AddressKey[] = ["line1", "line2", "house", "flat", "subdistrict", "district", "city", "region", "postcode"];
export type BillingAddress = { country: string } & Partial<Record<AddressKey, string>>;
// span = columns out of 6 on wide screens (phones: one column, except fields marked pair).
export type AddressField = { key: AddressKey; label: string; required: boolean; span: 2 | 3 | 4 | 6; options?: { value: string; label: string }[]; example?: string; auto?: string };
type Postcode = { re: RegExp; example: string; label?: string; required?: boolean } | null;
export const FIELD_MAX = 100;

const f = (key: AddressKey, label: string, required: boolean, span: AddressField["span"] = 6, extra: Partial<AddressField> = {}): AddressField =>
  ({ key, label, required, span, auto: AUTO[key], ...extra });
const AUTO: Partial<Record<AddressKey, string>> = { line1: "address-line1", line2: "address-line2", city: "address-level2", region: "address-level1", postcode: "postal-code" };
const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }));

// ---- region lists ----
// Thailand: 77 provinces (English value, Thai shown next to it).
const TH_PROVINCES: [string, string][] = [
  ["Bangkok", "กรุงเทพมหานคร"], ["Amnat Charoen", "อำนาจเจริญ"], ["Ang Thong", "อ่างทอง"], ["Bueng Kan", "บึงกาฬ"], ["Buriram", "บุรีรัมย์"], ["Chachoengsao", "ฉะเชิงเทรา"],
  ["Chai Nat", "ชัยนาท"], ["Chaiyaphum", "ชัยภูมิ"], ["Chanthaburi", "จันทบุรี"], ["Chiang Mai", "เชียงใหม่"], ["Chiang Rai", "เชียงราย"], ["Chonburi", "ชลบุรี"],
  ["Chumphon", "ชุมพร"], ["Kalasin", "กาฬสินธุ์"], ["Kamphaeng Phet", "กำแพงเพชร"], ["Kanchanaburi", "กาญจนบุรี"], ["Khon Kaen", "ขอนแก่น"], ["Krabi", "กระบี่"],
  ["Lampang", "ลำปาง"], ["Lamphun", "ลำพูน"], ["Loei", "เลย"], ["Lopburi", "ลพบุรี"], ["Mae Hong Son", "แม่ฮ่องสอน"], ["Maha Sarakham", "มหาสารคาม"],
  ["Mukdahan", "มุกดาหาร"], ["Nakhon Nayok", "นครนายก"], ["Nakhon Pathom", "นครปฐม"], ["Nakhon Phanom", "นครพนม"], ["Nakhon Ratchasima", "นครราชสีมา"], ["Nakhon Sawan", "นครสวรรค์"],
  ["Nakhon Si Thammarat", "นครศรีธรรมราช"], ["Nan", "น่าน"], ["Narathiwat", "นราธิวาส"], ["Nong Bua Lamphu", "หนองบัวลำภู"], ["Nong Khai", "หนองคาย"], ["Nonthaburi", "นนทบุรี"],
  ["Pathum Thani", "ปทุมธานี"], ["Pattani", "ปัตตานี"], ["Phang Nga", "พังงา"], ["Phatthalung", "พัทลุง"], ["Phayao", "พะเยา"], ["Phetchabun", "เพชรบูรณ์"],
  ["Phetchaburi", "เพชรบุรี"], ["Phichit", "พิจิตร"], ["Phitsanulok", "พิษณุโลก"], ["Phra Nakhon Si Ayutthaya", "พระนครศรีอยุธยา"], ["Phrae", "แพร่"], ["Phuket", "ภูเก็ต"],
  ["Prachinburi", "ปราจีนบุรี"], ["Prachuap Khiri Khan", "ประจวบคีรีขันธ์"], ["Ranong", "ระนอง"], ["Ratchaburi", "ราชบุรี"], ["Rayong", "ระยอง"], ["Roi Et", "ร้อยเอ็ด"],
  ["Sa Kaeo", "สระแก้ว"], ["Sakon Nakhon", "สกลนคร"], ["Samut Prakan", "สมุทรปราการ"], ["Samut Sakhon", "สมุทรสาคร"], ["Samut Songkhram", "สมุทรสงคราม"], ["Saraburi", "สระบุรี"],
  ["Satun", "สตูล"], ["Sing Buri", "สิงห์บุรี"], ["Sisaket", "ศรีสะเกษ"], ["Songkhla", "สงขลา"], ["Sukhothai", "สุโขทัย"], ["Suphan Buri", "สุพรรณบุรี"],
  ["Surat Thani", "สุราษฎร์ธานี"], ["Surin", "สุรินทร์"], ["Tak", "ตาก"], ["Trang", "ตรัง"], ["Trat", "ตราด"], ["Ubon Ratchathani", "อุบลราชธานี"],
  ["Udon Thani", "อุดรธานี"], ["Uthai Thani", "อุทัยธานี"], ["Uttaradit", "อุตรดิตถ์"], ["Yala", "ยะลา"], ["Yasothon", "ยโสธร"],
];
const US_STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska",
  "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"];
const UA_OBLASTS = ["Cherkasy Oblast", "Chernihiv Oblast", "Chernivtsi Oblast", "Dnipropetrovsk Oblast", "Donetsk Oblast", "Ivano-Frankivsk Oblast", "Kharkiv Oblast", "Kherson Oblast",
  "Khmelnytskyi Oblast", "Kirovohrad Oblast", "Kyiv", "Kyiv Oblast", "Luhansk Oblast", "Lviv Oblast", "Mykolaiv Oblast", "Odesa Oblast", "Poltava Oblast", "Rivne Oblast",
  "Sumy Oblast", "Ternopil Oblast", "Vinnytsia Oblast", "Volyn Oblast", "Zakarpattia Oblast", "Zaporizhzhia Oblast", "Zhytomyr Oblast", "Autonomous Republic of Crimea", "Sevastopol"];
const JP_PREFECTURES = ["Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima", "Ibaraki", "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa",
  "Niigata", "Toyama", "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu", "Shizuoka", "Aichi", "Mie", "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara", "Wakayama", "Tottori",
  "Shimane", "Okayama", "Hiroshima", "Yamaguchi", "Tokushima", "Kagawa", "Ehime", "Kochi", "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa"];
const CA_PROVINCES = ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"];
const AU_STATES = ["Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland", "South Australia", "Tasmania", "Victoria", "Western Australia"];
const HK_AREAS = ["Hong Kong Island", "Kowloon", "New Territories"];

// ---- postcodes (checked after trimming + upper case). null = the country has no postcode (no field). ----
const P: Record<string, Postcode> = {
  AE: null, QA: null, HK: null,
  TH: { re: /^\d{5}$/, example: "10110" }, UA: { re: /^\d{5}$/, example: "01001" }, US: { re: /^\d{5}(-\d{4})?$/, example: "90660", label: "ZIP code" }, PR: { re: /^\d{5}(-\d{4})?$/, example: "00901", label: "ZIP code" },
  GB: { re: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/, example: "SW1A 1AA" }, JP: { re: /^\d{3}-?\d{4}$/, example: "100-0001", label: "Postcode 〒" }, CA: { re: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/, example: "K1A 0B1", label: "Postal code" },
  NL: { re: /^\d{4} ?[A-Z]{2}$/, example: "1011 AB" }, PL: { re: /^\d{2}-\d{3}$/, example: "00-950" }, PT: { re: /^\d{4}-\d{3}$/, example: "1000-001" }, BR: { re: /^\d{5}-?\d{3}$/, example: "01310-100", label: "CEP" },
  LV: { re: /^(LV-)?\d{4}$/, example: "LV-1050" }, LT: { re: /^(LT-)?\d{5}$/, example: "LT-01100" }, MT: { re: /^[A-Z]{3} ?\d{4}$/, example: "VLT 1117" }, AD: { re: /^AD\d{3}$/, example: "AD500" },
  IE: { re: /^[A-Z]\d[\dW] ?[A-Z\d]{4}$/, example: "D02 X285", label: "Eircode", required: false }, AZ: { re: /^(AZ ?)?\d{4}$/, example: "AZ 1000" },
  CZ: { re: /^\d{3} ?\d{2}$/, example: "110 00", label: "PSČ" }, SK: { re: /^\d{3} ?\d{2}$/, example: "811 01", label: "PSČ" }, SE: { re: /^\d{3} ?\d{2}$/, example: "111 22" }, GR: { re: /^\d{3} ?\d{2}$/, example: "105 57" },
  AR: { re: /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/, example: "C1002" }, IL: { re: /^\d{7}$/, example: "6100000" }, CL: { re: /^\d{7}$/, example: "8320000" }, IS: { re: /^\d{3}$/, example: "101" },
  BH: { re: /^\d{3,4}$/, example: "317", required: false }, PA: { re: /^\d{4}$/, example: "0801", required: false }, SV: { re: /^\d{4}$/, example: "1101", required: false }, JO: { re: /^\d{5}$/, example: "11118", required: false },
  LU: { re: /^(L-)?\d{4}$/, example: "L-1111" },
};
for (const c of "AU AT BE BG CH LI CY DK HU NO NZ PH SI ZA TN BD".split(" ")) P[c] ??= { re: /^\d{4}$/, example: c === "AU" ? "2000" : c === "DK" ? "1050" : "1010" };
for (const c of "DE FR IT ES FI EE HR MY ID KW SA MA DZ MX TR KR PK MC SM VA ME XK CR UY PE".split(" ")) P[c] ??= { re: /^\d{5}$/, example: c === "DE" ? "10115" : c === "FR" ? "75001" : "12345" };
for (const c of "IN CN RU KZ UZ SG RO EC CO".split(" ")) P[c] ??= { re: /^\d{6}$/, example: c === "IN" ? "110001" : c === "SG" ? "018956" : "100000", ...(c === "IN" ? { label: "PIN code" } : {}) };

// ---- layouts ----
const postcodeField = (c: string, span: AddressField["span"] = 3): AddressField[] => { const p = postcode(c); return p ? [f("postcode", p.label ?? "Postcode", p.required !== false, span, { example: p.example })] : []; };
const DEFAULT = (c: string): AddressField[] => [f("line1", "Address line 1", true), f("line2", "Address line 2", false), f("city", "City / town", true, 3), f("region", "State / province / region", false, 3), ...postcodeField(c)];
const LAYOUT: Record<string, (c: string) => AddressField[]> = {
  TH: (c) => [f("line1", "Address (house no., building, street) · ที่อยู่", true, 6, { example: "99/1 Sukhumvit Road" }), f("subdistrict", "Sub-district · ตำบล / แขวง", true, 3), f("district", "District · อำเภอ / เขต", true, 3),
    f("region", "Province · จังหวัด", true, 3, { options: TH_PROVINCES.map(([en, th]) => ({ value: en, label: `${en} · ${th}` })) }), ...postcodeField(c).map((x) => ({ ...x, label: "Postcode · รหัสไปรษณีย์" }))],
  UA: (c) => [f("line1", "Street", true, 4), f("house", "House no.", true, 2), f("flat", "Flat", false, 2), f("city", "City / town", true, 4), f("region", "Oblast (region)", true, 3, { options: opts(UA_OBLASTS) }), ...postcodeField(c)],
  US: (c) => [f("line1", "Address line 1", true), f("line2", "Apt, suite, unit", false), f("city", "City", true), f("region", "State", true, 3, { options: opts(US_STATES) }), ...postcodeField(c)],
  PR: (c) => [f("line1", "Address line 1", true), f("line2", "Apt, suite, unit", false), f("city", "City", true), ...postcodeField(c)],
  GB: (c) => [f("line1", "Address line 1", true), f("line2", "Address line 2", false), f("city", "Town / city", true, 3), ...postcodeField(c), f("region", "County", false)],
  JP: (c) => [...postcodeField(c), f("region", "Prefecture", true, 3, { options: opts(JP_PREFECTURES) }), f("city", "City / ward", true), f("line1", "Town, chome, block, no.", true), f("line2", "Building, room", false)],
  CA: (c) => [f("line1", "Address line 1", true), f("line2", "Apt, suite, unit", false), f("city", "City", true), f("region", "Province / territory", true, 3, { options: opts(CA_PROVINCES) }), ...postcodeField(c)],
  AU: (c) => [f("line1", "Address line 1", true), f("line2", "Address line 2", false), f("city", "Suburb / town", true), f("region", "State / territory", true, 3, { options: opts(AU_STATES) }), ...postcodeField(c)],
  HK: () => [f("line1", "Flat, floor, building", true), f("line2", "Street", true), f("district", "District", true, 3), f("region", "Area", true, 3, { options: opts(HK_AREAS) })],
  AE: () => [f("line1", "Address line 1", true), f("line2", "Address line 2", false), f("city", "City / emirate", true)],
  QA: () => [f("line1", "Address line 1", true), f("line2", "Zone, street, building", false), f("city", "City", true)],
  BR: (c) => [f("line1", "Street", true, 4), f("house", "Number", true, 2), f("line2", "Complement", false), f("district", "Neighbourhood (bairro)", false), f("city", "City", true, 3), f("region", "State", true, 3), ...postcodeField(c)],
  MX: (c) => [f("line1", "Street and number", true), f("district", "Colonia", false), f("city", "City", true, 3), f("region", "State", true, 3), ...postcodeField(c)],
  IN: (c) => [f("line1", "Flat, house no., building", true), f("line2", "Area, street, village", false), f("city", "Town / city", true, 3), f("region", "State", true, 3), ...postcodeField(c)],
  CN: (c) => [f("region", "Province", true, 3), f("city", "City", true, 3), f("district", "District", false), f("line1", "Street address", true), ...postcodeField(c)],
  KR: (c) => [...postcodeField(c), f("region", "Province / city", true, 3), f("city", "District (si / gun / gu)", true), f("line1", "Street address", true), f("line2", "Building, unit", false)],
  IT: (c) => [f("line1", "Street and number", true), f("line2", "Address line 2", false), ...postcodeField(c, 2), f("city", "City", true, 4), f("region", "Province", false)],
  ES: (c) => [f("line1", "Street and number", true), f("line2", "Floor, door", false), ...postcodeField(c, 2), f("city", "City", true, 4), f("region", "Province", false)],
};
// Street + house number + postcode before city (DE style) for these.
for (const c of "DE AT CH LI NL BE DK NO SE FI PL CZ SK HU SI HR LU".split(" ")) LAYOUT[c] ??= (x) => [f("line1", "Street", true, 4), f("house", "House no.", true, 2), f("line2", "Address line 2", false), ...postcodeField(x, 2), f("city", "City", true, 4)];

export const postcode = (country: string): Postcode => (country in P ? P[country] : { re: /^[A-Z0-9][A-Z0-9 -]{1,9}$/, example: "", required: false });
export const addressFields = (country: string): AddressField[] => (LAYOUT[country] ?? DEFAULT)(country);
export const hasPostcode = (country: string) => postcode(country) !== null;
export const ADDRESS_COUNTRIES = COUNTRY_CODES; // every country in the store's list

export const ADDRESS_ERRORS = { country: "Choose your country.", required: (label: string) => `Enter ${cleanLabel(label).toLowerCase()}.`, choose: (label: string) => `Choose ${cleanLabel(label).toLowerCase()}.`,
  tooLong: `Up to ${FIELD_MAX} characters.`, postcode: (label: string, example: string) => `${cleanLabel(label)} is not valid${example ? ` (example: ${example})` : ""}.`, bad: "Invalid address." };
const cleanLabel = (label: string) => label.split(" · ")[0]!.replace(" 〒", "");
const tidy = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");

// Input → clean address (only this country's keys) or errors per field. Postcodes are saved in upper case.
export type AddressErrors = Partial<Record<AddressKey | "country", string>>;
export function checkAddress(input: unknown): { ok: true; address: BillingAddress } | { ok: false; errors: AddressErrors } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const country = tidy(o.country).toUpperCase();
  if (!ADDRESS_COUNTRIES.includes(country)) return { ok: false, errors: { country: ADDRESS_ERRORS.country } };
  const errors: AddressErrors = {}; const address: BillingAddress = { country };
  for (const fl of addressFields(country)) {
    let v = tidy(o[fl.key]);
    if (fl.key === "postcode") v = v.toUpperCase();
    if (!v) { if (fl.required) errors[fl.key] = fl.options ? ADDRESS_ERRORS.choose(fl.label) : ADDRESS_ERRORS.required(fl.label); continue; }
    if (v.length > FIELD_MAX) { errors[fl.key] = ADDRESS_ERRORS.tooLong; continue; }
    if (fl.options && !fl.options.some((x) => x.value === v)) { errors[fl.key] = ADDRESS_ERRORS.choose(fl.label); continue; }
    if (fl.key === "postcode") { const p = postcode(country); if (p && !p.re.test(v)) { errors.postcode = ADDRESS_ERRORS.postcode(fl.label, p.example); continue; } }
    address[fl.key] = v;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, address };
}

// "Bangkok 10110" (summary line), "Bangkok 10110, TH" (order page / receipt / email).
export function billingShort(a: BillingAddress | null | undefined, withCountry = false) {
  if (!a) return "";
  const place = a.region || a.city || a.district || "";
  return [[place, a.postcode].filter(Boolean).join(" "), withCountry ? a.country : ""].filter(Boolean).join(", ");
}
// All lines in the country's field order (receipt).
export const billingLines = (a: BillingAddress) => addressFields(a.country).map((x) => a[x.key]).filter(Boolean).join(", ") + `, ${a.country}`;
export const sameAddress = (a: BillingAddress | null | undefined, b: BillingAddress | null | undefined) =>
  !!a && !!b && a.country === b.country && ADDRESS_KEYS.every((k) => (a[k] ?? "") === (b[k] ?? ""));
export const BILLING_WRITE_LIMIT = { max: 30, windowMs: 10 * 60_000 };
