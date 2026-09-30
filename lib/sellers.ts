// T3 seller application (Kinguin-style "Sell on CoreCart"). Shared by /sell/apply, the admin pages, the demo store and the server.
// Everyone signs up as a customer; a customer applies in 4 steps; an admin with the "Seller applications" section approves (role seller),
// rejects (reason) or blacklists (reason). Nothing is deleted: rejected, blacklisted and closed records stay, and a new application or
// sign-up with the same email, KYC ID number or merchant name is flagged to the admin with a link to the old record.
import { isCountry } from "./profile";

export const SOURCES = ["Publisher / developer", "Official distributor", "Retail stores", "Other marketplaces", "Other"] as const;
export const STOCK_SIZES = ["Under 100", "100–1,000", "1,000–10,000", "Over 10,000"] as const;
export const PRODUCT_TYPES = ["Game keys", "Gift cards", "Software", "DLC / in-game items", "Hardware"] as const;
export const HEARD_FROM = ["Search engine", "Social media", "Friend or colleague", "Other marketplace", "Advertisement", "Other"] as const;
export const ID_TYPES = [{ id: "national_id", label: "National ID card" }, { id: "passport", label: "Passport" }, { id: "driving_licence", label: "Driving licence" }] as const;
export type IdType = (typeof ID_TYPES)[number]["id"];
export const idTypeLabel = (t: string) => ID_TYPES.find((x) => x.id === t)?.label ?? t;

