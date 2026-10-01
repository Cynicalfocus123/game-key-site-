// Seller application (T3, KYC redesign 2026-10-01). Shared by /sell/apply, the admin pages, the demo store and the server.
// Everyone signs up as a customer; a customer picks a seller type and fills its steps (each step saved on Continue as a server draft);
// an admin with the "Seller applications" section approves (role seller), rejects (reason) or blacklists (reason). Nothing is deleted:
// rejected, blacklisted and closed records stay, and a new application or sign-up with the same email, KYC document number or merchant
// name is flagged to the admin with a link to the old record.
// Individual: Basic details · Proofs (offers, ID, selfie) · Product description → Final step → Approving.
// Business (approved 2026-10-01): Basic details (company) · Documentation · Representative (rep, CEO, UBOs, ID, selfie) · Trade references
// (suppliers + proof) · Offer details → Final step → Approving.
import { addressFields, postcode } from "./address-formats";
import { isCountry } from "./profile";

export const SELLER_TYPES = [{ id: "individual", label: "Individual" }, { id: "business", label: "Business" }] as const;
export type SellerType = (typeof SELLER_TYPES)[number]["id"];
export const isSellerType = (v: unknown): v is SellerType => v === "individual" || v === "business";
export const sellerTypeLabel = (t: string) => SELLER_TYPES.find((x) => x.id === t)?.label ?? t;

export const HEARD_FROM = ["Search engine", "Social media", "Friend or colleague", "Other marketplace", "Advertisement", "Other"] as const;
export const ID_TYPES = [
  { id: "passport", label: "Passport", front: "Passport main page (international passport with MRZ, no cover)", back: null },
  { id: "national_id", label: "ID card", front: "Front side of your ID card", back: "Back side of your ID card" },
  { id: "residence_card", label: "Residence card", front: "Front side of your residence card", back: "Back side of your residence card" },
  { id: "driving_licence", label: "Driving licence", front: "Front side of your driving licence", back: "Back side of your driving licence" },
] as const;
export type IdType = (typeof ID_TYPES)[number]["id"];
export const idTypeLabel = (t: string) => ID_TYPES.find((x) => x.id === t)?.label ?? t;
export const needsBack = (t: string) => t !== "passport";

// Offer types (user 2026-09-29: keep every checkbox; the seller ticks what they sell, the admin sees it). Direct top up is a tick only:
// selling direct top-up products on the store stays off.
export const OFFER_TABS = [
  { id: "video", label: "Video games", offers: ["Game keys", "PC profiles", "Console games"] },
  { id: "online", label: "Online games", offers: ["Game currency", "Game items", "Accounts", "Power leveling"] },
  { id: "other", label: "Other products", offers: ["Software", "Top up cards", "Direct top up"] },
] as const;
export type OfferTab = (typeof OFFER_TABS)[number]["id"];
export type Offers = Record<OfferTab, string[]>;
export const offerCount = (o: Offers) => OFFER_TABS.reduce((n, t) => n + o[t.id].length, 0);

// Individual product description.
export const PURCHASE_SOURCES = [{ id: "suppliers", label: "Purchasing from suppliers" }, { id: "own", label: "Own purchase" }] as const;
export const STOCK_RANGES = ["1–10", "10–50", "50–100", "100+"] as const;
export const purchaseLabel = (v: string) => PURCHASE_SOURCES.find((x) => x.id === v)?.label ?? v;
// Business trade references + offer details (Eneba-style, user 2026-10-01).
export const COMPANY_TYPES = ["Game developer", "Publisher", "Official distributor", "Reseller"] as const;
export const SUPPLY_PRODUCTS = ["Games", "Gift cards", "Game points", "DLCs", "Software", "Subscriptions"] as const;
export const PROOF_TYPES = [
  { id: "contract", label: "Direct contract (excerpt)" },
  { id: "confirmation", label: "Written confirmation from the supplier" },
  { id: "invoice", label: "B2B invoice (last month)" },
] as const;
export type ProofType = (typeof PROOF_TYPES)[number]["id"];
export const proofLabel = (v: string) => PROOF_TYPES.find((x) => x.id === v)?.label ?? v;
export const QUANTITIES = ["1–20", "20–100", "100–500", "500+"] as const;
export const FREEZE_DAYS = 10; // invoice-only supplier proof → sales held 10 days after approval (user 2026-10-01)
export const MAX_UBOS = 10, MAX_SUPPLIERS = 5, MAX_PRODUCTS = 10, MAX_LINKS = 10, SUPPLIER_FILES = 5;