// Files: images (JPEG / PNG / WebP) or PDF (invoices only), 5 MB each, checked by content (magic bytes), never by name.
export type FileKind = "invoice" | "key" | "id_front" | "id_back" | "selfie";
export const FILE_KINDS: { id: FileKind; label: string; pdf: boolean; max: number }[] = [
  { id: "invoice", label: "Sample invoice", pdf: true, max: 5 },
  { id: "key", label: "Photo of keys", pdf: false, max: 5 },
  { id: "id_front", label: "ID front", pdf: false, max: 1 },
  { id: "id_back", label: "ID back", pdf: false, max: 1 },
  { id: "selfie", label: "Selfie with ID", pdf: false, max: 1 },
];
export const isFileKind = (k: unknown): k is FileKind => FILE_KINDS.some((x) => x.id === k);
export const fileKindLabel = (k: string) => FILE_KINDS.find((x) => x.id === k)?.label ?? k;
export const FILE_MAX_BYTES = 5 * 1024 * 1024;
export const FILE_UPLOAD_LIMIT = { max: 40, windowMs: 10 * 60_000 }; // uploads per user
export const SENSITIVE_KINDS: FileKind[] = ["id_front", "id_back", "selfie", "key"]; // every view is audited (all kinds are, these are marked)
export type FileMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
export function sniffMime(b: Uint8Array): FileMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}
// null = ok, else the error text.
export function checkFile(kind: FileKind, bytes: Uint8Array): string | null {
  if (!bytes.length) return SELL_ERRORS.fileEmpty;
  if (bytes.length > FILE_MAX_BYTES) return SELL_ERRORS.fileBig;
  const mime = sniffMime(bytes);
  if (!mime) return SELL_ERRORS.fileType;
  if (mime === "application/pdf" && !FILE_KINDS.find((k) => k.id === kind)!.pdf) return SELL_ERRORS.fileImageOnly;
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

export type SellerInput = {
  firstName: string; lastName: string; merchantName: string; storeUrl: string; profiles: string; why: string;
  sources: string[]; businessCountry: string; citizenship: string; stockSize: string; productTypes: string[]; heardFrom: string;
  isCompany: boolean; companyName: string; companyReg: string; companyTax: string; companyAddress: string;
  idType: IdType | ""; idNumber: string; confirm: boolean;
  files: { invoice: string[]; key: string[]; id_front: string[]; id_back: string[]; selfie: string[] }; // uploaded file ids per kind
};
export const emptySellerInput = (): SellerInput => ({ firstName: "", lastName: "", merchantName: "", storeUrl: "", profiles: "", why: "", sources: [], businessCountry: "", citizenship: "", stockSize: "", productTypes: [], heardFrom: "",
  isCompany: false, companyName: "", companyReg: "", companyTax: "", companyAddress: "", idType: "", idNumber: "", confirm: false, files: { invoice: [], key: [], id_front: [], id_back: [], selfie: [] } });

export const SELL_ERRORS = {
  firstName: "Enter your first name.", lastName: "Enter your last name.",
  merchant: "Merchant name: 3–40 letters, numbers, spaces, dots or dashes.", merchantTaken: "This merchant name is taken. Choose another.", merchantOpen: "Another open application uses this merchant name, so this one cannot go back to Pending. Reject or blacklist the other first.",
  url: "Enter a full web address starting with https:// (or leave it empty).", profiles: "Up to 10 profile links, 300 characters each.",
  why: "Tell us why you want to sell (20–1000 characters).",
  sources: "Pick at least one source.", country: "Choose a country.", citizenship: "Choose your citizenship.", stock: "Choose how many codes you have.",
  types: "Pick at least one product type.", heard: "Tell us how you heard about us.",
  invoices: "Upload 1–5 sample invoices.", keys: "Upload 1–5 photos of keys you hold.",
  companyName: "Enter the company name.", companyReg: "Enter the registration number.", companyTax: "Enter the tax ID / VAT number.", companyAddress: "Enter the company address.",
  idType: "Choose the ID type.", idNumber: "Enter the ID number (4–30 letters or numbers).", idFront: "Upload the front of your ID.", idBack: "Upload the back of your ID.",
  confirm: "Confirm that the details are true.",
  fileEmpty: "The file is empty.", fileBig: "Files can be 5 MB at most.", fileType: "Use a JPG, PNG, WebP or PDF file.", fileImageOnly: "Use a JPG, PNG or WebP image.",
  fileBad: "One of the files is missing. Upload it again.", uploadLimit: "Too many uploads. Wait a few minutes and try again.",
  pending: "You already have an application under review.", approved: "You are already a seller.", verify: "Verify your email first.",
  closed: "This account is closed.", notFound: "Application not found.", reason: "Enter a reason (3–500 characters).",
  notPending: "Only a pending application can be approved or rejected.", notBlacklisted: "This application is not blacklisted.", already: "Already blacklisted.",
} as const;
export type SellerErrors = Partial<Record<keyof SellerInput | "idFront" | "idBack" | "invoices" | "keys", string>>;

const trim = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : []);
const ids = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[\w-]{8,64}$/.test(x)))].slice(0, max) : []);
export const cleanMerchant = (s: string) => s.trim().replace(/\s+/g, " ");
export const merchantKey = (s: string) => cleanMerchant(s).toLowerCase().replace(/[^a-z0-9]/g, ""); // "Key-Shop Ltd." = "keyshopltd"
export const cleanIdNumber = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Parse any body into a SellerInput (unknown keys dropped, strings trimmed). Checks come from checkStep.
export function parseSellerInput(b: Record<string, unknown>): SellerInput {
  const f = (b.files ?? {}) as Record<string, unknown>;
  return {
    firstName: trim(b.firstName, 60), lastName: trim(b.lastName, 60), merchantName: cleanMerchant(trim(b.merchantName, 60)), storeUrl: trim(b.storeUrl, 300), profiles: trim(b.profiles, 3200), why: trim(b.why, 1200),
    sources: list(b.sources, SOURCES), businessCountry: trim(b.businessCountry, 2), citizenship: trim(b.citizenship, 2), stockSize: STOCK_SIZES.includes(b.stockSize as never) ? (b.stockSize as string) : "",
    productTypes: list(b.productTypes, PRODUCT_TYPES), heardFrom: HEARD_FROM.includes(b.heardFrom as never) ? (b.heardFrom as string) : "",
    isCompany: b.isCompany === true, companyName: trim(b.companyName, 120), companyReg: trim(b.companyReg, 60), companyTax: trim(b.companyTax, 60), companyAddress: trim(b.companyAddress, 400),
    idType: ID_TYPES.some((t) => t.id === b.idType) ? (b.idType as IdType) : "", idNumber: trim(b.idNumber, 40), confirm: b.confirm === true,
    files: { invoice: ids(f.invoice, 5), key: ids(f.key, 5), id_front: ids(f.id_front, 1), id_back: ids(f.id_back, 1), selfie: ids(f.selfie, 1) },
  };
}