// Files: JPEG / PNG / GIF / PDF, 10 MB each, checked by content (magic bytes), never by name. Selfie: JPEG / PNG / PDF (no GIF).
// "key" (photos of keys) is the older form's kind: kept so old applications still open, not asked any more.
export type FileKind = "id_front" | "id_back" | "selfie" | "invoice" | "certificate" | "doc_gov_id" | "doc_registration" | "doc_address" | "doc_tax" | "doc_supply" | "doc_ubo" | "doc_articles" | "supplier_proof" | "key";
export type FileMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
const ALL: FileMime[] = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
export const FILE_KINDS: { id: FileKind; label: string; types: FileMime[]; max: number; hint?: string }[] = [
  { id: "id_front", label: "ID front", types: ALL, max: 1 },
  { id: "id_back", label: "ID back", types: ALL, max: 1 },
  { id: "selfie", label: "Selfie with the document", types: ["image/jpeg", "image/png", "application/pdf"], max: 1 },
  { id: "invoice", label: "Invoice / agreement", types: ALL, max: 5 },
  { id: "certificate", label: "Certificate of incorporation", types: ALL, max: 1 },
  { id: "doc_gov_id", label: "1 Government ID", types: ALL, max: 5, hint: "Passport or national ID of the seller, director and beneficial owners" },
  { id: "doc_registration", label: "2 Business registration", types: ALL, max: 3, hint: "Certificate of incorporation, company extract, trade licence or sole-trader registration" },
  { id: "doc_address", label: "3 Proof of business address", types: ALL, max: 3, hint: "Recent utility bill, bank statement, tax letter or lease (last 3 months)" },
  { id: "doc_tax", label: "4 Tax registration", types: ALL, max: 3, hint: "VAT / GST / tax certificate (if applicable, can be skipped)" },
  { id: "doc_supply", label: "5 Proof of legitimate key supply", types: ALL, max: 5, hint: "Publisher / distributor agreement or supplier invoices" },
  { id: "doc_ubo", label: "6 List of shareholders / UBOs", types: ALL, max: 3, hint: "Official document listing the UBOs (shareholder list, extract from the UBO register). If more than 1 UBO: every shareholder with 25% or more" },
  { id: "doc_articles", label: "7 Articles of association", types: ALL, max: 3, hint: "Official document governing the company's activities (articles of association or similar)" },
  { id: "supplier_proof", label: "Confirmation from supplier", types: ALL, max: SUPPLIER_FILES },
  { id: "key", label: "Photo of keys", types: ["image/jpeg", "image/png", "image/webp"], max: 5 },
];
export const SUPPORTING_DOCS = ["doc_gov_id", "doc_registration", "doc_address", "doc_tax", "doc_supply", "doc_ubo", "doc_articles"] as const;
export const OPTIONAL_DOCS: FileKind[] = ["doc_tax"];
export const isFileKind = (k: unknown): k is FileKind => k !== "key" && FILE_KINDS.some((x) => x.id === k); // uploads: only kinds the form asks for
export const fileKind = (k: string) => FILE_KINDS.find((x) => x.id === k);
export const fileKindLabel = (k: string) => fileKind(k)?.label ?? k;
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const mimeLabel = (m: string) => ({ "image/jpeg": "JPEG", "image/png": "PNG", "image/gif": "GIF", "image/webp": "WebP", "application/pdf": "PDF" } as Record<string, string>)[m] ?? m;
export const formatsOf = (k: FileKind) => fileKind(k)!.types.map(mimeLabel).join(", "); // "JPEG, PNG, GIF, PDF"
export const FILE_UPLOAD_LIMIT = { max: 80, windowMs: 10 * 60_000 }; // uploads per user (a business form has up to ~60 files)
export function sniffMime(b: Uint8Array): FileMime | null {
  const s = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && (s(0, 6) === "GIF87a" || s(0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 12 && s(0, 4) === "RIFF" && s(8, 12) === "WEBP") return "image/webp";
  if (b.length >= 5 && s(0, 5) === "%PDF-") return "application/pdf";
  return null;
}
// null = ok, else the error text.
export function checkFile(kind: FileKind, bytes: Uint8Array): string | null {
  if (!bytes.length) return SELL_ERRORS.fileEmpty;
  if (bytes.length > FILE_MAX_BYTES) return SELL_ERRORS.fileBig;
  const mime = sniffMime(bytes);
  if (!mime || !fileKind(kind)!.types.includes(mime)) return kind === "selfie" ? SELL_ERRORS.fileSelfie : SELL_ERRORS.fileType;
  return null;
}
export type SellerFile = { id: string; kind: FileKind; name: string; mime: string; size: number; createdAt: string };

export type SellerStatus = "pending" | "approved" | "rejected" | "blacklisted";
export type SellerTab = "pending" | "approved" | "rejected" | "blacklisted" | "closed";
export const SELLER_TABS: { id: SellerTab; label: string }[] = [{ id: "pending", label: "Pending" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }, { id: "blacklisted", label: "Blacklisted" }, { id: "closed", label: "Closed" }];
// Blacklisted always shows under Blacklisted; otherwise a closed account's application shows under Closed.
export const tabOf = (status: SellerStatus, accountClosed: boolean): SellerTab => (status === "blacklisted" ? "blacklisted" : accountClosed ? "closed" : status);
export const SELLER_STATUS_LABEL: Record<SellerStatus, string> = { pending: "Under review", approved: "Approved", rejected: "Rejected", blacklisted: "Blacklisted" };
export const SELLER_STATUS_CHIP: Record<SellerStatus, string> = { pending: "chip-amber", approved: "chip-green", rejected: "chip-red", blacklisted: "chip-red" };
export const applicationNumber = (n: number) => `SA-${100000 + n}`;

// People + suppliers (Business). Dates are YYYY-MM-DD; phone = country (ISO) + national number.
export type Rep = { fullName: string; dob: string; email: string; phoneCountry: string; phone: string; basis: string; citizenship: string };
export type Ceo = { fullName: string; dob: string; email: string; phoneCountry: string; phone: string; country: string; address: string; city: string; zip: string };
export type Ubo = { fullName: string; dob: string; country: string; address: string; city: string; zip: string };
export type Supplier = { name: string; companyType: string; companyName: string; companyNumber: string; country: string; address: string; city: string; zip: string; productTypes: string[]; proofType: ProofType | ""; files: string[] };
export const emptyRep = (): Rep => ({ fullName: "", dob: "", email: "", phoneCountry: "", phone: "", basis: "", citizenship: "" });
export const emptyCeo = (): Ceo => ({ fullName: "", dob: "", email: "", phoneCountry: "", phone: "", country: "", address: "", city: "", zip: "" });
export const emptyUbo = (): Ubo => ({ fullName: "", dob: "", country: "", address: "", city: "", zip: "" });
export const emptySupplier = (): Supplier => ({ name: "", companyType: "", companyName: "", companyNumber: "", country: "", address: "", city: "", zip: "", productTypes: [], proofType: "", files: [] });

export type SellerFiles = Record<Exclude<FileKind, "key" | "supplier_proof">, string[]>; // uploaded file ids per kind (supplier proofs live on each supplier)
export type SellerInput = {
  sellerType: SellerType | "";
  // Individual step Basic details.
  firstName: string; lastName: string; citizenship: string; storeUrl: string; heardFrom: string;
  merchantName: string; // both types
  businessCountry: string; // Individual: country of residence. Business: company country.
  // Business step Basic details.
  companyName: string; companyReg: string; companyRegPlace: string; companyTax: string; address1: string; address2: string; state: string; postalCode: string; city: string;
  // Business step Representative.
  rep: Rep; ceoSame: boolean; ceo: Ceo; ubos: Ubo[];
  // Identity document (Individual Proofs / Business Representative).
  idType: IdType | ""; idNumber: string;
  offers: Offers; // Individual Proofs / Business Offer details
  // Individual Product description.
  purchaseSource: string; procurement: string; stockRange: string; otherPlatforms: "yes" | "no" | ""; profiles: string;
  // Business Trade references + Offer details.
  suppliers: Supplier[]; products: string[]; quantity: string; api: "yes" | "no" | ""; links: string[];
  confirm: boolean; terms: boolean; // ticked on the last step only, never stored as answers (terms → version + time on the application)
  files: SellerFiles;
};
const emptyFiles = (): SellerFiles => ({ id_front: [], id_back: [], selfie: [], invoice: [], certificate: [], doc_gov_id: [], doc_registration: [], doc_address: [], doc_tax: [], doc_supply: [], doc_ubo: [], doc_articles: [] });
export const emptySellerInput = (): SellerInput => ({ sellerType: "", firstName: "", lastName: "", citizenship: "", storeUrl: "", heardFrom: "", merchantName: "", businessCountry: "",
  companyName: "", companyReg: "", companyRegPlace: "", companyTax: "", address1: "", address2: "", state: "", postalCode: "", city: "",
  rep: emptyRep(), ceoSame: true, ceo: emptyCeo(), ubos: [emptyUbo()], idType: "", idNumber: "", offers: { video: [], online: [], other: [] },
  purchaseSource: "", procurement: "", stockRange: "", otherPlatforms: "", profiles: "", suppliers: [emptySupplier()], products: [""], quantity: "", api: "", links: [],
  confirm: false, terms: false, files: emptyFiles() });

export const SELL_ERRORS = {
  type: "Choose Individual or Business.",
  firstName: "Enter the first name.", lastName: "Enter the last name.", citizenship: "Choose the citizenship.",
  merchant: "Merchant name: 3–40 letters, numbers, spaces, dots or dashes.", merchantTaken: "This merchant name is taken. Choose another.", merchantOpen: "Another open application uses this merchant name, so this one cannot go back to Pending. Reject or blacklist the other first.",
  url: "Enter a full web address starting with https:// (or leave it empty).", heard: "Tell us how you heard about us.", country: "Choose a country.",
  companyName: "Enter the company name.", companyReg: "Enter the registration number.", companyRegPlace: "Enter where and how the company is registered.",
  companyTax: "Tax ID / VAT: up to 40 letters, numbers or dashes.", address1: "Enter the address.", state: "Enter the state / province.", postalCode: "Enter a valid postal code.", city: "Enter the city.",
  fullName: "Enter the full name.", dob: "Enter a valid date of birth.", adult: "Must be 18 or older.", email: "Enter a valid email address.", phone: "Enter the phone number (country + 4–14 digits).",
  basis: "Enter the basis of representation (e.g. CEO, Director, power of attorney).", zip: "Enter the ZIP / postal code.",
  ubos: "Add 1–10 UBOs.",
  supplierName: "Enter the supplier name.", companyType: "Choose the company type.", productTypes: "Tick at least one product type.", proofType: "Choose what you are uploading.", supplierFiles: "Upload 1–5 files.",
  offers: "Tick at least one offer.", products: "Add 1–10 products (2–80 characters each).", quantity: "Choose the expected quantity.", api: "Choose Yes or No.", links: "Links must start with https:// (up to 10).",
  idType: "Choose the document type.", idNumber: "Enter the document number (4–30 letters or numbers).", idFront: "Upload the document.", idBack: "Upload the back side.", selfie: "Upload a selfie holding the document.",
  certificate: "Upload the certificate of incorporation.", docs: "Upload this document.",
  purchaseSource: "Choose where you purchase your products.", invoices: "Upload 1–5 invoices or agreements.", procurement: "Describe where your products come from (20–2000 characters).",
  stockRange: "Choose how many products you have.", otherPlatforms: "Choose Yes or No.", profiles: "Add 1–10 profile links (https://…), one per line.",
  confirm: "Confirm that the details are true.", terms: "Agree to the terms and conditions.",
  fileEmpty: "The file is empty.", fileBig: "Files can be 10 MB at most.", fileType: "Use a JPEG, PNG, GIF or PDF file.", fileSelfie: "Use a JPEG, PNG or PDF file.",
  fileBad: "One of the files is missing. Upload it again.", uploadLimit: "Too many uploads. Wait a few minutes and try again.",
  pending: "You already have an application under review.", approved: "You are already a seller.", verify: "Verify your email first.",
  closed: "This account is closed.", notFound: "Application not found.", reason: "Enter a reason (3–500 characters).",
  notPending: "Only a pending application can be approved or rejected.", notBlacklisted: "This application is not blacklisted.", already: "Already blacklisted.",
  stepOrder: "Finish the earlier steps first.", draftLimit: "Too many saves. Wait a few minutes and try again.", noDraft: "No application in progress.",
} as const;
// Error keys: field names, or paths for lists ("rep.dob", "ubos.0.city", "suppliers.1.files", "products.2").
export type SellerErrors = Partial<Record<string, string>>;

const trim = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | "" => (allowed.includes(v as T) ? (v as T) : "");
const ids = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[\w-]{8,64}$/.test(x)))].slice(0, max) : []);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
const cc = (v: unknown) => trim(v, 2).toUpperCase();
const dateIn = (v: unknown) => { const s = trim(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
export const cleanMerchant = (s: string) => s.trim().replace(/\s+/g, " ");
export const merchantKey = (s: string) => cleanMerchant(s).toLowerCase().replace(/[^a-z0-9]/g, ""); // "Key-Shop Ltd." = "keyshopltd"
export const cleanIdNumber = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const profileLines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const phoneDigits = (s: string) => s.replace(/[\s().-]/g, "");

// Parse any body into a SellerInput (unknown keys dropped, strings trimmed, lists limited to the allowed values). Checks come from checkSeller.
export function parseSellerInput(b: Record<string, unknown>): SellerInput {
  const f = obj(b.files); const o = obj(b.offers); const r = obj(b.rep); const c = obj(b.ceo);
  const files = emptyFiles(); for (const k of Object.keys(files) as (keyof SellerFiles)[]) files[k] = ids(f[k], fileKind(k)!.max);
  const offers = Object.fromEntries(OFFER_TABS.map((t) => [t.id, Array.isArray(o[t.id]) ? t.offers.filter((x) => (o[t.id] as unknown[]).includes(x)) : []])) as Offers;
  const person = (p: Record<string, unknown>) => ({ fullName: trim(p.fullName, 120), dob: dateIn(p.dob), email: trim(p.email, 160).toLowerCase(), phoneCountry: cc(p.phoneCountry), phone: trim(p.phone, 24) });
  const place = (p: Record<string, unknown>) => ({ country: cc(p.country), address: trim(p.address, 160), city: trim(p.city, 80), zip: trim(p.zip, 12).toUpperCase() });
  return {
    sellerType: isSellerType(b.sellerType) ? b.sellerType : "",
    firstName: trim(b.firstName, 60), lastName: trim(b.lastName, 60), citizenship: cc(b.citizenship), storeUrl: trim(b.storeUrl, 300), heardFrom: oneOf(b.heardFrom, HEARD_FROM),
    merchantName: cleanMerchant(trim(b.merchantName, 60)), businessCountry: cc(b.businessCountry),
    companyName: trim(b.companyName, 120), companyReg: trim(b.companyReg, 60), companyRegPlace: trim(b.companyRegPlace, 120), companyTax: trim(b.companyTax, 60),
    address1: trim(b.address1, 120), address2: trim(b.address2, 120), state: trim(b.state, 80), postalCode: trim(b.postalCode, 12).toUpperCase(), city: trim(b.city, 80),
    rep: { ...person(r), basis: trim(r.basis, 120), citizenship: cc(r.citizenship) }, ceoSame: b.ceoSame !== false, ceo: { ...person(c), ...place(c) },
    ubos: list(b.ubos, MAX_UBOS).map((u) => { const x = obj(u); return { fullName: trim(x.fullName, 120), dob: dateIn(x.dob), ...place(x) }; }),
    idType: oneOf(b.idType, ID_TYPES.map((t) => t.id)), idNumber: trim(b.idNumber, 40), offers,
    purchaseSource: oneOf(b.purchaseSource, PURCHASE_SOURCES.map((p) => p.id)), procurement: trim(b.procurement, 2200), stockRange: oneOf(b.stockRange, STOCK_RANGES),
    otherPlatforms: oneOf(b.otherPlatforms, ["yes", "no"] as const), profiles: trim(b.profiles, 3400),
    suppliers: list(b.suppliers, MAX_SUPPLIERS).map((s) => { const x = obj(s); return { name: trim(x.name, 120), companyType: oneOf(x.companyType, COMPANY_TYPES), companyName: trim(x.companyName, 120), companyNumber: trim(x.companyNumber, 60), ...place(x),
      productTypes: Array.isArray(x.productTypes) ? SUPPLY_PRODUCTS.filter((p) => (x.productTypes as unknown[]).includes(p)) : [], proofType: oneOf(x.proofType, PROOF_TYPES.map((p) => p.id)), files: ids(x.files, SUPPLIER_FILES) }; }),
    products: list(b.products, MAX_PRODUCTS).map((p) => trim(p, 80)), quantity: oneOf(b.quantity, QUANTITIES), api: oneOf(b.api, ["yes", "no"] as const),
    links: list(b.links, MAX_LINKS).map((l) => trim(l, 300)).filter(Boolean),
    confirm: b.confirm === true, terms: b.terms === true, files,
  };
}

// Steps per type. The page adds "Final step" and "Approving" after them (no form there).
export type StepId = "basic" | "proofs" | "product" | "documents" | "representative" | "trade" | "offers";
export const STEP_LABEL: Record<StepId, string> = { basic: "Basic details", proofs: "Proofs", product: "Product description", documents: "Documentation", representative: "Representative", trade: "Trade references", offers: "Offer details" };
export const stepsFor = (t: SellerType): StepId[] => (t === "business" ? ["basic", "documents", "representative", "trade", "offers"] : ["basic", "proofs", "product"]);
export const lastStep = (t: SellerType): StepId => (t === "business" ? "offers" : "product");
export const isStepId = (v: unknown): v is StepId => typeof v === "string" && v in STEP_LABEL;
export const STEP_TITLE: Record<SellerType, string> = { individual: "Personal verification", business: "Business verification" };
export const STEP_INTRO: Record<SellerType, string> = { individual: "To verify your personal seller account please follow the below steps", business: "To verify your Business seller account please follow the below steps" };

const MERCHANT_RE = /^[\p{L}\p{N}][\p{L}\p{N} .\-]{1,38}[\p{L}\p{N}.]$/u;
const URL_RE = /^https:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Age in full years on `today` (YYYY-MM-DD), or null for an impossible / future / pre-1900 date.
export function ageOf(dob: string, today = new Date().toISOString().slice(0, 10)): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob); if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]; const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1900 || dob > today) return null;
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - y - (tm < mo || (tm === mo && td < d) ? 1 : 0);
}
function person(p: { fullName: string; dob: string; email?: string; phoneCountry?: string; phone?: string }, at: string, e: SellerErrors, adult: boolean, contact: boolean) {
  if (p.fullName.length < 2) e[`${at}.fullName`] = SELL_ERRORS.fullName;
  const age = ageOf(p.dob); if (age === null) e[`${at}.dob`] = SELL_ERRORS.dob; else if (adult && age < 18) e[`${at}.dob`] = SELL_ERRORS.adult;
  if (contact) {
    if (!EMAIL_RE.test(p.email ?? "")) e[`${at}.email`] = SELL_ERRORS.email;
    if (!isCountry(p.phoneCountry) || !/^\d{4,14}$/.test(phoneDigits(p.phone ?? ""))) e[`${at}.phone`] = SELL_ERRORS.phone;
  }
}
function place(p: { country: string; address: string; city: string; zip: string }, at: string, e: SellerErrors) {
  if (!isCountry(p.country)) e[`${at}.country`] = SELL_ERRORS.country;
  if (!p.address) e[`${at}.address`] = SELL_ERRORS.address1;
  if (!p.city) e[`${at}.city`] = SELL_ERRORS.city;
  if (!/^[A-Z0-9 -]{2,12}$/.test(p.zip)) e[`${at}.zip`] = SELL_ERRORS.zip;
}
function identity(i: SellerInput, e: SellerErrors) {
  if (!i.idType) e.idType = SELL_ERRORS.idType;
  if (!/^[A-Z0-9]{4,30}$/.test(cleanIdNumber(i.idNumber))) e.idNumber = SELL_ERRORS.idNumber;
  if (!i.files.id_front.length) e.idFront = SELL_ERRORS.idFront;
  if (i.idType && needsBack(i.idType) && !i.files.id_back.length) e.idBack = SELL_ERRORS.idBack;
  if (!i.files.selfie.length) e.selfie = SELL_ERRORS.selfie; // required (user 2026-09-29)
}
// Errors of one step, or of every step of the type (step undefined). Same checks in the browser, the demo store and the API.
// The confirm + terms ticks belong to the last step but are checked only when sending (`sending`), so a draft step can be Completed.
export function checkSeller(i: SellerInput, step?: StepId, sending = !step): SellerErrors {
  const e: SellerErrors = {};
  if (!i.sellerType) { e.sellerType = SELL_ERRORS.type; return e; }
  const biz = i.sellerType === "business";
  const steps = (step ? [step] : stepsFor(i.sellerType)).filter((s) => stepsFor(i.sellerType as SellerType).includes(s));
  for (const s of steps) {
    if (s === "basic") {
      if (!MERCHANT_RE.test(i.merchantName)) e.merchantName = SELL_ERRORS.merchant;
      if (!isCountry(i.businessCountry)) e.businessCountry = SELL_ERRORS.country;
      if (biz) {
        if (!i.companyName) e.companyName = SELL_ERRORS.companyName;
        if (!i.companyReg) e.companyReg = SELL_ERRORS.companyReg;
        if (!i.companyRegPlace) e.companyRegPlace = SELL_ERRORS.companyRegPlace;
        if (i.companyTax && !/^[A-Za-z0-9 .\-/]{2,40}$/.test(i.companyTax)) e.companyTax = SELL_ERRORS.companyTax;
        if (!i.address1) e.address1 = SELL_ERRORS.address1;
        if (!i.city) e.city = SELL_ERRORS.city;
        if (isCountry(i.businessCountry)) {
          if (!i.state && addressFields(i.businessCountry).some((f) => f.key === "region" && f.required)) e.state = SELL_ERRORS.state;
          const p = postcode(i.businessCountry);
          if (p && (i.postalCode ? !p.re.test(i.postalCode) : p.required)) e.postalCode = SELL_ERRORS.postalCode;
        }
      } else {
        if (!i.firstName) e.firstName = SELL_ERRORS.firstName;
        if (!i.lastName) e.lastName = SELL_ERRORS.lastName;
        if (!isCountry(i.citizenship)) e.citizenship = SELL_ERRORS.citizenship;
        if (i.storeUrl && !URL_RE.test(i.storeUrl)) e.storeUrl = SELL_ERRORS.url;
        if (!i.heardFrom) e.heardFrom = SELL_ERRORS.heard;
      }
    }
    if (s === "proofs") { if (!offerCount(i.offers)) e.offers = SELL_ERRORS.offers; identity(i, e); }
    if (s === "product") {
      if (!i.purchaseSource) e.purchaseSource = SELL_ERRORS.purchaseSource;
      if (!i.files.invoice.length) e.invoices = SELL_ERRORS.invoices;
      if (i.procurement.length < 20 || i.procurement.length > 2000) e.procurement = SELL_ERRORS.procurement;
      if (!i.stockRange) e.stockRange = SELL_ERRORS.stockRange;
      if (!i.otherPlatforms) e.otherPlatforms = SELL_ERRORS.otherPlatforms;
      if (i.otherPlatforms === "yes") { const l = profileLines(i.profiles); if (!l.length || l.length > 10 || l.some((x) => x.length > 300 || !URL_RE.test(x))) e.profiles = SELL_ERRORS.profiles; }
    }
    if (s === "documents") {
      if (!i.files.certificate.length) e.certificate = SELL_ERRORS.certificate;
      for (const k of SUPPORTING_DOCS) if (!OPTIONAL_DOCS.includes(k) && !i.files[k].length) e[k] = SELL_ERRORS.docs;
    }
    if (s === "representative") {
      person(i.rep, "rep", e, true, true);
      if (i.rep.basis.length < 2) e["rep.basis"] = SELL_ERRORS.basis;
      if (!isCountry(i.rep.citizenship)) e["rep.citizenship"] = SELL_ERRORS.citizenship;
      if (!i.ceoSame) { person(i.ceo, "ceo", e, true, true); place(i.ceo, "ceo", e); }
      if (!i.ubos.length || i.ubos.length > MAX_UBOS) e.ubos = SELL_ERRORS.ubos;
      i.ubos.forEach((u, n) => { person(u, `ubos.${n}`, e, false, false); place(u, `ubos.${n}`, e); });
      identity(i, e);
    }
    if (s === "trade") {
      if (!i.suppliers.length) e.suppliers = SELL_ERRORS.supplierName;
      i.suppliers.forEach((x, n) => {
        const at = `suppliers.${n}`;
        if (x.name.length < 2) e[`${at}.name`] = SELL_ERRORS.supplierName;
        if (!x.companyType) e[`${at}.companyType`] = SELL_ERRORS.companyType;
        if (x.companyName.length < 2) e[`${at}.companyName`] = SELL_ERRORS.companyName;
        place(x, at, e);
        if (!x.productTypes.length) e[`${at}.productTypes`] = SELL_ERRORS.productTypes;
        if (!x.proofType) e[`${at}.proofType`] = SELL_ERRORS.proofType;
        if (!x.files.length) e[`${at}.files`] = SELL_ERRORS.supplierFiles;
      });
    }
    if (s === "offers") {
      if (!offerCount(i.offers)) e.offers = SELL_ERRORS.offers;
      if (!i.products.length || i.products.length > MAX_PRODUCTS) e.products = SELL_ERRORS.products;
      i.products.forEach((p, n) => { if (p.length < 2) e[`products.${n}`] = SELL_ERRORS.products; });
      if (!i.quantity) e.quantity = SELL_ERRORS.quantity;
      if (!i.api) e.api = SELL_ERRORS.api;
      i.links.forEach((l, n) => { if (!URL_RE.test(l)) e[`links.${n}`] = SELL_ERRORS.links; });
    }
    if (s === lastStep(i.sellerType) && sending) {
      if (!i.confirm) e.confirm = SELL_ERRORS.confirm;
      if (!i.terms) e.terms = SELL_ERRORS.terms;
    }
  }
  return e;
}
// The first step (in the type's order) with an error, for jumping back after a refused submit.
export const firstBadStep = (i: SellerInput): StepId | null => (i.sellerType ? stepsFor(i.sellerType).find((s) => Object.keys(checkSeller(i, s, s === lastStep(i.sellerType as SellerType))).length) ?? null : null);
// Draft step status: a step counts as Completed when it was saved with Continue and still passes its check, and every step before it is
// Completed too. The step to work on = the first one that is not Completed.
export function completedSteps(i: SellerInput, marked: readonly string[]): StepId[] {
  if (!i.sellerType) return [];
  const out: StepId[] = [];
  for (const s of stepsFor(i.sellerType)) {
    if (!marked.includes(s) || Object.keys(checkSeller(i, s, false)).length) break;
    out.push(s);
  }
  return out;
}
export type DraftProgress = { done: number; total: number; percent: number; next: StepId | null };
export function draftProgress(i: SellerInput, completed: readonly StepId[]): DraftProgress {
  if (!i.sellerType) return { done: 0, total: 0, percent: 0, next: null };
  const steps = stepsFor(i.sellerType); const done = completed.length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100), next: steps[done] ?? null };
}
// Every file id the application attaches, with its kind (only the kinds this seller type asks for).
export function usedFiles(i: SellerInput): { fid: string; kind: FileKind }[] {
  const kinds: (keyof SellerFiles)[] = i.sellerType === "business" ? ["certificate", ...SUPPORTING_DOCS, "id_front", "id_back", "selfie"] : ["id_front", "id_back", "selfie", "invoice"];
  const out = kinds.filter((k) => k !== "id_back" || needsBack(i.idType)).flatMap((k) => i.files[k].map((fid) => ({ fid, kind: k as FileKind })));
  if (i.sellerType === "business") i.suppliers.forEach((s) => s.files.forEach((fid) => out.push({ fid, kind: "supplier_proof" })));
  return out;
}
export const reasonOk = (r: unknown): r is string => typeof r === "string" && r.trim().length >= 3 && r.trim().length <= 500;
export const SELLER_ADMIN_LIMIT = { max: 120, windowMs: 60_000 }; // admin decisions per admin
export const DRAFT_LIMIT = { max: 120, windowMs: 10 * 60_000 }; // draft saves per user