export const STEPS = ["Personal", "Stock", "Company", "KYC"] as const;
// Errors of one step (0-3) or of all steps (undefined). Same checks in the browser, the demo store and the API.
export function checkSeller(i: SellerInput, step?: number): SellerErrors {
  const e: SellerErrors = {}; const all = step === undefined;
  if (all || step === 0) {
    if (!i.firstName) e.firstName = SELL_ERRORS.firstName;
    if (!i.lastName) e.lastName = SELL_ERRORS.lastName;
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .\-]{1,38}[\p{L}\p{N}.]$/u.test(i.merchantName)) e.merchantName = SELL_ERRORS.merchant;
    if (i.storeUrl && !/^https:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(i.storeUrl)) e.storeUrl = SELL_ERRORS.url;
    const lines = i.profiles.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 10 || lines.some((l) => l.length > 300)) e.profiles = SELL_ERRORS.profiles;
    if (i.why.length < 20 || i.why.length > 1000) e.why = SELL_ERRORS.why;
  }
  if (all || step === 1) {
    if (!i.sources.length) e.sources = SELL_ERRORS.sources;
    if (!isCountry(i.businessCountry)) e.businessCountry = SELL_ERRORS.country;
    if (!isCountry(i.citizenship)) e.citizenship = SELL_ERRORS.citizenship;
    if (!i.stockSize) e.stockSize = SELL_ERRORS.stock;
    if (!i.productTypes.length) e.productTypes = SELL_ERRORS.types;
    if (!i.heardFrom) e.heardFrom = SELL_ERRORS.heard;
    if (!i.files.invoice.length) e.invoices = SELL_ERRORS.invoices;
    if (!i.files.key.length) e.keys = SELL_ERRORS.keys;
  }
  if ((all || step === 2) && i.isCompany) {
    if (!i.companyName) e.companyName = SELL_ERRORS.companyName;
    if (!i.companyReg) e.companyReg = SELL_ERRORS.companyReg;
    if (!i.companyTax) e.companyTax = SELL_ERRORS.companyTax;
    if (!i.companyAddress) e.companyAddress = SELL_ERRORS.companyAddress;
  }
  if (all || step === 3) {
    if (!i.idType) e.idType = SELL_ERRORS.idType;
    if (!/^[A-Z0-9]{4,30}$/.test(cleanIdNumber(i.idNumber))) e.idNumber = SELL_ERRORS.idNumber;
    if (!i.files.id_front.length) e.idFront = SELL_ERRORS.idFront;
    if (i.idType !== "passport" && !i.files.id_back.length) e.idBack = SELL_ERRORS.idBack;
    if (!i.confirm) e.confirm = SELL_ERRORS.confirm;
  }
  return e;
}
export const firstBadStep = (e: SellerErrors) => {
  const steps: (keyof SellerErrors)[][] = [["firstName", "lastName", "merchantName", "storeUrl", "profiles", "why"], ["sources", "businessCountry", "citizenship", "stockSize", "productTypes", "heardFrom", "invoices", "keys"], ["companyName", "companyReg", "companyTax", "companyAddress"], ["idType", "idNumber", "idFront", "idBack", "confirm"]];
  const i = steps.findIndex((s) => s.some((k) => e[k])); return i < 0 ? null : i;
};
export const reasonOk = (r: unknown): r is string => typeof r === "string" && r.trim().length >= 3 && r.trim().length <= 500;
export const SELLER_ADMIN_LIMIT = { max: 120, windowMs: 60_000 }; // admin decisions per admin

// What the applicant sees (never ID number or files).
export type MyApplication = { id: string; number: string; status: SellerStatus; merchantName: string; createdAt: string; decidedAt: string | null; reason: string | null };
// Returning-person flags: same email / KYC ID number / merchant name as a closed account or a rejected / blacklisted application.
export type SellerMatch = { kind: "email" | "id_number" | "merchant"; what: "closed_account" | "rejected" | "blacklisted"; userId: string; applicationId: string | null; number: string | null; label: string; at: string | null; reason: string | null };
export const matchText = (m: SellerMatch) => `Same ${m.kind === "email" ? "email" : m.kind === "id_number" ? "KYC ID number" : "merchant name"} as ${m.what === "closed_account" ? `a closed account (${m.label})` : `${m.number ?? "an application"} (${m.what === "blacklisted" ? "Blacklisted" : "Rejected"}${m.reason ? `: “${m.reason}”` : ""})`}`;
export type SellerRow = { id: string; number: string; status: SellerStatus; tab: SellerTab; merchantName: string; name: string; email: string; userId: string; businessCountry: string; isCompany: boolean; createdAt: string; matches: number };
export type SellerEvent = { action: string; detail: string; by: string | null; createdAt: string };
export type SellerDetail = SellerRow & Omit<SellerInput, "files" | "confirm" | "idNumber"> & { idNumber: string; idLast4: string; files: SellerFile[]; events: SellerEvent[]; matchList: SellerMatch[]; decidedAt: string | null; decidedBy: string | null; reason: string | null; blacklistReason: string | null; accountClosed: boolean };
export type SellerAction = "approve" | "reject" | "blacklist" | "unblacklist";
export const eventText = (e: Pick<SellerEvent, "action" | "detail">) => ({ submitted: "Application submitted", viewed: `Viewed ${e.detail}`, downloaded: `Downloaded ${e.detail}`, approve: "Approved", reject: `Rejected: ${e.detail}`, blacklist: `Blacklisted: ${e.detail}`, unblacklist: `Removed from blacklist: ${e.detail}` } as Record<string, string>)[e.action] ?? `${e.action}: ${e.detail}`;