// Server draft (one per user; never shown to admins). The document number comes back only to its owner.
export type SellerDraft = { input: SellerInput; completed: StepId[]; progress: DraftProgress; files: SellerFile[]; updatedAt: string };
// Answers stored on an application (everything except files per kind, the document number and the two ticks; supplier file ids stay on
// each supplier). Older applications (4-step form, before 2026-10-01) have the old keys instead; `v` tells them apart.
export type StoredAnswers = Omit<SellerInput, "files" | "idNumber" | "confirm" | "terms"> & { v: 2 };
export type LegacyAnswers = { v?: undefined; firstName?: string; lastName?: string; merchantName?: string; storeUrl?: string; profiles?: string; why?: string; sources?: string[]; businessCountry?: string; citizenship?: string;
  stockSize?: string; productTypes?: string[]; heardFrom?: string; isCompany?: boolean; companyName?: string; companyReg?: string; companyTax?: string; companyAddress?: string; idType?: string };
export type Answers = StoredAnswers | LegacyAnswers;
export const storedAnswers = (i: SellerInput): StoredAnswers => { const { files: _f, idNumber: _n, confirm: _c, terms: _t, ...rest } = i; return { ...rest, v: 2 }; };
export const isV2 = (a: Answers): a is StoredAnswers => a.v === 2;
export const isBusiness = (a: Answers) => (isV2(a) ? a.sellerType === "business" : a.isCompany === true);
// 10-day sales freeze when every supplier proof is a B2B invoice (business only; starts at approval).
export const freezeDays = (a: Answers) => (isV2(a) && a.sellerType === "business" && a.suppliers.length > 0 && a.suppliers.every((s) => s.proofType === "invoice") ? FREEZE_DAYS : 0);
// Name for lists + emails (business: the company; individual: the person).
export const applicantName = (a: Answers, fallback: string) => (isV2(a) && a.sellerType === "business" ? a.companyName : `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()) || fallback;
export const greetingName = (a: Answers, fallback: string) => (isV2(a) && a.sellerType === "business" ? a.rep.fullName.split(" ")[0] : a.firstName) || fallback;

// Admin + applicant file list grouped by step (screen 11). Every sent file is one row; a required or optional document that was not
// sent is one row with file null. Older applications keep their own kinds (Invoices, Photos of keys, ID front / back, Selfie).
export type FileRow = { doc: string; file: SellerFile | null; optional: boolean };
export type FileGroup = { title: string; rows: FileRow[] };
export function fileGroups(a: Answers, files: SellerFile[]): FileGroup[] {
  const used = new Set<string>();
  const of = (kind: FileKind, doc: string, optional = false, only?: string[], hideEmpty = false): FileRow[] => {
    const fs = files.filter((f) => f.kind === kind && (!only || only.includes(f.id)));
    fs.forEach((f) => used.add(f.id));
    return fs.length ? fs.map((file) => ({ doc, file, optional })) : hideEmpty ? [] : [{ doc, file: null, optional }];
  };
  const idType = isV2(a) ? a.idType : a.idType ?? "";
  const idRows = [...of("id_front", ID_TYPES.find((t) => t.id === idType)?.front ?? "ID front"), ...(needsBack(idType) ? of("id_back", ID_TYPES.find((t) => t.id === idType)?.back ?? "ID back") : []), ...of("selfie", "Selfie with the document")];
  let groups: FileGroup[];
  if (isV2(a) && a.sellerType === "business") {
    groups = [
      { title: "Documentation — company", rows: of("certificate", "Certificate of incorporation") },
      { title: "Documentation — supporting documents", rows: SUPPORTING_DOCS.flatMap((k) => of(k, fileKindLabel(k), OPTIONAL_DOCS.includes(k))) },
      { title: "Representative", rows: idRows },
      ...a.suppliers.map((s, n) => ({ title: `Trade references — ${s.name || `Supplier ${n + 1}`}`, rows: of("supplier_proof", "Confirmation from supplier", false, s.files) })),
    ];
  } else if (isV2(a)) {
    groups = [{ title: "Proofs", rows: idRows }, { title: "Product description", rows: of("invoice", "Invoice / agreement") }];
  } else {
    groups = [{ title: "Invoices", rows: of("invoice", "Invoice / agreement") }, { title: "Photos of keys", rows: of("key", "Photo of keys", true, undefined, true) }, { title: "Identity", rows: idRows }];
  }
  const rest = files.filter((f) => !used.has(f.id)); // anything else attached (never hidden from the admin)
  if (rest.length) groups.push({ title: "Other files", rows: rest.map((file) => ({ doc: fileKindLabel(file.kind), file, optional: false })) });
  return groups.filter((g) => g.rows.length);
}

// What the applicant sees (never the full document number; files by name only, never their content).
export type MyApplication = { id: string; number: string; status: SellerStatus; sellerType: SellerType; merchantName: string; createdAt: string; decidedAt: string | null; reason: string | null };
export type MyApplicationDetails = MyApplication & { answers: Answers; idLast4: string; files: SellerFile[]; termsVersion: string | null; termsAcceptedAt: string | null };
// Returning-person flags: same email / KYC ID number / merchant name as a closed account or a rejected / blacklisted application.
export type SellerMatch = { kind: "email" | "id_number" | "merchant"; what: "closed_account" | "rejected" | "blacklisted"; userId: string; applicationId: string | null; number: string | null; label: string; at: string | null; reason: string | null };
export const matchText = (m: SellerMatch) => `Same ${m.kind === "email" ? "email" : m.kind === "id_number" ? "KYC ID number" : "merchant name"} as ${m.what === "closed_account" ? `a closed account (${m.label})` : `${m.number ?? "an application"} (${m.what === "blacklisted" ? "Blacklisted" : "Rejected"}${m.reason ? `: “${m.reason}”` : ""})`}`;
export type SellerRow = { id: string; number: string; status: SellerStatus; tab: SellerTab; sellerType: SellerType; merchantName: string; name: string; email: string; userId: string; businessCountry: string; fileCount: number; freeze: number; createdAt: string; matches: number };
export type SellerEvent = { action: string; detail: string; by: string | null; createdAt: string };
export type SellerDetail = SellerRow & { answers: Answers; idType: string; idNumber: string; idLast4: string; files: SellerFile[]; events: SellerEvent[]; matchList: SellerMatch[];
  termsVersion: string | null; termsAcceptedAt: string | null; decidedAt: string | null; decidedBy: string | null; reason: string | null; blacklistReason: string | null; accountClosed: boolean };
export type SellerAction = "approve" | "reject" | "blacklist" | "unblacklist";
export const eventText = (e: Pick<SellerEvent, "action" | "detail">) => ({ submitted: "Application submitted", viewed: `Viewed ${e.detail}`, downloaded: `Downloaded ${e.detail}`, approve: "Approved", reject: `Rejected: ${e.detail}`, blacklist: `Blacklisted: ${e.detail}`, unblacklist: `Removed from blacklist: ${e.detail}` } as Record<string, string>)[e.action] ?? `${e.action}: ${e.detail}`;
// "Apply again" after a rejection: the old answers as a new draft (no files, no document number, no ticks).
export function reapplyInput(a: Answers): SellerInput {
  const base = emptySellerInput();
  if (!isV2(a)) return { ...base, firstName: a.firstName ?? "", lastName: a.lastName ?? "", merchantName: a.merchantName ?? "", storeUrl: a.storeUrl ?? "", businessCountry: a.businessCountry ?? "", citizenship: a.citizenship ?? "", sellerType: a.isCompany ? "business" : "individual", companyName: a.companyName ?? "", companyReg: a.companyReg ?? "", companyTax: a.companyTax ?? "" };
  const { v: _v, ...rest } = a;
  return { ...base, ...rest, idType: rest.idType, suppliers: rest.suppliers.map((s) => ({ ...s, files: [] })) };
}
