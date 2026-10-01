import { BASE_CURRENCY, DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/currency/currencies";
import { convertMinor, crossRate, formatMoney } from "@/lib/currency/money";
import fallbackRates from "@/lib/currency/fallback-rates.json";
import { allProducts, cleanCart, cleanFavorites, coverFor, mergeCarts, mergeFavorites, productById, maxQty, MAX_FAVORITES, type CartEntry } from "@/lib/catalog";
import { demoAdminCurrencies, demoCurrencies, demoRefreshRates, demoUpdateCurrency } from "./demo-currency";
import { LOGIN_HISTORY_DAYS, isAvatar, isCountry, maskIp } from "@/lib/profile";
import { checkPromoInput, cleanPromoCode, PROMO_CODE_RE, PROMO_ERRORS, promoStatus, toPublic, VALIDATE_LIMIT, WELCOME10, type PromoCode } from "@/lib/promo";
import { checkNewGiftCards, generateCode, giftCardStatus, hashCode, maskedCode, normalizeCode, REDEEM_ERRORS, REDEEM_LIMIT, withBalances, type BalanceData, type GiftCard, type LedgerRow } from "@/lib/gift-cards";
import { checkNewReturn, checkStatusChange, eligibility, holdsUnits, NOT_ELIGIBLE, RETURN_HOLD, returnNumber, type ReturnRequest, type ReturnStatus } from "@/lib/returns";
import { categoryLabel, checkBody, checkNewTicket, cleanOrderRef, isTicketStatus, NEW_TICKET_LIMIT, TICKET_ERRORS, type Ticket, type TicketCategory, type TicketStatus, type TicketThread } from "@/lib/tickets";
import { checkNewUser, cleanEmail, isRole, signupRole, USER_ADMIN_LIMIT, USER_ERRORS } from "@/lib/users";
import { ADJUST_ERRORS, ADJUST_LIMIT, checkAdjustment, parseAdjustment, signedAmount, type AdminWallet } from "@/lib/wallet";
import { BANK_CURRENCY_ERROR, BANK_DEFAULTS, BANK_ERRORS, BANK_OPEN_MAX, BANK_PENDING_MS, BANK_WRITE_LIMIT, bankChange, bankReady, checkAmount, cleanBankSettings, checkDailyCap, closeReasonOk, dailyCapThb, DAY_MS, isExpiredNow, parseBankSettings, parseNewTopUp, PENDING_MS, receivedMismatch, TOPUP_ERRORS, TOPUP_LIMIT, TOPUP_PAGE_SIZE, topUpLimits, topUpNumber, transferRef, USD_RATE, type AdminTopUp, type AdminTopUpDetail, type BankInfo, type BankSettings, type TopUp } from "@/lib/topup";
import { addOption, deleteOption, FILTER_ERRORS, mergeCatalog, updateGroup, updateOption, type FilterConfig } from "@/lib/filters";
import { addMenuItem, DEFAULT_MENU, deleteMenuItem, MENU_ERRORS, MENU_WRITE_LIMIT, parseMenuInput, parseMenuPatch, updateMenuItem, type MenuEdit, type MenuInput, type MenuItem } from "@/lib/menu";
import { ADMIN_PRODUCT_LIMIT, dataUrlBytes, imageOk, parseProduct, PRODUCT_ERRORS } from "@/lib/products";
import { demoCatalogAll, saveDemoCatalog } from "./demo-catalog";
import { emptyCounts, KEY_ERRORS, KEY_UPLOAD_LIMIT, KEYS_PER_UPLOAD, parseKeyText, type KeyCounts, type KeyStatus } from "@/lib/key-inventory";
import { ALL_PERMS, cleanPerms, hasAdminAccess, hasPerm, isAdminRole, isMasterRole, parsePerms, PERM_ERRORS, permsAfterRole, permsOf, permsText, roleChangeError, type AdminPerm } from "@/lib/admin-perms";
import { applicantName, applicationNumber, checkFile, checkSeller, cleanIdNumber, completedSteps, draftProgress, DRAFT_LIMIT, emptySellerInput, FILE_UPLOAD_LIMIT, fileKindLabel, firstBadStep, freezeDays, greetingName, isBusiness, isSellerType, merchantKey, parseSellerInput, reasonOk, SELL_ERRORS, SELLER_ADMIN_LIMIT, sniffMime, STEP_LABEL, stepsFor, storedAnswers, tabOf, usedFiles,
  type Answers, type MyApplication, type SellerDetail, type SellerDraft, type SellerFile, type SellerInput, type SellerMatch, type SellerRow, type SellerStatus, type SellerTab, type SellerType, type StepId } from "@/lib/sellers";
import { CLOSE_ERRORS, CLOSE_WORD, claimPlaceholder, closedPlaceholder } from "@/lib/account-close";
import { TERMS_ERROR, TERMS_VERSION } from "@/lib/terms";
import { emailMoney, emailTime, renderEmail, sampleEmail, VERIFY_CODE_MINUTES, type EmailData, type EmailId, type EmailItem } from "@/lib/emails";
import { canRate, chargeRows, checkRating, COMPANY, CORECART_SELLER, parseTaxInfo, paymentText, RATING_ERRORS, sellersOf, type Rating } from "@/lib/orders";
import { deviceName } from "@/lib/device";
import { isBuyerRole, parsePopupSettings, pickRecent, POPUP_DEFAULTS, POPUP_ERRORS, POPUP_ORDER_STATUSES, POPUP_WRITE_LIMIT, popupChange, type PopupSettings } from "@/lib/purchase-popup";
import { ADDRESS_ERRORS, checkAddress, sameAddress, type BillingAddress } from "@/lib/address-formats";
import { charges, FEE_DEFAULTS, FEE_ERRORS, FEE_WRITE_LIMIT, feeChange, parseFeeSettings, type FeeSettings } from "@/lib/fees";
import type { AccountApi, AdminApi, AdminLogin, AdminUserRow, GameKey, Order, OrderItem, PaymentMethod, SentMail, SessionUser } from "./types";

// GitHub Pages demo: everything lives in this browser's localStorage. No server, no real accounts.
type DemoUser = SessionUser & { passwordHash?: string; salt?: string; provider: "email" | "google"; marketingOptIn?: boolean; sample?: boolean; adminPerms?: string[] | null; // adminPerms: T2 sections (missing = all)
  status?: "active" | "closed"; closedAt?: string | null; closedById?: string | null; closedReason?: string | null; closedEmail?: string | null; // T3 close account
  claimEmail?: string | null; termsVersion?: string | null; termsAcceptedAt?: string | null; billingAddress?: BillingAddress | null; topupRef?: string }; // topupRef: bank transfer reference (top-up redesign); billingAddress: task 5; R1 claim of a closed account's email, R7 terms proof
type DemoAudit = { userId: string; adminId: string; action: string; detail: string; createdAt: string };
type DemoLogin = AdminLogin & { userId: string };
type Token = { token: string; type: "verify" | "reset"; email: string; expires: number; code?: string; codeExpires?: number; codeTries?: number }; // code = 6-digit verify code (email task)
type Store = { users: DemoUser[]; sessionUserId: string | null; tokens: Token[]; orders: Record<string, Order[]>; cards: Record<string, PaymentMethod[]>; logins: DemoLogin[]; carts: Record<string, CartEntry[]>; keys: Record<string, DemoKey[]>; reveals: DemoReveal[]; favorites: Record<string, string[]>; adminSeeded?: boolean;
  giftCards: DemoGiftCard[]; ledger: Record<string, DemoLedger[]>; redeemTries: Record<string, number[]>; giftSeeded?: boolean;
  promos: PromoCode[]; promoMisses: number[]; promoSeeded?: boolean; returns: DemoReturn[];
  tickets: DemoTicket[]; ticketMessages: DemoTicketMessage[]; ticketTries: Record<string, number[]>; filters?: FilterConfig; menu?: MenuItem[]; audit?: DemoAudit[];
  topUps?: DemoTopUp[]; payEvents?: DemoPayEvent[]; productKeys?: DemoProductKey[]; masterSeeded?: boolean;
  sellerApps?: DemoApp[]; sellerFiles?: DemoSellerFile[]; sellerEvents?: DemoSellerEvent[]; sellerDrafts?: DemoDraft[];
  popup?: PopupSettings; popupEvents?: { adminId: string; detail: string; createdAt: string }[]; // purchase popup settings + audit
  fees?: FeeSettings; feeEvents?: { adminId: string; detail: string; createdAt: string }[]; // task 7 fee + tax settings + audit
  bank?: BankSettings; bankEvents?: { adminId: string; detail: string; createdAt: string }[]; // top-up redesign: bank transfer details + audit
  outbox?: SentMail[]; devices?: { userId: string; device: string }[]; ratings?: (Rating & { userId: string; orderId: string })[] }; // email task
// T3 demo seller applications: same rules as lib/server/sellers.ts. ID number kept plain in this browser only (the server encrypts it).
type DemoApp = { id: string; seq: number; userId: string; email: string; status: SellerStatus; sellerType?: SellerType; data: Answers; merchantName: string; merchantKey: string; idType: string; idNumber: string;
  termsVersion?: string | null; termsAcceptedAt?: string | null; decidedAt: string | null; decidedById: string | null; reason: string | null; blacklistReason: string | null; statusBefore: SellerStatus | null; createdAt: string };
// Demo files: images shrunk to 1000 px JPEG in this browser; PDFs keep name + size only (dataUrl null).
type DemoSellerFile = SellerFile & { userId: string; applicationId: string | null; dataUrl: string | null };
type DemoSellerEvent = { applicationId: string; adminId: string | null; action: string; detail: string; createdAt: string };
// Demo draft (one per user, like seller_draft): the whole input incl. the document number, plain in this browser only.
type DemoDraft = { userId: string; input: SellerInput; completed: string[]; submittedApplicationId: string | null; discardedAt: string | null; updatedAt: string };
// Demo key inventory (task B): plain text in this browser only (the server encrypts). Only the last 4 characters leave this module.
type DemoProductKey = { id: string; productId: string; code: string; status: KeyStatus; batch: string | null; createdAt: string };
type DemoReturn = ReturnRequest & { userId: string };
type DemoLedger = Omit<LedgerRow, "balanceMinor"> & { byId?: string }; // byId = admin who made an adjustment (S8)
type DemoTicket = { id: string; number: number; userId: string; category: TicketCategory; subject: string; status: TicketStatus; orderId: string | null; orderRef?: string | null; keyId: string | null; customerUnread: boolean; lastReplyAt: string; lastReplyBy: "customer" | "support"; createdAt: string };
type DemoTicketMessage = { id: string; ticketId: string; fromSupport: boolean; body: string; createdAt: string };
type DemoGiftCard = Omit<GiftCard, "redeemedBy"> & { codeHash: string; redeemedById: string | null };
type DemoKey = { id: string; orderItemId: string; code: string; revealedAt: string | null };
type DemoReveal = { keyId: string; userId: string; userAgent: string; createdAt: string };
const KEY = "corecart-demo-v1";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
// Built-in demo admin (GitHub Pages only, this browser only). Server mode has no such account: admins come from npm run admin:create.
export const DEMO_ADMIN = { email: "admin@corecart.demo", password: "CoreCartDemoAdmin2026", name: "Demo Admin" };
// T2: the demo admin is the master admin of the demo store (every section, manages admins).
const demoAdmin = (): DemoUser => ({ id: "demo-admin", name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, emailVerified: true, role: "master_admin", createdAt: "2026-09-01T00:00:00.000Z", provider: "email",
  salt: "CCDEMOADMIN1", passwordHash: "6f4ac9d1a7a31c7c7602c95975f4b1bb73a916bc776bfdea5ec730e25720b45f" }); // SHA-256 of salt:password, same scheme as hash()
const empty = (): Store => ({ users: [demoAdmin()], sessionUserId: null, tokens: [], orders: {}, cards: {}, logins: [], carts: {}, keys: {}, reveals: [], favorites: {}, giftCards: [], ledger: {}, redeemTries: {}, promos: [], promoMisses: [], returns: [], tickets: [], ticketMessages: [], ticketTries: {} });

function load(): Store {
  let s: Store;
  try { const raw = localStorage.getItem(KEY); s = raw ? { ...empty(), ...JSON.parse(raw) } : empty(); } catch { s = empty(); }
  if (!s.users.some((u) => u.id === "demo-admin")) s.users.unshift(demoAdmin()); // older demo data
  // T2, once: the built-in demo admin of older demo data becomes master admin (other admins keep every section until the master changes them).
  if (!s.masterSeeded) { const d = s.users.find((u) => u.id === "demo-admin"); if (d && d.role === "admin") d.role = "master_admin"; s.masterSeeded = true; save(s); }
  // Promo codes live in this browser. WELCOME10 is seeded once (the demo admin may edit or delete it).
  if (!s.promoSeeded) { s.promos.push({ ...WELCOME10, id: "demo-welcome10", uses: 0, createdAt: WELCOME10.startsAt, updatedAt: WELCOME10.startsAt }); s.promoSeeded = true; save(s); }
  return s;
}
// Filter config (S4) in this browser; catalog values merged in on read.
function demoFilters(s: Store) { const cfg = mergeCatalog(s.filters ?? { groups: [], options: [] }, id); if (JSON.stringify(cfg) !== JSON.stringify(s.filters)) { s.filters = cfg; save(s); } return cfg; }
function save(s: Store) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; /* storage blocked */ } }
const id = () => crypto.randomUUID();
const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
async function hash(password: string, salt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
const publicUser = (u: DemoUser): SessionUser => ({ id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, image: u.image, role: u.role, createdAt: u.createdAt, currency: u.currency ?? null,
  avatar: u.avatar ?? null, country: u.country ?? null, marketingOptIn: Boolean(u.marketingOptIn), marketingChoiceAt: u.marketingChoiceAt ?? null });
function issue(s: Store, type: Token["type"], email: string, next?: string) {
  const token = rand(24);
  s.tokens = s.tokens.filter((t) => !(t.email === email && t.type === type));
  const code = type === "verify" ? String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0") : undefined;
  s.tokens.push({ token, type, email, expires: Date.now() + 3600_000, code, codeExpires: code ? Date.now() + VERIFY_CODE_MINUTES * 60_000 : undefined, codeTries: 0 });
  return `${base}/${type === "verify" ? "verify-email" : "reset-password"}/?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
}
const codeOf = (s: Store, email: string) => s.tokens.find((t) => t.email === email && t.type === "verify")?.code ?? "";
// ---- Email task: the demo keeps every email in this browser (admin /admin/emails "Demo outbox"), same templates as the server. ----
const siteBase = () => (typeof window === "undefined" ? "" : `${window.location.origin}${base}`);
const fullLink = (link: string) => (typeof window === "undefined" ? link : `${window.location.origin}${link}`);
const absCover = (name: string) => { const c = coverFor(name); return c ? (c.startsWith("/") ? `${siteBase()}${c}` : c) : null; };
function demoMail<K extends EmailId>(s: Store, to: string | undefined, idK: K, data: EmailData[K]) {
  if (!to) return;
  const out = (s.outbox ??= []); out.push({ to, ...renderEmail(idK, data, siteBase()), template: idK, sentAt: new Date().toISOString() });
  if (out.length > 50) out.splice(0, out.length - 50);
}
const userOf = (s: Store, userId: string) => s.users.find((u) => u.id === userId);
const thbText = (minor: number) => emailMoney(minor, "THB");
const demoFacts = (name: string) => ({ name, when: emailTime(new Date()), device: deviceName(typeof navigator === "undefined" ? null : navigator.userAgent), ip: "demo", location: "Bangkok, Thailand (sample location)" });
// Device id of this browser (the server uses an httpOnly cookie). A sign-in from a device the account never used → "New sign-in" email (not for the first device).
function demoDevice(s: Store, u: DemoUser) {
  let dev = ""; try { dev = localStorage.getItem("corecart-demo-device") ?? ""; if (!dev) { dev = rand(20); localStorage.setItem("corecart-demo-device", dev); } } catch { dev = "no-storage"; }
  const list = (s.devices ??= []); if (list.some((d) => d.userId === u.id && d.device === dev)) return;
  const had = list.some((d) => d.userId === u.id); list.push({ userId: u.id, device: dev });
  if (had) demoMail(s, u.email, "newSignIn", demoFacts(u.name));
}
const emailLines = (o: Order): EmailItem[] => o.items.map((i) => ({ name: i.name, sub: `${i.kind === "game_key" ? "Digital product" : "Hardware"} · Qty ${i.quantity} · ${emailMoney(i.unitPriceCents * i.quantity, o.currency)}`, image: absCover(i.name), seller: i.seller || CORECART_SELLER,
  ...(i.kind === "game_key" ? { keyUrl: `${siteBase()}/account/keys/get?item=${encodeURIComponent(i.id)}` } : {}) }));
function mailOrder(s: Store, u: DemoUser, o: Order) {
  if (o.status === "pending" || o.status === "cancelled") demoMail(s, u.email, "paymentFailed", { name: u.name, orderId: o.id, number: o.number, items: emailLines(o) });
  else demoMail(s, u.email, "orderConfirmed", { name: u.name, orderId: o.id, number: o.number, date: emailTime(o.paidAt ?? o.createdAt), total: emailMoney(o.totalCents, o.currency), payment: paymentText(o.paymentMethod, o.paymentLast4), items: emailLines(o), charges: chargeRows(o, (m) => emailMoney(m, o.currency)) });
}
// Sample orders: prices in THB, charged in USD at the committed fallback rates. Stores amount, currency and rate used.
type SampleItem = Omit<OrderItem, "id" | "quantity" | "unitPriceCents"> & { thb: number };
const key = () => `DEMO-${rand(5)}-${rand(5)}-${rand(5)}`;
function sampleOrder(status: string, createdAt: number, items: SampleItem[]): Order {
  const r = fallbackRates.rates as Record<string, number>;
  const from = { code: BASE_CURRENCY, decimals: 2, rate: String(r[BASE_CURRENCY]) }; const to = { code: DEFAULT_CURRENCY, decimals: 2, rate: "1" };
  const lines = items.map(({ thb, ...i }) => ({ ...i, id: id(), quantity: 1, unitPriceCents: convertMinor(thb, from, to), productId: allProducts().find((p) => p.name === i.name)?.id ?? null, seller: CORECART_SELLER }));
  const total = lines.reduce((t, i) => t + i.unitPriceCents, 0); const at = new Date(createdAt).toISOString();
  return { id: id(), number: `CC-${rand(8)}`, status, currency: to.code, totalCents: total, baseCurrency: BASE_CURRENCY,
    baseTotalMinor: items.reduce((t, i) => t + i.thb, 0), fxRate: crossRate(from, to), ratesAt: fallbackRates.updatedAt, isSample: true, createdAt: at, items: lines,
    paymentMethod: "card", paymentLast4: "4242", paidAt: status === "pending" || status === "cancelled" ? null : at, subtotalMinor: total, discountMinor: 0, promoCode: null, walletMinor: 0, taxInfo: null };
}
// Task 7: same fee + tax rules as the server (lib/fees.ts), tax country = billing address, else account country, else the store's.
function withCharges(s: Store, u: DemoUser, o: Order): Order {
  const c = charges(s.fees ?? FEE_DEFAULTS, o.baseTotalMinor ?? 0, u.billingAddress?.country ?? u.country ?? COMPANY.country);
  const r = fallbackRates.rates as Record<string, number>; const from = { code: BASE_CURRENCY, decimals: 2, rate: String(r[BASE_CURRENCY]) }; const to = { code: o.currency, decimals: 2, rate: "1" };
  const serviceFeeMinor = convertMinor(c.fee, from, to), taxMinor = convertMinor(c.tax ?? 0, from, to);
  return { ...o, serviceFeeMinor, taxMinor, taxRateBp: c.taxBp ?? 0, billing: u.billingAddress ?? null, totalCents: o.totalCents + serviceFeeMinor + taxMinor, baseTotalMinor: c.total };
}
function seedOrders(s: Store, userId: string) {
  if (s.orders[userId]?.length) return;
  const now = Date.now();
  s.orders[userId] = [
    sampleOrder("completed", now - 86400_000 * 2, [
      { name: "Elden Ring", kind: "game_key", platform: "Steam", region: "Global", thb: 99000, demoKey: key() },
      { name: "Cyberpunk 2077", kind: "game_key", platform: "Steam", region: "Global", thb: 62900, demoKey: key() },
    ]),
    sampleOrder("paid", now - 86400_000 * 9, [{ name: "Samsung 990 PRO 2TB NVMe SSD", kind: "hardware", thb: 569000 }]),
  ];
}
// One key per game_key unit. The first unit reuses the sample item demoKey. Returns true when new keys were made.
function ensureKeys(s: Store, userId: string) {
  const list = (s.keys[userId] ??= []); let made = false;
  for (const o of s.orders[userId] ?? []) for (const i of o.items) {
    if (i.kind !== "game_key") continue;
    for (let n = list.filter((k) => k.orderItemId === i.id).length; n < i.quantity; n++) { list.push({ id: id(), orderItemId: i.id, code: n === 0 && i.demoKey ? i.demoKey : key(), revealedAt: null }); made = true; }
  }
  return made;
}
function keyRows(s: Store, userId: string): GameKey[] {
  const out: GameKey[] = [];
  for (const o of [...(s.orders[userId] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) for (const i of o.items) for (const k of (s.keys[userId] ?? []).filter((x) => x.orderItemId === i.id))
    out.push({ id: k.id, orderId: o.id, orderNumber: o.number, orderItemId: i.id, name: i.name, platform: i.platform ?? null, region: i.region ?? null, priceMinor: i.unitPriceCents,
      currency: o.currency, createdAt: o.createdAt, revealedAt: k.revealedAt, code: k.revealedAt ? k.code : null });
  return out;
}
// Demo gift card so the redeem flow works without an admin (this browser only, single use like any card).
export const DEMO_GIFT = { code: "CCDM-GIFT-2026-0500", amountMinor: 50000 };
async function seedGift(s: Store) {
  if (s.giftSeeded) return;
  s.giftCards.push({ id: "demo-gift", codeHash: await hashCode(DEMO_GIFT.code), last4: DEMO_GIFT.code.slice(-4), amountMinor: DEMO_GIFT.amountMinor, note: "Built-in demo card", expiresAt: null,
    disabled: false, createdAt: "2026-09-01T00:00:00.000Z", createdBy: "demo-admin", redeemedAt: null, redeemedById: null });
  s.giftSeeded = true;
}
function balanceData(s: Store, userId: string): BalanceData {
  const rows = s.ledger[userId] ?? []; const sum = (b: string) => rows.filter((r) => r.bucket === b).reduce((t, r) => t + r.amountMinor, 0);
  return { walletMinor: sum("wallet"), giftMinor: sum("gift"), transactions: withBalances(rows.map(({ byId: _b, ...r }) => r)) };
}
// Admin view of the same ledger (S8): adds who made each adjustment.
function adminWalletOf(s: Store, userId: string): AdminWallet {
  const rows = s.ledger[userId] ?? []; const b = balanceData(s, userId);
  const by = (lid: string) => { const bid = rows.find((r) => r.id === lid)?.byId; return bid ? s.users.find((u) => u.id === bid)?.email ?? "Deleted admin" : null; };
  return { walletMinor: b.walletMinor, giftMinor: b.giftMinor, transactions: b.transactions.map((t) => ({ ...t, by: by(t.id) })) };
}
const adjustTries: number[] = [];
const userTries: number[] = [];
function userTry() { const now = Date.now(); while (userTries.length && now - userTries[0] > USER_ADMIN_LIMIT.windowMs) userTries.shift(); if (userTries.length >= USER_ADMIN_LIMIT.max) return false; userTries.push(now); return true; }
// Return rules need the line, its order and key counts (same facts as lib/server/returns.ts).
function lineFacts(s: Store, userId: string, itemId: string) {
  for (const o of s.orders[userId] ?? []) { const i = o.items.find((x) => x.id === itemId); if (!i) continue;
    const keys = (s.keys[userId] ?? []).filter((k) => k.orderItemId === itemId);
    const heldUnits = s.returns.filter((r) => r.orderItemId === itemId && holdsUnits(r.status)).reduce((t, r) => t + r.quantity, 0);
    return { order: o, item: i, facts: { kind: i.kind, quantity: i.quantity, orderStatus: o.status, orderCreatedAt: o.createdAt, keyCount: keys.length, unrevealedKeys: keys.filter((k) => !k.revealedAt).length, heldUnits } };
  }
  return null;
}
// Ticket rows with the order number and key name joined in (same shape as lib/server/tickets.ts).
function ticketRow(s: Store, t: DemoTicket, admin = false): Ticket {
  const order = (s.orders[t.userId] ?? []).find((o) => o.id === t.orderId) ?? null;
  const key = t.keyId ? keyRows(s, t.userId).find((k) => k.id === t.keyId) ?? null : null;
  const u = admin ? s.users.find((x) => x.id === t.userId) : undefined;
  return { id: t.id, number: t.number, category: t.category, subject: t.subject, status: t.status, orderId: t.orderId, orderNumber: order?.number ?? null, orderRef: t.orderRef ?? order?.number ?? null, keyId: t.keyId, keyName: key?.name ?? null,
    keyRevealedAt: key?.revealedAt ?? null, customerUnread: t.customerUnread, lastReplyAt: t.lastReplyAt, lastReplyBy: t.lastReplyBy, createdAt: t.createdAt,
    ...(admin ? { customerEmail: u?.email ?? "Deleted user", customerName: u?.name ?? "" } : {}) };
}
function ticketThread(s: Store, t: DemoTicket, admin = false): TicketThread {
  const name = s.users.find((x) => x.id === t.userId)?.name ?? "";
  return { ...ticketRow(s, t, admin), messages: s.ticketMessages.filter((m) => m.ticketId === t.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ id: m.id, fromSupport: m.fromSupport, author: m.fromSupport ? "CoreCart support" : name, body: m.body, createdAt: m.createdAt })) };
}
const publicReturn = ({ userId: _u, ...r }: DemoReturn) => r;
const current = (s: Store) => s.users.find((u) => u.id === s.sessionUserId && u.status !== "closed") ?? null; // T3: a closed account has no session
const logLogin = (s: Store, userId: string, method: string) => { s.logins.push({ userId, method, ipAddress: "demo", userAgent: navigator.userAgent, createdAt: new Date().toISOString() }); };
const wait = () => new Promise((r) => setTimeout(r, 350));

// Wallet top-ups (T1), demo store version. Same rules as lib/server/topups.ts; "Simulate" stands in for the provider webhook.
type DemoTopUp = TopUp & { userId: string; idempotencyKey: string; providerRef: string | null; fxRate: string; closedById: string | null; confirmedById?: string | null };
type DemoPayEvent = { id: string; eventId: string; type: string; topUpId: string; payload: string; result: string; receivedAt: string };
const publicTopUp = ({ userId: _u, idempotencyKey: _k, providerRef: _p, fxRate: _f, closedById: _c, confirmedById: _b, ...t }: DemoTopUp): TopUp => ({ ...t, method: t.method ?? "card" }); // rows from before the redesign = card
function expireDemoTopUps(s: Store) {
  const now = Date.now(); let changed = false;
  for (const t of s.topUps ?? []) if (isExpiredNow(t, now)) { Object.assign(t, { status: "expired", closedAt: new Date(now).toISOString(), failureReason: t.method === "bank" ? "No transfer arrived within 7 days." : "Not paid within 30 minutes." }); changed = true; }
  if (changed) save(s);
}
// Bank transfer (top-up redesign), demo version of lib/server/topups.ts bankInfo: null = not set up ("Coming soon").
const demoBank = (s: Store): BankSettings => (s.bank ? cleanBankSettings(s.bank) : { ...BANK_DEFAULTS });
async function demoBankInfo(s: Store, u: DemoUser): Promise<BankInfo | null> {
  const b = demoBank(s); if (!bankReady(b)) return null;
  const currencies = (await demoCurrencies()).currencies.map((c) => c.code); // every enabled currency
  if (!u.topupRef) { let r = transferRef(); while (s.users.some((x) => x.topupRef === r)) r = transferRef(); u.topupRef = r; save(s); }
  return { ...b, currencies, reference: u.topupRef };
}
const findTopUp = (s: Store, tid: string, userId?: string) => (s.topUps ?? []).find((t) => (t.id === tid || t.number === tid.toUpperCase()) && (!userId || t.userId === userId));
const topUpTries: number[] = []; // same per-user create limit as the server (per page load here)
// Demo "webhook": each event id once; a paid event credits once (one ledger row per top-up).
function demoWebhook(s: Store, payload: string): string {
  const ev = JSON.parse(payload) as { id: string; type: string; topUpId: string; amountMinor: number; currency: string; reason?: string };
  const events = (s.payEvents ??= []);
  if (events.some((e) => e.eventId === ev.id)) return "duplicate";
  const t = findTopUp(s, ev.topUpId); const at = new Date().toISOString(); let result: string;
  if (!t) result = "ignored: unknown top-up";
  else if (ev.type === "payment.succeeded") {
    if (t.status === "credited" || (s.ledger[t.userId] ?? []).some((r) => r.type === "top_up" && r.ref === t.number)) result = "ignored: already credited";
    else if (ev.amountMinor !== t.amountMinor || ev.currency !== t.currency) result = "error: amount mismatch";
    else {
      Object.assign(t, { status: "credited", paidAt: t.paidAt ?? at, creditedAt: at, closedAt: null, failureReason: t.status === "pending" ? null : `Paid after it was ${t.status}.` });
      (s.ledger[t.userId] ??= []).push({ id: id(), createdAt: at, bucket: "wallet", type: "top_up", ref: t.number, amountMinor: t.creditMinor });
      result = "credited";
    }
  } else if (t.status !== "pending") result = `ignored: top-up is ${t.status}`;
  else { Object.assign(t, { status: "failed", closedAt: at, failureReason: ev.reason ?? "The payment failed." }); result = "failed"; }
  events.push({ id: id(), eventId: ev.id, type: ev.type, topUpId: ev.topUpId, payload, result, receivedAt: at });
  return result;
}
function adminTopUpOf(s: Store, t: DemoTopUp): AdminTopUp {
  const who = (aid?: string | null) => (aid ? s.users.find((u) => u.id === aid)?.email ?? "Deleted admin" : null); const cu = s.users.find((u) => u.id === t.userId);
  return { ...publicTopUp(t), userId: t.userId, email: cu?.email ?? "Deleted user", providerRef: t.providerRef, fxRate: t.fxRate, closedBy: who(t.closedById), customerRef: cu?.topupRef ?? null, confirmedBy: who(t.confirmedById) };
}
const adminTopUpDetailOf = (s: Store, t: DemoTopUp): AdminTopUpDetail => ({ ...adminTopUpOf(s, t),
  events: (s.payEvents ?? []).filter((e) => e.topUpId === t.id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map((e) => ({ id: e.id, eventId: e.eventId, type: e.type, result: e.result, receivedAt: e.receivedAt })) });
const bangkokStart = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00+07:00`);
const bankTries: number[] = []; // bank detail saves per page load (the server counts per admin)
const bankHistoryOf = (s: Store) => [...(s.bankEvents ?? [])].reverse().slice(0, 20).map((e) => ({ at: e.createdAt, by: s.users.find((u) => u.id === e.adminId)?.email ?? null, detail: e.detail }));

// ---- T3 demo helpers (seller applications, close account) ----
const sellFileTries: number[] = []; // uploads per page load (the server counts per user in the database)
async function shrinkImage(file: File): Promise<string | null> {
  try {
    const img = await createImageBitmap(file); const k = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.75);
  } catch { return null; }
}
const latestApp = (s: Store, userId: string) => (s.sellerApps ?? []).filter((a) => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
const typeOf = (a: DemoApp): SellerType => a.sellerType ?? (isBusiness(a.data) ? "business" : "individual"); // older demo records have no sellerType
const myApp = (a: DemoApp): MyApplication => ({ id: a.id, number: applicationNumber(a.seq), status: a.status === "blacklisted" ? "rejected" : a.status, sellerType: typeOf(a), merchantName: a.merchantName, createdAt: a.createdAt, decidedAt: a.decidedAt,
  reason: a.status === "rejected" ? a.reason : a.status === "blacklisted" ? "Your application was not accepted." : null });
const fileView = ({ userId: _u, applicationId: _a, dataUrl: _d, ...f }: DemoSellerFile): SellerFile => f;
// Keep only this user's unsent uploads of the right kind (same as keepFiles on the server).
function demoKeepFiles(s: Store, userId: string, i: SellerInput): SellerInput {
  const ok = (kind: string) => (fid: string) => (s.sellerFiles ?? []).some((f) => f.id === fid && f.userId === userId && !f.applicationId && f.kind === kind);
  return { ...i, files: Object.fromEntries(Object.entries(i.files).map(([k, v]) => [k, v.filter(ok(k))])) as SellerInput["files"], suppliers: i.suppliers.map((x) => ({ ...x, files: x.files.filter(ok("supplier_proof")) })) };
}
function demoDraftOut(s: Store, d: DemoDraft): SellerDraft {
  const input = demoKeepFiles(s, d.userId, { ...parseSellerInput(d.input as unknown as Record<string, unknown>), idNumber: d.input.idNumber, confirm: false, terms: false });
  const ids = new Set([...Object.values(input.files).flat(), ...input.suppliers.flatMap((x) => x.files)]);
  const completed = completedSteps(input, d.completed);
  return { input, completed, progress: draftProgress(input, completed), files: (s.sellerFiles ?? []).filter((f) => ids.has(f.id)).map(fileView), updatedAt: d.updatedAt };
}
const openDraft = (s: Store, userId: string) => (s.sellerDrafts ?? []).find((d) => d.userId === userId && !d.discardedAt && !d.submittedApplicationId);
const draftTries: number[] = [];
function closeDemo(s: Store, u: DemoUser, byId: string, reason: string) {
  if (u.status === "closed") return { ok: false as const, error: CLOSE_ERRORS.already };
  if (isAdminRole(u.role)) return { ok: false as const, error: CLOSE_ERRORS.admin };
  const at = new Date().toISOString(); Object.assign(u, { status: "closed", closedAt: at, closedById: byId, closedReason: reason, closedEmail: u.email });
  if (s.sessionUserId === u.id) s.sessionUserId = null; // sessions ended
  (s.audit ??= []).push({ userId: u.id, adminId: byId, action: "closed", detail: reason, createdAt: at });
  return { ok: true as const };
}
const userClosed = (s: Store, userId: string) => s.users.find((u) => u.id === userId)?.status === "closed";
function demoMatches(s: Store, a: DemoApp): SellerMatch[] {
  const out: SellerMatch[] = (s.sellerApps ?? []).filter((o) => o.id !== a.id && (o.email === a.email || o.merchantKey === a.merchantKey || o.idNumber === a.idNumber) && (o.status === "rejected" || o.status === "blacklisted" || userClosed(s, o.userId)))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((o) => {
      const what = o.status === "blacklisted" ? "blacklisted" as const : o.status === "rejected" ? "rejected" as const : "closed_account" as const; const ou = s.users.find((u) => u.id === o.userId);
      return { kind: o.idNumber === a.idNumber ? "id_number" as const : o.email === a.email ? "email" as const : "merchant" as const, what, userId: o.userId, applicationId: o.id, number: applicationNumber(o.seq), label: o.merchantName,
        at: what === "closed_account" ? ou?.closedAt ?? null : o.decidedAt, reason: what === "blacklisted" ? o.blacklistReason : what === "rejected" ? o.reason : ou?.closedReason ?? null };
    });
  return [...out, ...closedFor(s, a.email, a.userId)];
}
const closedFor = (s: Store, email: string, except: string): SellerMatch[] => s.users.filter((u) => u.status === "closed" && u.closedEmail === email && u.id !== except)
  .map((u) => ({ kind: "email", what: "closed_account", userId: u.id, applicationId: null, number: null, label: u.closedEmail ?? email, at: u.closedAt ?? null, reason: u.closedReason ?? null }));
function sellerRow(s: Store, a: DemoApp): SellerRow {
  return { id: a.id, number: applicationNumber(a.seq), status: a.status, tab: tabOf(a.status, userClosed(s, a.userId)), sellerType: typeOf(a), merchantName: a.merchantName, name: applicantName(a.data, a.email), email: a.email, userId: a.userId,
    businessCountry: a.data.businessCountry ?? "", fileCount: (s.sellerFiles ?? []).filter((f) => f.applicationId === a.id).length, freeze: freezeDays(a.data), createdAt: a.createdAt, matches: demoMatches(s, a).length };
}
const sellerTries: number[] = [];

export const demoApi: AccountApi = {
  mode: "demo",
  async config() { return { google: true, stripe: true, email: true, sampleOrders: true, payments: { provider: "demo", available: false, simulate: true } }; }, // demo top-ups: "Simulate payment", no card
  async getSession() { const u = current(load()); return u ? publicUser(u) : null; },
  async signUp({ name, email, password, marketingOptIn, termsVersion, role, callbackPath }) {
    await wait();
    if (termsVersion !== TERMS_VERSION) return { ok: false, error: TERMS_ERROR }; // R7 (same check as the server)
    const s = load(); const e = email.trim().toLowerCase();
    // R1: the email of a closed account is NOT taken here. The new account waits with a placeholder email until it verifies.
    const claim = s.users.some((u) => u.email === e && u.status === "closed");
    if (!claim && s.users.some((u) => u.email === e)) return { ok: false, error: "An account with this email already exists." };
    const salt = rand(12); const uid = id(); const now = new Date().toISOString();
    s.users.push({ id: uid, name: name.trim(), email: claim ? claimPlaceholder(uid) : e, claimEmail: claim ? e : null, emailVerified: false, role: signupRole(role), createdAt: now, provider: "email", marketingOptIn, marketingChoiceAt: marketingOptIn ? now : null,
      termsVersion: TERMS_VERSION, termsAcceptedAt: now, salt, passwordHash: await hash(password, salt) });
    const demoLink = issue(s, "verify", e, callbackPath); const code = codeOf(s, e);
    demoMail(s, e, "verify", { name: name.trim(), code, url: fullLink(demoLink) }); save(s);
    return { ok: true, demoLink, demoCode: code };
  },
  async signIn({ email, password }) {
    await wait();
    const s = load(); const u = s.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || !u.salt || u.passwordHash !== await hash(password, u.salt)) return { ok: false, error: "Wrong email or password." };
    if (!u.emailVerified) return { ok: false, error: "Verify your email first.", code: "EMAIL_NOT_VERIFIED" };
    if (u.status === "closed") return { ok: false, error: CLOSE_ERRORS.signIn };
    s.sessionUserId = u.id; logLogin(s, u.id, "email"); demoDevice(s, u); save(s); return { ok: true };
  },
  async signInGoogle() {
    await wait();
    const s = load(); const e = "demo.google.user@gmail.com";
    let u = s.users.find((x) => x.email === e);
    if (!u) { u = { id: id(), name: "Demo Google User", email: e, emailVerified: true, role: "customer", createdAt: new Date().toISOString(), provider: "google", termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() /* R7: click under the Terms notice */ }; s.users.push(u); seedOrders(s, u.id); }
    if (u.status === "closed") return { ok: false, error: CLOSE_ERRORS.signIn };
    s.sessionUserId = u.id; logLogin(s, u.id, "google"); demoDevice(s, u); save(s); return { ok: true };
  },
  async signOut() { const s = load(); s.sessionUserId = null; save(s); },
  async resendVerification(email, callbackPath) {
    const s = load(); const e = email.trim().toLowerCase();
    if (!s.users.some((u) => (u.email === e || u.claimEmail === e) && !u.emailVerified)) return { ok: true };
    const demoLink = issue(s, "verify", e, callbackPath); const code = codeOf(s, e);
    demoMail(s, e, "verify", { name: s.users.find((u) => u.email === e)?.name ?? "", code, url: fullLink(demoLink) }); save(s); return { ok: true, demoLink, demoCode: code };
  },
  async verifyCode(email, code) {
    await wait();
    const s = load(); const e = email.trim().toLowerCase(); const c = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(c)) return { ok: false, error: "Enter the 6-digit code from the email." };
    const t = s.tokens.find((x) => x.email === e && x.type === "verify");
    if (!t || !t.code || (t.codeExpires ?? 0) < Date.now()) return { ok: false, error: "This code has expired. Send a new code." };
    if ((t.codeTries ?? 0) >= 5) return { ok: false, error: "Too many wrong codes. Send a new code." };
    if (t.code !== c) { t.codeTries = (t.codeTries ?? 0) + 1; save(s); return { ok: false, error: t.codeTries >= 5 ? "Too many wrong codes. Send a new code." : "Wrong code. Check the email and try again." }; }
    return demoApi.verifyEmail(t.token);
  },
  async verifyEmail(token) {
    await wait();
    const s = load(); const t = s.tokens.find((x) => x.token === token && x.type === "verify");
    if (!t || t.expires < Date.now()) return { ok: false, error: "Verification link is invalid or expired." };
    // R1: a pending claim (newest first) wins over the closed account that still holds the address; the swap happens only now.
    const u = [...s.users].reverse().find((x) => x.claimEmail === t.email && !x.emailVerified) ?? s.users.find((x) => x.email === t.email); if (!u) return { ok: false, error: "Account not found." };
    if (u.claimEmail) {
      const old = s.users.find((x) => x.email === u.claimEmail && x.status === "closed");
      if (!old) return { ok: false, error: CLOSE_ERRORS.claimLost };
      old.email = closedPlaceholder(old.id); u.email = u.claimEmail; u.claimEmail = null;
      (s.audit ??= []).push({ userId: old.id, adminId: "", action: "email_claimed", detail: `Email taken by a new verified sign-up (${u.id})`, createdAt: new Date().toISOString() });
    }
    u.emailVerified = true; s.sessionUserId = u.id; logLogin(s, u.id, "email-verify"); s.tokens = s.tokens.filter((x) => x !== t); seedOrders(s, u.id);
    demoDevice(s, u); demoMail(s, u.email, "welcome", { name: u.name }); save(s);
    return { ok: true };
  },
  async requestReset(email) {
    await wait();
    const s = load(); const e = email.trim().toLowerCase();
    if (!s.users.some((u) => u.email === e && u.provider === "email")) return { ok: true };
    // (admin-created users have provider "email" and no password yet: the same link sets it)
    const demoLink = issue(s, "reset", e); const u = s.users.find((x) => x.email === e)!;
    demoMail(s, e, u.salt ? "reset" : "adminCreated", { name: u.name, url: fullLink(demoLink) }); save(s); return { ok: true, demoLink };
  },
  async resetPassword(token, password) {
    await wait();
    const s = load(); const t = s.tokens.find((x) => x.token === token && x.type === "reset");
    if (!t || t.expires < Date.now()) return { ok: false, error: "Reset link is invalid or expired." };
    const u = s.users.find((x) => x.email === t.email); if (!u) return { ok: false, error: "Account not found." };
    if (u.emailVerified && u.salt) demoMail(s, u.email, "passwordChanged", demoFacts(u.name));
    u.salt = rand(12); u.passwordHash = await hash(password, u.salt); u.emailVerified = true; s.tokens = s.tokens.filter((x) => x !== t); s.sessionUserId = null; save(s); // the link proves the email
    return { ok: true };
  },
  async updateName(name) { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; u.name = name.trim(); save(s); return { ok: true }; },
  async updateProfile(patch) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (patch.name !== undefined && (!patch.name.trim() || patch.name.length > 80)) return { ok: false, error: "Enter your name." };
    if (patch.avatar !== undefined && patch.avatar !== null && !isAvatar(patch.avatar)) return { ok: false, error: "Unknown avatar." };
    if (patch.country !== undefined && patch.country !== null && !isCountry(patch.country)) return { ok: false, error: "Unknown country." };
    if (patch.name !== undefined) u.name = patch.name.trim();
    if (patch.avatar !== undefined) u.avatar = patch.avatar;
    if (patch.country !== undefined) u.country = patch.country;
    if (patch.marketingOptIn !== undefined) { u.marketingOptIn = patch.marketingOptIn; u.marketingChoiceAt = new Date().toISOString(); }
    save(s); return { ok: true };
  },
  async loginHistory() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const since = new Date(Date.now() - LOGIN_HISTORY_DAYS * 86400_000).toISOString();
    return { ok: true, logins: s.logins.filter((l) => l.userId === u.id && l.createdAt >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
      .map((l) => ({ method: l.method, ip: maskIp(l.ipAddress), userAgent: l.userAgent, location: "Bangkok, Thailand (sample location)", createdAt: l.createdAt })) };
  },
  async changePassword(cur, next) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (!u.salt) return { ok: false, error: "This account uses Google login and has no password." };
    if (u.passwordHash !== await hash(cur, u.salt)) return { ok: false, error: "Current password is wrong." };
    u.salt = rand(12); u.passwordHash = await hash(next, u.salt); demoMail(s, u.email, "passwordChanged", demoFacts(u.name)); save(s); return { ok: true };
  },
  async listOrders() { const s = load(); const u = current(s); return u ? { ok: true, orders: s.orders[u.id] ?? [] } : { ok: false, error: "Not signed in" }; },
  async createSampleOrder() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const list = s.orders[u.id] ?? [];
    const o = withCharges(s, u, sampleOrder("completed", Date.now(), [{ name: "Xbox Game Pass Ultimate 1 Month", kind: "game_key", platform: "Xbox", region: "Global", thb: 55900, demoKey: key() }]));
    list.unshift(o); s.orders[u.id] = list; mailOrder(s, u, o); save(s); return { ok: true };
  },
  async getOrder(oid) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const o = (s.orders[u.id] ?? []).find((x) => x.id === oid || x.number === oid.toUpperCase()); if (!o) return { ok: false, error: "Order not found." };
    const ratings = (s.ratings ?? []).filter((r) => r.userId === u.id && r.orderId === o.id).map(({ userId: _u, orderId: _o, ...r }) => r);
    return { ok: true, order: { ...o, ratings } };
  },
  async saveTaxInfo(oid, tax) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const t = parseTaxInfo(tax); if (!t.ok) return { ok: false, error: t.error };
    const o = (s.orders[u.id] ?? []).find((x) => x.id === oid); if (!o) return { ok: false, error: RATING_ERRORS.notYours };
    o.taxInfo = t.tax; save(s); return { ok: true, taxInfo: t.tax };
  },
  async rateSeller(input) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const c = checkRating(input); if (!c.ok) return { ok: false, error: c.error };
    const o = (s.orders[u.id] ?? []).find((x) => x.id === input.orderId); if (!o) return { ok: false, error: RATING_ERRORS.notYours };
    if (!canRate(o.status)) return { ok: false, error: RATING_ERRORS.notRatable };
    const seller = input.seller || CORECART_SELLER; if (!sellersOf(o.items).includes(seller)) return { ok: false, error: RATING_ERRORS.seller };
    const list = (s.ratings ??= []); const at = new Date().toISOString();
    const r = list.find((x) => x.userId === u.id && x.orderId === o.id && x.seller === seller);
    if (r) Object.assign(r, { stars: c.stars, comment: c.comment, updatedAt: at }); else list.push({ userId: u.id, orderId: o.id, seller, stars: c.stars, comment: c.comment, updatedAt: at });
    save(s); return { ok: true, rating: { seller, stars: c.stars, comment: c.comment, updatedAt: at } };
  },
  async favorites() { const s = load(); const u = current(s); return u ? { ok: true, ids: cleanFavorites(s.favorites[u.id]) } : { ok: false, error: "Not signed in" }; },
  async addFavorite(productId) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; if (!productById(productId)) return { ok: false, error: "Product not found" };
    const list = cleanFavorites(s.favorites[u.id]); if (!list.includes(productId) && list.length < MAX_FAVORITES) list.unshift(productId);
    s.favorites[u.id] = list; save(s); return { ok: true, ids: list };
  },
  async removeFavorite(productId) { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; s.favorites[u.id] = cleanFavorites(s.favorites[u.id]).filter((x) => x !== productId); save(s); return { ok: true, ids: s.favorites[u.id] }; },
  async mergeFavorites(ids) { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; s.favorites[u.id] = mergeFavorites(cleanFavorites(s.favorites[u.id]), ids); save(s); return { ok: true, ids: s.favorites[u.id] }; },
  async balance() { const s = load(); const u = current(s); return u ? { ok: true, balance: balanceData(s, u.id) } : { ok: false, error: "Not signed in" }; },
  async redeemGiftCard(input) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const now = Date.now(); const tries = (s.redeemTries[u.id] ?? []).filter((t) => now - t < REDEEM_LIMIT.windowMs);
    if (tries.length >= REDEEM_LIMIT.max) return { ok: false, error: REDEEM_ERRORS.limit };
    s.redeemTries[u.id] = [...tries, now]; await seedGift(s);
    const code = normalizeCode(input); if (!code) { save(s); return { ok: false, error: REDEEM_ERRORS.format }; }
    const hash = await hashCode(code); const card = s.giftCards.find((c) => c.codeHash === hash);
    const status = card ? giftCardStatus(card, now) : null;
    if (!card || status !== "active") { save(s); return { ok: false, error: status ? REDEEM_ERRORS[status as Exclude<typeof status, "active">] : REDEEM_ERRORS.notFound }; }
    const at = new Date(now).toISOString(); card.redeemedAt = at; card.redeemedById = u.id;
    (s.ledger[u.id] ??= []).push({ id: id(), createdAt: at, bucket: "gift", type: "gift_card_redeem", ref: maskedCode(card.last4), amountMinor: card.amountMinor });
    demoMail(s, u.email, "giftCard", { name: u.name, amount: thbText(card.amountMinor), last4: card.last4, balance: thbText(balanceData(s, u.id).giftMinor) });
    save(s); return { ok: true, amountMinor: card.amountMinor, balance: balanceData(s, u.id) };
  },
  async topUps() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; expireDemoTopUps(s);
    const rates = await demoCurrencies(); const now = Date.now();
    const used = (s.topUps ?? []).filter((t) => t.userId === u.id && (t.status === "paid" || t.status === "credited") && now - Date.parse(t.createdAt) < DAY_MS).reduce((sum, t) => sum + t.creditMinor, 0);
    return { ok: true, topUps: (s.topUps ?? []).filter((t) => t.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50).map(publicTopUp),
      dailyLeftMinor: Math.max(0, dailyCapThb(rates.base, rates.currencies.find((c) => c.code === "USD") ?? USD_RATE) - used), bank: await demoBankInfo(s, u) };
  },
  async topUp(tid) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; expireDemoTopUps(s);
    const t = findTopUp(s, tid, u.id); return t ? { ok: true, topUp: publicTopUp(t) } : { ok: false, error: TOPUP_ERRORS.notFound };
  },
  async createTopUp(input) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (!u.emailVerified) return { ok: false, error: "Verify your email first." };
    const now = Date.now(); while (topUpTries.length && now - topUpTries[0] > TOPUP_LIMIT.windowMs) topUpTries.shift();
    if (topUpTries.length >= TOPUP_LIMIT.max) return { ok: false, error: TOPUP_ERRORS.limit };
    topUpTries.push(now);
    const n = parseNewTopUp(input as unknown as Record<string, unknown>); if (!n) return { ok: false, error: TOPUP_ERRORS.amount };
    const rates = await demoCurrencies(); const cur = rates.currencies.find((c) => c.code === n.currency);
    const bank = n.method === "bank" ? await demoBankInfo(s, u) : null;
    if (n.method === "bank" && !bank) return { ok: false, error: TOPUP_ERRORS.bankOff };
    if (bank && !cur) return { ok: false, error: BANK_CURRENCY_ERROR };
    if (!cur || (!bank && !cur.chargeable)) return { ok: false, error: TOPUP_ERRORS.currency };
    const usd = rates.currencies.find((c) => c.code === "USD") ?? USD_RATE;
    const amountError = checkAmount(n.amountMinor, topUpLimits(cur, usd), cur.symbol); if (amountError) return { ok: false, error: amountError };
    expireDemoTopUps(s); const list = (s.topUps ??= []);
    const same = list.find((t) => t.userId === u.id && t.idempotencyKey === n.idempotencyKey);
    if (same) return { ok: true, topUp: publicTopUp(same), payment: same.status === "pending" && same.method !== "bank" ? { kind: "simulate" } : null };
    if (bank && list.filter((t) => t.userId === u.id && t.method === "bank" && t.status === "pending").length >= BANK_OPEN_MAX) return { ok: false, error: TOPUP_ERRORS.bankOpen };
    const creditMinor = convertMinor(n.amountMinor, cur, rates.base);
    const used = list.filter((t) => t.userId === u.id && (t.status === "paid" || t.status === "credited") && now - Date.parse(t.createdAt) < DAY_MS).reduce((sum, t) => sum + t.creditMinor, 0);
    const capError = checkDailyCap(creditMinor, used, dailyCapThb(rates.base, usd), (thb) => formatMoney(Math.floor(convertMinor(thb, rates.base, { ...cur, roundStep: 1 })), cur));
    if (capError) return { ok: false, error: capError };
    const at = new Date(now).toISOString();
    if (!bank) for (const t of list) if (t.userId === u.id && t.status === "pending" && t.method !== "bank") Object.assign(t, { status: "cancelled", closedAt: at, failureReason: "Replaced by a newer top-up." });
    const method = bank ? "bank" as const : "card" as const;
    const row: DemoTopUp = { id: id(), number: topUpNumber(method), method, userId: u.id, amountMinor: n.amountMinor, currency: cur.code, creditMinor, fxRate: crossRate(rates.base, cur), status: "pending", provider: bank ? "bank" : "demo",
      providerRef: null, idempotencyKey: n.idempotencyKey, failureReason: null, closedById: null, createdAt: at, expiresAt: new Date(now + (bank ? BANK_PENDING_MS : PENDING_MS)).toISOString(), paidAt: null, creditedAt: null, closedAt: null };
    list.push(row); save(s); return { ok: true, topUp: publicTopUp(row), payment: bank ? null : { kind: "simulate" } };
  },
  async simulateTopUp(tid, outcome) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; expireDemoTopUps(s);
    const t = findTopUp(s, tid, u.id); if (!t) return { ok: false, error: TOPUP_ERRORS.notFound };
    if (t.method === "bank") return { ok: false, error: TOPUP_ERRORS.bankByAdmin };
    let payload: string;
    if (outcome === "resend") {
      const last = [...(s.payEvents ?? [])].reverse().find((e) => e.topUpId === t.id); if (!last) return { ok: false, error: "No payment event to send again yet." };
      payload = last.payload;
    } else payload = JSON.stringify({ id: `demo_evt_${id()}`, type: outcome === "paid" ? "payment.succeeded" : "payment.failed", topUpId: t.id, amountMinor: t.amountMinor, currency: t.currency,
      ...(outcome === "failed" ? { reason: "Card declined (simulated)." } : {}) });
    const result = demoWebhook(s, payload);
    if (result === "credited") demoMail(s, u.email, "topUp", { name: u.name, number: t.number, amount: thbText(t.creditMinor), paid: emailMoney(t.amountMinor, t.currency), balance: thbText(balanceData(s, u.id).walletMinor) });
    save(s); return { ok: true, topUp: publicTopUp(t), result };
  },
  async listReturns() { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; return { ok: true, returns: s.returns.filter((r) => r.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicReturn) }; },
  async requestReturn(input) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; if (ensureKeys(s, u.id)) save(s);
    const l = lineFacts(s, u.id, input.orderItemId); if (!l) return { ok: false, error: "Order item not found" };
    const e = eligibility(l.facts); if (!e.ok) return { ok: false, error: NOT_ELIGIBLE[e.why] };
    const error = checkNewReturn(input, l.item.kind, l.order.createdAt, e.max); if (error) return { ok: false, error };
    const at = new Date().toISOString();
    const r: DemoReturn = { id: id(), number: returnNumber(), userId: u.id, orderId: l.order.id, orderNumber: l.order.number, orderItemId: l.item.id, itemName: l.item.name, kind: l.item.kind, platform: l.item.platform ?? null,
      quantity: input.quantity, reason: input.reason, message: input.message.trim(), status: "requested", adminNote: null, createdAt: at, updatedAt: at };
    s.returns.push(r); demoMail(s, u.email, "returnUpdate", { name: u.name, state: "received", returnNumber: r.number, orderNumber: r.orderNumber, item: r.itemName, quantity: r.quantity, note: null });
    save(s); return { ok: true, ret: publicReturn(r) };
  },
  async listTickets() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const mine = s.tickets.filter((t) => t.userId === u.id).sort((a, b) => b.lastReplyAt.localeCompare(a.lastReplyAt));
    return { ok: true, tickets: mine.map((t) => ticketRow(s, t)), unread: mine.filter((t) => t.customerUnread).length };
  },
  async ticketUnread() { const s = load(); const u = current(s); return u ? s.tickets.filter((t) => t.userId === u.id && t.customerUnread).length : 0; },
  async getTicket(tid) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const t = s.tickets.find((x) => x.id === tid && x.userId === u.id); if (!t) return { ok: false, error: "Ticket not found" };
    if (t.customerUnread) { t.customerUnread = false; save(s); }
    return { ok: true, ticket: ticketThread(s, t) };
  },
  async createTicket(input) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const error = checkNewTicket(input); if (error) return { ok: false, error };
    const now = Date.now(); const tries = (s.ticketTries[u.id] ?? []).filter((x) => now - x < NEW_TICKET_LIMIT.windowMs);
    if (tries.length >= NEW_TICKET_LIMIT.max) return { ok: false, error: TICKET_ERRORS.limit };
    // Same rules as lib/server/tickets.ts createTicket: a matching order number links the order, any text is kept.
    let orderRef = cleanOrderRef(input.orderRef) || null; let orderId: string | null = null; const keyId = input.keyId || null;
    if (keyId) { if (ensureKeys(s, u.id)) save(s); const k = keyRows(s, u.id).find((x) => x.id === keyId); if (!k) return { ok: false, error: "Key not found" }; orderRef ??= k.orderNumber; if (orderRef === k.orderNumber) orderId = k.orderId; }
    if (orderRef && !orderId) orderId = (s.orders[u.id] ?? []).find((o) => o.number === orderRef)?.id ?? null;
    const at = new Date(now).toISOString(); const tid = id();
    s.tickets.push({ id: tid, number: 1001 + s.tickets.length, userId: u.id, category: input.category, subject: categoryLabel(input.category), status: "open", orderId, orderRef, keyId, customerUnread: false, lastReplyAt: at, lastReplyBy: "customer", createdAt: at });
    s.ticketMessages.push({ id: id(), ticketId: tid, fromSupport: false, body: input.message.trim(), createdAt: at });
    demoMail(s, u.email, "ticketCreated", { name: u.name, number: s.tickets[s.tickets.length - 1].number, subject: categoryLabel(input.category), excerpt: input.message.trim().slice(0, 600), ticketId: tid });
    s.ticketTries[u.id] = [...tries, now]; save(s); return { ok: true, id: tid };
  },
  async replyTicket(tid, body) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const error = checkBody(body); if (error) return { ok: false, error };
    const t = s.tickets.find((x) => x.id === tid && x.userId === u.id); if (!t) return { ok: false, error: "Ticket not found" };
    const at = new Date().toISOString(); s.ticketMessages.push({ id: id(), ticketId: tid, fromSupport: false, body: body.trim(), createdAt: at });
    Object.assign(t, { status: "open", lastReplyAt: at, lastReplyBy: "customer" }); save(s); return { ok: true };
  },
  async closeTicket(tid) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const t = s.tickets.find((x) => x.id === tid && x.userId === u.id); if (!t) return { ok: false, error: "Ticket not found" };
    t.status = "closed"; save(s); return { ok: true };
  },
  async filters() { return demoFilters(load()); },
  async catalog() { return demoCatalogAll().filter((p) => (p.status ?? "published") === "published"); },
  async menu() { return load().menu ?? DEFAULT_MENU; },
  // Purchase popup: same rules as the server, from the paid orders kept in this browser (sample orders count here: nothing else exists).
  async billingAddress() { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; const c = checkAddress(u.billingAddress); return { ok: true, address: c.ok ? c.address : null }; },
  async saveBillingAddress(input) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const c = checkAddress(input); if (!c.ok) return { ok: false, error: Object.values(c.errors)[0] ?? ADDRESS_ERRORS.bad, errors: c.errors };
    if (!sameAddress(u.billingAddress, c.address)) { u.billingAddress = c.address; save(s); }
    return { ok: true, address: c.address };
  },
  async fees() { return load().fees ?? { ...FEE_DEFAULTS, taxRates: [] }; },
  async recentPurchases() {
    const s = load(); const settings = s.popup ?? POPUP_DEFAULTS;
    const live = new Set(demoCatalogAll().filter((p) => (p.status ?? "published") === "published").map((p) => p.id));
    const rows = s.users.filter((u) => isBuyerRole(u.role) && (u.status ?? "active") === "active").flatMap((u) => (s.orders[u.id] ?? [])
      .filter((o) => POPUP_ORDER_STATUSES.includes(o.status) && o.paidAt).flatMap((o) => o.items.map((i) => ({ lineId: i.id, productId: i.productId ?? null, at: o.paidAt!, country: u.country ?? null }))));
    return { enabled: settings.enabled, purchases: pickRecent(rows, settings, Date.now(), (pid) => live.has(pid)) };
  },
  async sellerStatus() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const a = latestApp(s, u.id); const d = openDraft(s, u.id); return { ok: true, application: a ? myApp(a) : null, draft: d ? demoDraftOut(s, d) : null };
  },
  async sellerDetails() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const a = latestApp(s, u.id); if (!a) return { ok: true, details: null };
    return { ok: true, details: { ...myApp(a), answers: a.data, idLast4: a.idNumber.slice(-4), files: (s.sellerFiles ?? []).filter((f) => f.applicationId === a.id).map(fileView), termsVersion: a.termsVersion ?? null, termsAcceptedAt: a.termsAcceptedAt ?? null } };
  },
  async saveSellerDraft(raw, step) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (!u.emailVerified) return { ok: false, error: SELL_ERRORS.verify };
    if (!isSellerType(raw.sellerType)) return { ok: false, error: SELL_ERRORS.type, errors: { sellerType: SELL_ERRORS.type } };
    const open = (s.sellerApps ?? []).find((a) => a.userId === u.id && (a.status === "pending" || a.status === "approved"));
    if (open) return { ok: false, error: open.status === "pending" ? SELL_ERRORS.pending : SELL_ERRORS.approved };
    const now = Date.now(); while (draftTries.length && now - draftTries[0] > DRAFT_LIMIT.windowMs) draftTries.shift();
    if (draftTries.length >= DRAFT_LIMIT.max) return { ok: false, error: SELL_ERRORS.draftLimit }; draftTries.push(now);
    const input = demoKeepFiles(s, u.id, raw); const steps = stepsFor(raw.sellerType);
    const prev = openDraft(s, u.id); const marked = prev ? prev.completed.filter((x) => steps.includes(x as StepId)) : [];
    if (step) {
      if (!steps.includes(step)) return { ok: false, error: SELL_ERRORS.stepOrder };
      if (steps.indexOf(step) > completedSteps(input, marked).length) return { ok: false, error: SELL_ERRORS.stepOrder };
      const errors = checkSeller(input, step, false); if (Object.keys(errors).length) return { ok: false, error: `Check ${STEP_LABEL[step]}.`, errors };
      if (!marked.includes(step)) marked.push(step);
    }
    const d: DemoDraft = { userId: u.id, input: { ...input, confirm: false, terms: false }, completed: marked, submittedApplicationId: null, discardedAt: null, updatedAt: new Date().toISOString() };
    s.sellerDrafts = [...(s.sellerDrafts ?? []).filter((x) => x.userId !== u.id), d]; save(s);
    return { ok: true, draft: demoDraftOut(s, d) };
  },
  async discardSellerDraft() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const d = openDraft(s, u.id); if (!d) return { ok: false, error: SELL_ERRORS.noDraft };
    Object.assign(d, { input: { ...emptySellerInput(), sellerType: d.input.sellerType }, completed: [], discardedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); // files stay (KYC)
    save(s); return { ok: true };
  },
  async uploadSellerFile(kind, file) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (!u.emailVerified) return { ok: false, error: SELL_ERRORS.verify };
    const bytes = new Uint8Array(await file.arrayBuffer()); const bad = checkFile(kind, bytes); if (bad) return { ok: false, error: bad };
    const now = Date.now(); while (sellFileTries.length && now - sellFileTries[0] > FILE_UPLOAD_LIMIT.windowMs) sellFileTries.shift();
    if (sellFileTries.length >= FILE_UPLOAD_LIMIT.max) return { ok: false, error: SELL_ERRORS.uploadLimit }; sellFileTries.push(now);
    const mime = sniffMime(bytes)!; const dataUrl = mime === "application/pdf" ? null : await shrinkImage(file);
    const f: DemoSellerFile = { id: id(), kind, name: file.name.replace(/[^\w. ()-]/g, "_").slice(0, 120) || "file", mime: dataUrl ? "image/jpeg" : mime, size: bytes.length, createdAt: new Date().toISOString(), userId: u.id, applicationId: null, dataUrl };
    (s.sellerFiles ??= []).push(f); save(s);
    const { userId: _u, applicationId: _a, dataUrl: _d, ...out } = f; return { ok: true, file: out };
  },
  async submitSeller(input) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (!u.emailVerified) return { ok: false, error: SELL_ERRORS.verify };
    const errors = checkSeller(input); if (Object.keys(errors).length) { const bad = firstBadStep(input); return { ok: false, error: bad ? `Check ${STEP_LABEL[bad]}.` : SELL_ERRORS.type, errors }; }
    const apps = s.sellerApps ?? []; const open = apps.find((a) => a.userId === u.id && (a.status === "pending" || a.status === "approved"));
    if (open) return { ok: false, error: open.status === "pending" ? SELL_ERRORS.pending : SELL_ERRORS.approved };
    const mKey = merchantKey(input.merchantName);
    if (apps.some((a) => a.merchantKey === mKey && a.userId !== u.id && (a.status === "pending" || a.status === "approved"))) return { ok: false, error: SELL_ERRORS.merchantTaken, errors: { merchantName: SELL_ERRORS.merchantTaken } };
    const wanted = usedFiles(input);
    if (new Set(wanted.map((w) => w.fid)).size !== wanted.length) return { ok: false, error: SELL_ERRORS.fileBad };
    const files = wanted.map((w) => (s.sellerFiles ?? []).find((f) => f.id === w.fid && f.userId === u.id && !f.applicationId && f.kind === w.kind));
    if (files.some((f) => !f)) return { ok: false, error: SELL_ERRORS.fileBad };
    const at = new Date().toISOString(); const data = storedAnswers(input);
    const a: DemoApp = { id: id(), seq: apps.length + 1, userId: u.id, email: u.email, status: "pending", sellerType: input.sellerType as SellerType, data, merchantName: input.merchantName, merchantKey: mKey, idType: input.idType, idNumber: cleanIdNumber(input.idNumber),
      termsVersion: TERMS_VERSION, termsAcceptedAt: at, decidedAt: null, decidedById: null, reason: null, blacklistReason: null, statusBefore: null, createdAt: at };
    (s.sellerApps ??= []).push(a); files.forEach((f) => { f!.applicationId = a.id; });
    (s.sellerEvents ??= []).push({ applicationId: a.id, adminId: null, action: "submitted", detail: "", createdAt: at });
    const d = (s.sellerDrafts ?? []).find((x) => x.userId === u.id); if (d) Object.assign(d, { submittedApplicationId: a.id, input: { ...d.input, idNumber: "" }, updatedAt: at });
    const vars = { name: greetingName(data, u.name), number: applicationNumber(a.seq) };
    demoMail(s, u.email, "sellerReceived", vars);
    if (input.sellerType === "business" && input.rep.email && input.rep.email !== u.email.toLowerCase()) demoMail(s, input.rep.email, "sellerReceived", vars);
    save(s); return { ok: true, application: myApp(a) };
  },
  async closeAccount({ word, password, reason }) {
    await wait();
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (word !== CLOSE_WORD) return { ok: false, error: CLOSE_ERRORS.word };
    if (u.salt && u.passwordHash !== await hash(password, u.salt)) return { ok: false, error: CLOSE_ERRORS.password };
    const r = closeDemo(s, u, u.id, reason.trim().slice(0, 500) || "Closed by the account owner"); if (!r.ok) return r;
    save(s); return { ok: true };
  },
  async validatePromo(input) {
    const s = load(); const now = Date.now(); s.promoMisses = s.promoMisses.filter((t) => now - t < VALIDATE_LIMIT.windowMs);
    if (s.promoMisses.length >= VALIDATE_LIMIT.max) return { ok: false, error: PROMO_ERRORS.limit };
    const code = cleanPromoCode(input); const p = PROMO_CODE_RE.test(code) ? s.promos.find((x) => x.code === code) : undefined;
    if (!p) { s.promoMisses.push(now); save(s); return { ok: false, error: PROMO_ERRORS.not_found, gone: true }; }
    const status = promoStatus(p, now);
    return status === "active" ? { ok: true, promo: toPublic(p) } : { ok: false, error: PROMO_ERRORS[status], gone: true };
  },
  async listKeys() { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; if (ensureKeys(s, u.id)) save(s); return { ok: true, keys: keyRows(s, u.id) }; },
  async getKey(keyId) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; if (ensureKeys(s, u.id)) save(s);
    const k = keyRows(s, u.id).find((x) => x.id === keyId); return k ? { ok: true, key: k } : { ok: false, error: "Key not found" };
  },
  async revealKey(keyId) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; ensureKeys(s, u.id);
    const k = s.keys[u.id].find((x) => x.id === keyId); if (!k) return { ok: false, error: "Key not found" };
    if (!k.revealedAt) { const l = lineFacts(s, u.id, k.orderItemId); if (l && l.facts.unrevealedKeys - l.facts.heldUnits < 1) return { ok: false, error: RETURN_HOLD }; }
    k.revealedAt ??= new Date().toISOString(); s.reveals.push({ keyId, userId: u.id, userAgent: navigator.userAgent, createdAt: new Date().toISOString() }); save(s);
    return { ok: true, key: keyRows(s, u.id).find((x) => x.id === keyId)! };
  },
  async listPaymentMethods() { const s = load(); const u = current(s); return u ? { ok: true, configured: true, methods: s.cards[u.id] ?? [] } : { ok: false, error: "Not signed in" }; },
  async addPaymentMethod(card) {
    await wait();
    const s = load(); const u = current(s); if (!u || !card) return { ok: false, error: "Not signed in" };
    (s.cards[u.id] ??= []).push({ id: id(), brand: card.brand, last4: card.last4, expMonth: 12, expYear: new Date().getFullYear() + 3 }); save(s);
    return { ok: true };
  },
  async currencies() { return demoCurrencies(); },
  async setCurrency(code) { if (!isCurrencyCode(code)) return { ok: false, error: "Unknown currency" }; const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; u.currency = code; save(s); return { ok: true }; },
  async cart() { const s = load(); const u = current(s); return u ? { ok: true, items: cleanCart(s.carts[u.id]) } : { ok: false, error: "Not signed in" }; },
  async setCartItem(productId, qty) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const p = productById(productId); if (!p) return { ok: false, error: "Product not found" };
    const list = cleanCart(s.carts[u.id]); const q = Math.min(Math.max(Math.floor(qty) || 0, 0), maxQty(p));
    s.carts[u.id] = q === 0 ? list.filter((e) => e.productId !== productId) : list.some((e) => e.productId === productId) ? list.map((e) => (e.productId === productId ? { ...e, qty: q } : e)) : [{ productId, qty: q }, ...list];
    if (!save(s)) return { ok: false, error: "Could not save" }; // R4: a failed write is a failed save (like a network error)
    return { ok: true, items: s.carts[u.id] };
  },
  async mergeCart(items) { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; s.carts[u.id] = mergeCarts(s.carts[u.id] ?? [], items); save(s); return { ok: true, items: s.carts[u.id] }; },
  async clearCart() { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; s.carts[u.id] = []; save(s); return { ok: true, items: [] }; },
  async removePaymentMethod(pid) { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; s.cards[u.id] = (s.cards[u.id] ?? []).filter((c) => c.id !== pid); save(s); return { ok: true }; },
};

// Demo admin panel: this browser's demo users plus generated sample users (fake, example.com emails).
const firstNames = ["Somchai", "Nattaya", "Anan", "Ploy", "Kittipong", "Siriporn", "Wei", "Aiko", "James", "Maria", "Arjun", "Lena", "Tom", "Mai", "Chen", "Sara"];
const lastNames = ["Srisuk", "Wongsa", "Chaiyaporn", "Tanaka", "Nguyen", "Smith", "Garcia", "Patel", "Kim", "Muller"];
function seedAdminSamples(s: Store) {
  const now = Date.now();
  for (let i = 0; i < 36; i++) {
    const google = i % 3 === 0;
    const first = firstNames[i % firstNames.length]; const last = lastNames[(i * 7) % lastNames.length];
    const created = now - (((i * 37) % 45) * 86400_000 + ((i * 13) % 24) * 3600_000);
    const u: DemoUser = { id: id(), name: `${first} ${last}`, email: `${first}.${last}${i}@example.com`.toLowerCase(), emailVerified: google || i % 5 !== 1, role: "customer", createdAt: new Date(created).toISOString(), provider: google ? "google" : "email", marketingOptIn: i % 4 === 0, sample: true };
    s.users.push(u);
    const count = u.emailVerified ? (i * 5) % 9 : 0;
    for (let k = 0; k < count; k++) {
      const at = created + Math.floor((now - created) * ((k + 1) / (count + 1)));
      s.logins.push({ userId: u.id, method: google ? "google" : k === 0 ? "email-verify" : "email", ipAddress: `203.0.113.${(i * 11 + k) % 250}`, userAgent: k % 2 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140", createdAt: new Date(at).toISOString() });
    }
  }
  s.adminSeeded = true;
}
const methodsOf = (u: DemoUser) => [u.provider === "google" ? "google" : "credential"];
function row(s: Store, u: DemoUser): AdminUserRow {
  const mine = s.logins.filter((l) => l.userId === u.id);
  const last = mine.reduce<string | null>((m, l) => (!m || l.createdAt > m ? l.createdAt : m), null);
  return { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, role: u.role, createdAt: u.createdAt, marketingOptIn: Boolean(u.marketingOptIn), methods: methodsOf(u), lastLogin: last, loginCount: mine.length, balanceMinor: (s.ledger[u.id] ?? []).reduce((t, r) => t + r.amountMinor, 0),
    status: u.status ?? "active", returning: s.users.some((x) => x.status === "closed" && x.closedEmail === u.email && x.id !== u.id) };
}
// perm (T2): the section this call belongs to, "master" = master admin only. Same checks + messages as requireAdmin on the server.
let denyMsg = "Admin access only";
function adminStore(perm?: AdminPerm | "master") {
  const s = load(); const u = current(s);
  denyMsg = "Admin access only";
  if (!u || !hasAdminAccess(u)) return null;
  if (perm === "master" && !isMasterRole(u.role)) { denyMsg = PERM_ERRORS.masterOnly; return null; }
  if (perm && perm !== "master" && !hasPerm(u, perm)) { denyMsg = PERM_ERRORS.noAccess; return null; }
  if (!s.adminSeeded) { seedAdminSamples(s); save(s); }
  return s;
}
const bangkokDay = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const denied = () => ({ ok: false as const, error: denyMsg });
const keyTries: number[] = []; // key uploads, same limit as the server (per page load here)
const productTries: number[] = []; // same per-admin write limit as the server (per page load here)
function productTry() { const now = Date.now(); while (productTries.length && now - productTries[0] > ADMIN_PRODUCT_LIMIT.windowMs) productTries.shift(); if (productTries.length >= ADMIN_PRODUCT_LIMIT.max) return false; productTries.push(now); return true; }
const filterTries: number[] = []; // same per-admin write limit as the server (per page load here)
const popupTries: number[] = []; // same per-admin write limit as the server (per page load here)
const feeTries: number[] = []; // same per-admin write limit as the server (per page load here)
const feeData = (s: Store) => ({ settings: s.fees ?? { ...FEE_DEFAULTS, taxRates: [] },
  history: [...(s.feeEvents ?? [])].reverse().slice(0, 20).map((e) => ({ at: e.createdAt, by: s.users.find((u) => u.id === e.adminId)?.email ?? null, detail: e.detail })) });
const popupData = (s: Store) => ({ settings: s.popup ?? { ...POPUP_DEFAULTS, hidden: [] },
  history: [...(s.popupEvents ?? [])].reverse().slice(0, 20).map((e) => ({ at: e.createdAt, by: s.users.find((u) => u.id === e.adminId)?.email ?? null, detail: e.detail })) });
const menuTries: number[] = []; // same per-admin write limit as the server (per page load here)
function menuEdit(s: Store, edit: ((items: MenuItem[]) => MenuEdit) | string) {
  const now = Date.now(); while (menuTries.length && now - menuTries[0] > MENU_WRITE_LIMIT.windowMs) menuTries.shift();
  if (menuTries.length >= MENU_WRITE_LIMIT.max) return { ok: false as const, error: MENU_ERRORS.limit };
  menuTries.push(now);
  if (typeof edit === "string") return { ok: false as const, error: edit };
  const r = edit(s.menu ?? DEFAULT_MENU); if (!r.ok) return r;
  s.menu = r.items; save(s); return { ok: true as const, items: r.items };
}
function filterEdit(s: Store, edit: (c: FilterConfig) => { ok: true; cfg: FilterConfig } | { ok: false; error: string }) {
  const now = Date.now(); while (filterTries.length && now - filterTries[0] > 60_000) filterTries.shift();
  if (filterTries.length >= 120) return { ok: false as const, error: FILTER_ERRORS.limit };
  filterTries.push(now);
  const r = edit(demoFilters(s)); if (!r.ok) return r;
  s.filters = r.cfg; save(s); return { ok: true as const, config: r.cfg };
}

export const demoAdminApi: AdminApi = {
  async me() { const s = adminStore(); const u = s && current(s); return u ? { master: isMasterRole(u.role), perms: permsOf(u) } : false; },
  async stats() {
    const s = adminStore(); if (!s) return denied();
    const since = (d: number) => Date.now() - d * 86400_000;
    const users = s.users;
    const newer = (d: number) => users.filter((u) => new Date(u.createdAt).getTime() >= since(d)).length;
    const recentLogins = s.logins.filter((l) => new Date(l.createdAt).getTime() >= since(7));
    const daily = new Map<string, number>();
    users.filter((u) => new Date(u.createdAt).getTime() >= since(30)).forEach((u) => { const k = bangkokDay(u.createdAt); daily.set(k, (daily.get(k) ?? 0) + 1); });
    return { ok: true, stats: {
      total: users.length, verified: users.filter((u) => u.emailVerified).length, admins: users.filter((u) => isAdminRole(u.role)).length,
      new1: newer(1), new7: newer(7), new30: newer(30), marketing: users.filter((u) => u.marketingOptIn).length,
      logins7: recentLogins.length, active7: new Set(recentLogins.map((l) => l.userId)).size,
      methods: ["credential", "google"].map((m) => ({ method: m, users: users.filter((u) => methodsOf(u).includes(m)).length })).filter((m) => m.users > 0),
      daily: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count })),
      recent: hasPerm(current(s)!, "users") ? users.map((u) => row(s, u)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8) : null, timezone: "Asia/Bangkok",
      owed: !hasPerm(current(s)!, "wallet") ? null : Object.values(s.ledger).flat().reduce((o, r) => ({ ...o, [r.bucket === "gift" ? "giftMinor" : "walletMinor"]: o[r.bucket === "gift" ? "giftMinor" : "walletMinor"] + r.amountMinor }), { walletMinor: 0, giftMinor: 0 }),
    } };
  },
  async users(query) {
    const s = adminStore("users"); if (!s) return denied();
    const q = query.q?.trim().toLowerCase();
    const rows = s.users.map((u) => row(s, u)).filter((r) =>
      (!q || r.email.includes(q) || r.name.toLowerCase().includes(q)) &&
      (!query.method || r.methods.includes(query.method)) &&
      (!query.verified || (query.verified === "yes") === r.emailVerified) &&
      (!query.role || r.role === query.role) && (!query.status || r.status === query.status))
      .sort((a, b) => query.sort === "login" ? (b.lastLogin ?? "").localeCompare(a.lastLogin ?? "") : query.sort === "balance" ? b.balanceMinor - a.balanceMinor || b.createdAt.localeCompare(a.createdAt) : query.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
    const pageSize = 25; const page = Math.max(query.page || 1, 1);
    return { ok: true, data: { total: rows.length, page, pageSize, users: rows.slice((page - 1) * pageSize, page * pageSize) } };
  },
  async user(uid) {
    const s = adminStore("users"); if (!s) return denied();
    const u = s.users.find((x) => x.id === uid); if (!u) return { ok: false, error: "User not found" };
    const logins: AdminLogin[] = s.logins.filter((l) => l.userId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
      .map((l) => ({ method: l.method, ipAddress: l.ipAddress, userAgent: l.userAgent, createdAt: l.createdAt }));
    const orders = s.orders[uid] ?? [];
    return { ok: true, data: {
      user: { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, role: u.role, createdAt: u.createdAt, updatedAt: u.createdAt, termsAcceptedAt: u.createdAt, marketingOptIn: Boolean(u.marketingOptIn),
        status: u.status ?? "active", closedAt: u.closedAt ?? null, closedReason: u.closedReason ?? null, closedEmail: u.closedEmail ?? null, closedBySelf: u.closedById === u.id },
      matches: [...closedFor(s, u.closedEmail ?? u.email, u.id), ...(s.sellerApps ?? []).filter((a) => a.email === (u.closedEmail ?? u.email) && a.userId !== u.id && (a.status === "rejected" || a.status === "blacklisted"))
        .map((a) => ({ kind: "email" as const, what: a.status as "rejected" | "blacklisted", userId: a.userId, applicationId: a.id, number: applicationNumber(a.seq), label: a.merchantName, at: a.decidedAt, reason: a.status === "blacklisted" ? a.blacklistReason : a.reason }))],
      applications: (s.sellerApps ?? []).filter((a) => a.userId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => ({ id: a.id, number: applicationNumber(a.seq), status: a.status, createdAt: a.createdAt })),
      accounts: methodsOf(u).map((method) => ({ method, createdAt: u.createdAt })),
      sessions: s.sessionUserId === uid ? [{ createdAt: logins[0]?.createdAt ?? u.createdAt, expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(), ipAddress: "demo", userAgent: navigator.userAgent }] : [],
      logins, orders: { count: orders.length, byCurrency: [...new Set(orders.map((o) => o.currency))].sort().map((currency) => ({ currency, totalMinor: orders.filter((o) => o.currency === currency).reduce((t, o) => t + o.totalCents, 0) })) }, wallet: adminWalletOf(s, uid), topUps: (s.topUps ?? []).filter((t) => t.userId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map(publicTopUp),
      audit: (s.audit ?? []).filter((a) => a.userId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => ({ action: a.action, detail: a.detail, by: s.users.find((x) => x.id === a.adminId)?.email ?? "Deleted admin", createdAt: a.createdAt })),
    } };
  },
  async currencies() { if (!adminStore("currencies")) return denied(); return { ok: true, data: await demoAdminCurrencies() }; },
  async updateCurrency(code, patch) { if (!adminStore("currencies")) return denied(); return demoUpdateCurrency(code, patch); },
  async refreshRates() { if (!adminStore("currencies")) return denied(); return demoRefreshRates(); },
  async promoCodes() { const s = adminStore("promo"); if (!s) return denied(); return { ok: true, promos: [...s.promos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }; },
  async promoCode(pid) { const s = adminStore("promo"); if (!s) return denied(); const p = s.promos.find((x) => x.id === pid); return p ? { ok: true, promo: p } : { ok: false, error: "Promo code not found" }; },
  async savePromo(pid, input) {
    const s = adminStore("promo"); if (!s) return denied();
    const i = { ...input, code: cleanPromoCode(input.code), maxDiscount: input.type === "percent" ? input.maxDiscount : null, categories: input.appliesTo === "categories" ? input.categories : [] };
    const errors = checkPromoInput(i);
    if (s.promos.some((x) => x.code === i.code && x.id !== pid)) errors.code = "This code is already taken.";
    if (Object.keys(errors).length) return { ok: false, error: "Check the highlighted fields.", errors };
    const at = new Date().toISOString(); let p = pid ? s.promos.find((x) => x.id === pid) : undefined;
    if (pid && !p) return { ok: false, error: "Promo code not found" };
    if (p) Object.assign(p, i, { updatedAt: at }); else { p = { ...i, id: id(), uses: 0, createdAt: at, updatedAt: at }; s.promos.push(p); }
    save(s); return { ok: true, promo: p };
  },
  async setPromoEnabled(pid, enabled) { const s = adminStore("promo"); if (!s) return denied(); const p = s.promos.find((x) => x.id === pid); if (!p) return { ok: false, error: "Promo code not found" }; p.enabled = enabled; p.updatedAt = new Date().toISOString(); save(s); return { ok: true }; },
  // Demo has no real orders, so uses stay 0 and delete is always a hard delete.
  async deletePromo(pid) { const s = adminStore("promo"); if (!s) return denied(); const n = s.promos.length; s.promos = s.promos.filter((x) => x.id !== pid); save(s); return n === s.promos.length ? { ok: false, error: "Promo code not found" } : { ok: true }; },
  async returns() {
    const s = adminStore("returns"); if (!s) return denied();
    return { ok: true, returns: [...s.returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => ({ ...publicReturn(r), customerEmail: s.users.find((x) => x.id === r.userId)?.email ?? "Deleted user" })) };
  },
  async updateReturn(rid, status, note) {
    const s = adminStore("returns"); if (!s) return denied();
    const r = s.returns.find((x) => x.id === rid); if (!r) return { ok: false, error: "Return not found" };
    const error = checkStatusChange(r.status, status, note); if (error) return { ok: false, error };
    r.status = status as ReturnStatus; r.adminNote = note?.trim() || r.adminNote; r.updatedAt = new Date().toISOString();
    const cu = userOf(s, r.userId); const o = (s.orders[r.userId] ?? []).find((x) => x.id === r.orderId); const line = o?.items.find((i) => i.id === r.orderItemId);
    if (cu && r.status === "refunded") demoMail(s, cu.email, "refund", { name: cu.name, returnNumber: r.number, orderNumber: r.orderNumber, item: `${r.itemName} × ${r.quantity}`, amount: emailMoney((line?.unitPriceCents ?? 0) * r.quantity, o?.currency ?? "USD"), to: paymentText(o?.paymentMethod) });
    else if (cu && (r.status === "approved" || r.status === "rejected")) demoMail(s, cu.email, "returnUpdate", { name: cu.name, state: r.status, returnNumber: r.number, orderNumber: r.orderNumber, item: r.itemName, quantity: r.quantity, note: r.adminNote });
    save(s); return { ok: true };
  },
  async addUser(input) {
    const s = adminStore("users"); if (!s) return denied();
    if (!userTry()) return { ok: false, error: USER_ERRORS.limit };
    const error = checkNewUser(input); if (error) return { ok: false, error };
    const denied2 = roleChangeError(current(s)!.role, "customer", input.role); if (denied2) return { ok: false, error: denied2 };
    const perms = input.role === "admin" ? parsePerms(input.perms ?? []) : null; if (input.role === "admin" && !perms) return { ok: false, error: PERM_ERRORS.bad };
    const email = cleanEmail(input.email); if (s.users.some((u) => u.email === email)) return { ok: false, error: USER_ERRORS.taken };
    const uid = id(); const at = new Date().toISOString();
    s.users.push({ id: uid, name: input.name.trim(), email, emailVerified: false, role: input.role, createdAt: at, provider: "email", adminPerms: perms });
    (s.audit ??= []).push({ userId: uid, adminId: current(s)!.id, action: "created", detail: input.role, createdAt: at });
    if (perms) s.audit.push({ userId: uid, adminId: current(s)!.id, action: "perms", detail: `none → ${permsText(perms)}`, createdAt: at });
    const demoLink = issue(s, "reset", email); demoMail(s, email, "adminCreated", { name: input.name.trim(), url: fullLink(demoLink) }); save(s); // the admin also sees the set-password link
    return { ok: true, id: uid, demoLink };
  },
  async setUserRole(uid, role) {
    const s = adminStore("users"); if (!s) return denied();
    if (!isRole(role)) return { ok: false, error: USER_ERRORS.role };
    if (!userTry()) return { ok: false, error: USER_ERRORS.limit };
    const me = current(s)!; if (uid === me.id) return { ok: false, error: USER_ERRORS.self };
    const u = s.users.find((x) => x.id === uid); if (!u) return { ok: false, error: USER_ERRORS.notFound };
    if (u.role === role) return { ok: true };
    const denied2 = roleChangeError(me.role, u.role, role); if (denied2) return { ok: false, error: denied2 };
    if (isMasterRole(u.role) && !isMasterRole(role) && !s.users.some((x) => x.id !== uid && isMasterRole(x.role) && x.emailVerified)) return { ok: false, error: USER_ERRORS.lastMaster };
    if (isAdminRole(u.role) && !isAdminRole(role) && !s.users.some((x) => x.id !== uid && isAdminRole(x.role) && x.emailVerified)) return { ok: false, error: USER_ERRORS.lastAdmin };
    (s.audit ??= []).push({ userId: uid, adminId: me.id, action: "role", detail: `${u.role} → ${role}${role === "admin" ? " (sections: none)" : ""}`, createdAt: new Date().toISOString() });
    u.role = role; u.adminPerms = permsAfterRole(role); save(s); return { ok: true };
  },
  async closeUser(uid, reason) {
    const s = adminStore("users"); if (!s) return denied();
    if (!reasonOk(reason)) return { ok: false, error: CLOSE_ERRORS.reason };
    if (uid === current(s)!.id) return { ok: false, error: USER_ERRORS.self };
    if (!userTry()) return { ok: false, error: USER_ERRORS.limit };
    const u = s.users.find((x) => x.id === uid); if (!u) return { ok: false, error: CLOSE_ERRORS.notFound };
    const r = closeDemo(s, u, current(s)!.id, reason.trim()); if (!r.ok) return r; save(s); return { ok: true };
  },
  async reopenUser(uid, note) {
    const s = adminStore("users"); if (!s) return denied();
    if (!reasonOk(note)) return { ok: false, error: CLOSE_ERRORS.reason };
    if (!userTry()) return { ok: false, error: USER_ERRORS.limit };
    const u = s.users.find((x) => x.id === uid); if (!u) return { ok: false, error: CLOSE_ERRORS.notFound };
    if (u.status !== "closed") return { ok: false, error: CLOSE_ERRORS.notClosed };
    if (u.closedEmail && u.email !== u.closedEmail) { if (s.users.some((x) => x.id !== uid && x.email === u.closedEmail)) return { ok: false, error: CLOSE_ERRORS.emailTaken }; u.email = u.closedEmail; }
    Object.assign(u, { status: "active", closedAt: null, closedById: null, closedReason: null, closedEmail: null });
    (s.audit ??= []).push({ userId: uid, adminId: current(s)!.id, action: "reopened", detail: note.trim(), createdAt: new Date().toISOString() }); save(s); return { ok: true };
  },
  async sellers(tab, q) {
    const s = adminStore("sellers"); if (!s) return denied();
    const rows = (s.sellerApps ?? []).map((a) => sellerRow(s, a)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const term = q.trim().toLowerCase();
    const counts = { pending: 0, approved: 0, rejected: 0, blacklisted: 0, closed: 0 } as Record<SellerTab, number>; rows.forEach((r) => counts[r.tab]++);
    return { ok: true, data: { counts, rows: rows.filter((r) => r.tab === tab && (!term || [r.merchantName, r.email, r.name].some((v) => v.toLowerCase().includes(term)) || r.number.toLowerCase() === term)) } };
  },
  async seller(aid) {
    const s = adminStore("sellers"); if (!s) return denied();
    const a = (s.sellerApps ?? []).find((x) => x.id === aid); if (!a) return { ok: false, error: SELL_ERRORS.notFound };
    const who = (uid: string | null) => (uid ? s.users.find((u) => u.id === uid)?.email ?? "Deleted admin" : null); const matchList = demoMatches(s, a);
    const seller: SellerDetail = { ...sellerRow(s, a), answers: a.data, idType: a.idType, idNumber: a.idNumber, idLast4: a.idNumber.slice(-4), termsVersion: a.termsVersion ?? null, termsAcceptedAt: a.termsAcceptedAt ?? null,
      files: (s.sellerFiles ?? []).filter((f) => f.applicationId === a.id).map(fileView),
      events: (s.sellerEvents ?? []).filter((e) => e.applicationId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).map((e) => ({ action: e.action, detail: e.detail, by: who(e.adminId), createdAt: e.createdAt })),
      matchList, matches: matchList.length, decidedAt: a.decidedAt, decidedBy: who(a.decidedById), reason: a.reason, blacklistReason: a.blacklistReason, accountClosed: userClosed(s, a.userId) };
    return { ok: true, seller };
  },
  async sellerAction(aid, action, reason) {
    const s = adminStore("sellers"); if (!s) return denied();
    if (action !== "approve" && !reasonOk(reason)) return { ok: false, error: SELL_ERRORS.reason };
    const now = Date.now(); while (sellerTries.length && now - sellerTries[0] > SELLER_ADMIN_LIMIT.windowMs) sellerTries.shift();
    if (sellerTries.length >= SELLER_ADMIN_LIMIT.max) return { ok: false, error: "Too many changes. Wait a minute." }; sellerTries.push(now);
    const a = (s.sellerApps ?? []).find((x) => x.id === aid); if (!a) return { ok: false, error: SELL_ERRORS.notFound };
    const me = current(s)!; const at = new Date().toISOString(); const u = s.users.find((x) => x.id === a.userId);
    const role = (from: string, to: string, why: string) => { if (u && u.role === from) { u.role = to; (s.audit ??= []).push({ userId: u.id, adminId: me.id, action: "role", detail: `${from} → ${to} (${applicationNumber(a.seq)} ${why})`, createdAt: at }); } };
    if (action === "approve" || action === "reject") {
      if (a.status !== "pending") return { ok: false, error: SELL_ERRORS.notPending };
      Object.assign(a, { status: action === "approve" ? "approved" : "rejected", decidedAt: at, decidedById: me.id, reason: action === "reject" ? reason.trim() : null });
      if (action === "approve") role("customer", "seller", "approved");
    } else if (action === "blacklist") {
      if (a.status === "blacklisted") return { ok: false, error: SELL_ERRORS.already };
      if (a.status === "approved") role("seller", "customer", "blacklisted");
      Object.assign(a, { statusBefore: a.status, status: "blacklisted", blacklistReason: reason.trim() });
    } else {
      if (a.status !== "blacklisted") return { ok: false, error: SELL_ERRORS.notBlacklisted };
      const back = a.statusBefore === "approved" ? "rejected" : a.statusBefore ?? "rejected";
      if (back === "pending" && (s.sellerApps ?? []).some((o) => o.id !== a.id && o.merchantKey === a.merchantKey && (o.status === "pending" || o.status === "approved"))) return { ok: false, error: SELL_ERRORS.merchantOpen }; // R3
      Object.assign(a, { status: back, statusBefore: null });
    }
    (s.sellerEvents ??= []).push({ applicationId: a.id, adminId: me.id, action, detail: action === "approve" ? "" : reason.trim(), createdAt: at });
    if (action === "approve") demoMail(s, a.email, "sellerApproved", { name: greetingName(a.data, ""), merchant: a.merchantName });
    if (action === "reject") demoMail(s, a.email, "sellerRejected", { name: greetingName(a.data, ""), merchant: a.merchantName, reason: reason.trim(), business: isBusiness(a.data) });
    save(s); return { ok: true };
  },
  async sellerFile(fid, download) {
    const s = adminStore("sellers"); if (!s) return denied();
    const f = (s.sellerFiles ?? []).find((x) => x.id === fid && x.applicationId); if (!f) return { ok: false, error: "File not found" };
    (s.sellerEvents ??= []).push({ applicationId: f.applicationId!, adminId: current(s)!.id, action: download ? "downloaded" : "viewed", detail: `${fileKindLabel(f.kind)} (${f.name})`, createdAt: new Date().toISOString() });
    save(s);
    const blob = f.dataUrl ? await (await fetch(f.dataUrl)).blob() : new Blob([`Demo: ${f.name} (${f.size} bytes) is a PDF. The demo keeps only its name; the server version keeps the file.`], { type: "text/plain" });
    return { ok: true, blob, name: f.name };
  },
  // T2, master admin only (same rules as lib/server/users.ts).
  async admins() {
    const s = adminStore("master"); if (!s) return denied();
    const admins = s.users.filter((u) => isAdminRole(u.role)).sort((a, b) => Number(isMasterRole(b.role)) - Number(isMasterRole(a.role)) || a.createdAt.localeCompare(b.createdAt))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, role: u.role, perms: permsOf({ ...u, emailVerified: true }), createdAt: u.createdAt }));
    const history = (s.audit ?? []).filter((a) => a.action === "perms" || (a.action === "role" && a.detail.includes("admin")) || (a.action === "created" && isAdminRole(a.detail)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
      .map((a) => ({ email: s.users.find((u) => u.id === a.userId)?.email ?? "Deleted user", action: a.action, detail: a.detail, by: s.users.find((u) => u.id === a.adminId)?.email ?? "Deleted admin", createdAt: a.createdAt }));
    return { ok: true, data: { admins, history } };
  },
  async setAdminPerms(uid, list) {
    const s = adminStore("master"); if (!s) return denied();
    const perms = parsePerms(list); if (!perms) return { ok: false, error: PERM_ERRORS.bad };
    if (!userTry()) return { ok: false, error: USER_ERRORS.limit };
    const me = current(s)!; if (uid === me.id) return { ok: false, error: PERM_ERRORS.master };
    const u = s.users.find((x) => x.id === uid); if (!u) return { ok: false, error: USER_ERRORS.notFound };
    if (isMasterRole(u.role)) return { ok: false, error: PERM_ERRORS.master };
    if (u.role !== "admin") return { ok: false, error: PERM_ERRORS.notAdmin };
    const before = u.adminPerms == null ? [...ALL_PERMS] : cleanPerms(u.adminPerms);
    if (permsText(before) !== permsText(perms)) (s.audit ??= []).push({ userId: uid, adminId: me.id, action: "perms", detail: `${permsText(before)} → ${permsText(perms)}`, createdAt: new Date().toISOString() });
    u.adminPerms = perms; save(s); return { ok: true, perms };
  },
  async tickets() { const s = adminStore("tickets"); if (!s) return denied(); return { ok: true, tickets: [...s.tickets].sort((a, b) => b.lastReplyAt.localeCompare(a.lastReplyAt)).map((t) => ticketRow(s, t, true)) }; },
  async ticket(tid) { const s = adminStore("tickets"); if (!s) return denied(); const t = s.tickets.find((x) => x.id === tid); return t ? { ok: true, ticket: ticketThread(s, t, true) } : { ok: false, error: "Ticket not found" }; },
  async replyTicket(tid, body) {
    const s = adminStore("tickets"); if (!s) return denied();
    const error = checkBody(body); if (error) return { ok: false, error };
    const t = s.tickets.find((x) => x.id === tid); if (!t) return { ok: false, error: "Ticket not found" };
    const at = new Date().toISOString(); s.ticketMessages.push({ id: id(), ticketId: tid, fromSupport: true, body: body.trim(), createdAt: at });
    Object.assign(t, { status: "answered", customerUnread: true, lastReplyAt: at, lastReplyBy: "support" });
    const cu = userOf(s, t.userId); if (cu) demoMail(s, cu.email, "ticketReply", { name: cu.name, number: t.number, subject: t.subject, excerpt: body.trim().slice(0, 600), ticketId: t.id });
    save(s); return { ok: true };
  },
  async setTicketStatus(tid, status) {
    const s = adminStore("tickets"); if (!s) return denied(); if (!isTicketStatus(status)) return { ok: false, error: "Unknown status" };
    const t = s.tickets.find((x) => x.id === tid); if (!t) return { ok: false, error: "Ticket not found" }; t.status = status; save(s); return { ok: true };
  },
  async adjustBalance(a) {
    const s = adminStore("wallet"); if (!s) return denied();
    const input = parseAdjustment(a as unknown as Record<string, unknown>); if (!input) return { ok: false, error: "userId and direction required" };
    if (!s.users.some((u) => u.id === input.userId)) return { ok: false, error: ADJUST_ERRORS.notFound };
    const now = Date.now(); while (adjustTries.length && now - adjustTries[0] > ADJUST_LIMIT.windowMs) adjustTries.shift();
    if (adjustTries.length >= ADJUST_LIMIT.max) return { ok: false, error: ADJUST_ERRORS.limit };
    adjustTries.push(now);
    const b = balanceData(s, input.userId);
    const error = checkAdjustment(input, input.bucket === "gift" ? b.giftMinor : b.walletMinor); if (error) return { ok: false, error };
    (s.ledger[input.userId] ??= []).push({ id: id(), createdAt: new Date().toISOString(), bucket: input.bucket, type: "adjustment", ref: input.reason, amountMinor: signedAmount(input), byId: current(s)!.id });
    const cu = userOf(s, input.userId); const nb = balanceData(s, input.userId);
    if (cu) demoMail(s, cu.email, "balanceAdjusted", { name: cu.name, amount: thbText(input.amountMinor), credit: input.direction === "credit", reason: input.reason, balance: thbText(input.bucket === "gift" ? nb.giftMinor : nb.walletMinor) });
    save(s); return { ok: true, wallet: adminWalletOf(s, input.userId) };
  },
  async topUps(q) {
    const s = adminStore("topups"); if (!s) return denied(); expireDemoTopUps(s);
    const term = q.q?.trim().toLowerCase() ?? "";
    const rows = (s.topUps ?? []).map((t) => adminTopUpOf(s, t)).filter((t) => (!term || t.email.includes(term) || t.number.toLowerCase().includes(term) || (t.customerRef ?? "").toLowerCase().includes(term)) && (!q.status || t.status === q.status)
      && (!q.provider || t.provider === q.provider) && (!q.from || Date.parse(t.createdAt) >= bangkokStart(q.from)) && (!q.to || Date.parse(t.createdAt) < bangkokStart(q.to) + DAY_MS))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = Math.max(1, Math.floor(q.page ?? 1));
    return { ok: true, data: { total: rows.length, page, pageSize: TOPUP_PAGE_SIZE, topUps: rows.slice((page - 1) * TOPUP_PAGE_SIZE, page * TOPUP_PAGE_SIZE) } };
  },
  async topUp(tid) {
    const s = adminStore("topups"); if (!s) return denied(); expireDemoTopUps(s);
    const t = findTopUp(s, tid); return t ? { ok: true, topUp: adminTopUpDetailOf(s, t) } : { ok: false, error: TOPUP_ERRORS.notFound };
  },
  async closeTopUp(tid, action, reason) {
    const s = adminStore("topups"); if (!s) return denied(); expireDemoTopUps(s);
    if (!closeReasonOk(reason)) return { ok: false, error: TOPUP_ERRORS.reason };
    const t = findTopUp(s, tid); if (!t) return { ok: false, error: TOPUP_ERRORS.notFound };
    if (t.status !== "pending") return { ok: false, error: TOPUP_ERRORS.notPending };
    const at = new Date().toISOString(); const admin = current(s)!;
    Object.assign(t, { status: action === "fail" ? "failed" : "cancelled", closedAt: at, closedById: admin.id, failureReason: reason.trim() });
    (s.audit ??= []).push({ userId: t.userId, adminId: admin.id, action: action === "fail" ? "topup_failed" : "topup_cancelled", detail: `${t.number} · ${reason.trim()}`, createdAt: at });
    save(s); return { ok: true, topUp: adminTopUpDetailOf(s, t) };
  },
  async confirmTopUp(tid, receivedMinor, bankRef) {
    const s = adminStore("topups"); if (!s) return denied(); expireDemoTopUps(s);
    if (!Number.isSafeInteger(receivedMinor) || receivedMinor <= 0) return { ok: false, error: TOPUP_ERRORS.received };
    const ref = bankRef.trim(); if (ref.length > 80) return { ok: false, error: TOPUP_ERRORS.bankRef };
    const t = findTopUp(s, tid); if (!t) return { ok: false, error: TOPUP_ERRORS.notFound };
    if (t.method !== "bank") return { ok: false, error: TOPUP_ERRORS.notBank };
    if (t.status !== "pending" && t.status !== "expired") return { ok: false, error: TOPUP_ERRORS.notWaiting };
    const amountText = `${emailMoney(t.amountMinor, t.currency)} ${t.currency}`;
    if (receivedMinor !== t.amountMinor) return { ok: false, error: receivedMismatch(amountText) };
    if ((s.ledger[t.userId] ?? []).some((r) => r.type === "top_up" && r.ref === t.number)) return { ok: false, error: TOPUP_ERRORS.notWaiting }; // never twice
    const at = new Date().toISOString(); const admin = current(s)!;
    Object.assign(t, { status: "credited", paidAt: at, creditedAt: at, closedAt: null, failureReason: t.status === "expired" ? "Confirmed after it expired." : null, confirmedById: admin.id, providerRef: ref || t.providerRef });
    (s.ledger[t.userId] ??= []).push({ id: id(), createdAt: at, bucket: "wallet", type: "top_up", ref: t.number, amountMinor: t.creditMinor });
    (s.audit ??= []).push({ userId: t.userId, adminId: admin.id, action: "topup_confirmed", detail: `${t.number} · ${amountText} received${ref ? ` · bank ref ${ref}` : ""}`, createdAt: at });
    const cu = s.users.find((x) => x.id === t.userId);
    if (cu) demoMail(s, cu.email, "topUp", { name: cu.name, number: t.number, amount: thbText(t.creditMinor), paid: `${emailMoney(t.amountMinor, t.currency)} (bank transfer)`, balance: thbText(balanceData(s, cu.id).walletMinor) });
    save(s); return { ok: true, topUp: adminTopUpDetailOf(s, t) };
  },
  async bankSettings() {
    const s = adminStore("topups"); if (!s) return denied();
    return { ok: true, settings: demoBank(s), history: bankHistoryOf(s) };
  },
  async saveBankSettings(input) {
    const s = adminStore("topups"); if (!s) return denied();
    const now = Date.now(); while (bankTries.length && now - bankTries[0] > BANK_WRITE_LIMIT.windowMs) bankTries.shift();
    if (bankTries.length >= BANK_WRITE_LIMIT.max) return { ok: false, error: BANK_ERRORS.limit };
    bankTries.push(now);
    const p = parseBankSettings(input); if (typeof p === "string") return { ok: false, error: p };
    const detail = bankChange(demoBank(s), p);
    if (detail) { s.bank = p; (s.bankEvents ??= []).push({ adminId: current(s)!.id, detail, createdAt: new Date(now).toISOString() }); save(s); }
    return { ok: true, settings: demoBank(s), history: bankHistoryOf(s) };
  },
  async filters() { const s = adminStore("filters"); if (!s) return denied(); return { ok: true, config: demoFilters(s) }; },
  async products() { if (!adminStore("products")) return denied(); return { ok: true, products: [...demoCatalogAll()].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")) }; },
  async product(pid) { if (!adminStore("products")) return denied(); const p = demoCatalogAll().find((x) => x.id === pid); return p ? { ok: true, product: p } : { ok: false, error: PRODUCT_ERRORS.notFound }; },
  async saveProduct(input, isNew) {
    if (!adminStore("products")) return denied(); if (!productTry()) return { ok: false, error: PRODUCT_ERRORS.limit };
    const r = parseProduct(input, { allowData: true }); if (!r.ok) return r;
    const all = demoCatalogAll(); const i = all.findIndex((x) => x.id === r.product.id);
    if (isNew && i >= 0) return { ok: false, error: PRODUCT_ERRORS.idTaken };
    if (!isNew && i < 0) return { ok: false, error: PRODUCT_ERRORS.notFound };
    const p = { ...r.product, updatedAt: new Date().toISOString() };
    const next = isNew ? [p, ...all] : all.map((x) => (x.id === p.id ? p : x));
    return saveDemoCatalog(next) ? { ok: true, product: p } : { ok: false, error: PRODUCT_ERRORS.storage };
  },
  async deleteProduct(pid) {
    if (!adminStore("products")) return denied(); if (!productTry()) return { ok: false, error: PRODUCT_ERRORS.limit };
    const all = demoCatalogAll(); if (!all.some((x) => x.id === pid)) return { ok: false, error: PRODUCT_ERRORS.notFound };
    return saveDemoCatalog(all.filter((x) => x.id !== pid)) ? { ok: true } : { ok: false, error: PRODUCT_ERRORS.storage };
  },
  // Demo: no upload server, the checked data URL itself is the image (saved with the product in this browser).
  async uploadProductImage(dataUrl) {
    if (!adminStore("products")) return denied(); const b = dataUrlBytes(dataUrl);
    return b && imageOk(b) ? { ok: true, url: dataUrl } : { ok: false, error: PRODUCT_ERRORS.imageBad };
  },
  async addFilterOption(group, label) { const s = adminStore("filters"); if (!s) return denied(); return filterEdit(s, (c) => addOption(c, group, label, id())); },
  async updateFilterOption(oid, p) { const s = adminStore("filters"); if (!s) return denied(); return filterEdit(s, (c) => updateOption(c, oid, p)); },
  async deleteFilterOption(oid) { const s = adminStore("filters"); if (!s) return denied(); return filterEdit(s, (c) => deleteOption(c, oid)); },
  async updateFilterGroup(gid, p) { const s = adminStore("filters"); if (!s) return denied(); return filterEdit(s, (c) => ({ ok: true, cfg: updateGroup(c, gid, p) })); },
  async purchasePopup() { const s = adminStore("products"); if (!s) return denied(); return { ok: true, ...popupData(s) }; },
  async feeSettings() { const s = adminStore("fees"); if (!s) return denied(); return { ok: true, ...feeData(s) }; },
  async saveFeeSettings(input) {
    const s = adminStore("fees"); if (!s) return denied();
    const now = Date.now(); while (feeTries.length && now - feeTries[0] > FEE_WRITE_LIMIT.windowMs) feeTries.shift();
    if (feeTries.length >= FEE_WRITE_LIMIT.max) return { ok: false, error: FEE_ERRORS.limit }; feeTries.push(now);
    const p = parseFeeSettings(input, isCountry); if (typeof p === "string") return { ok: false, error: p };
    const detail = feeChange(s.fees ?? FEE_DEFAULTS, p);
    if (detail) { s.fees = p; (s.feeEvents ??= []).push({ adminId: current(s)!.id, detail, createdAt: new Date().toISOString() }); save(s); }
    return { ok: true, ...feeData(s) };
  },
  async savePurchasePopup(input) {
    const s = adminStore("products"); if (!s) return denied();
    const now = Date.now(); while (popupTries.length && now - popupTries[0] > POPUP_WRITE_LIMIT.windowMs) popupTries.shift();
    if (popupTries.length >= POPUP_WRITE_LIMIT.max) return { ok: false, error: POPUP_ERRORS.limit }; popupTries.push(now);
    const all = demoCatalogAll(); const p = parsePopupSettings(input, (pid) => all.some((x) => x.id === pid)); if (typeof p === "string") return { ok: false, error: p };
    const detail = popupChange(s.popup ?? POPUP_DEFAULTS, p, (pid) => all.find((x) => x.id === pid)?.name ?? pid);
    if (detail) { s.popup = p; (s.popupEvents ??= []).push({ adminId: current(s)!.id, detail, createdAt: new Date().toISOString() }); save(s); }
    return { ok: true, ...popupData(s) };
  },
  async menu() { const s = adminStore("menu"); if (!s) return denied(); return { ok: true, items: s.menu ?? DEFAULT_MENU }; },
  // Same parse + rules as the API (lib/menu.ts), so the demo gives the same errors.
  async addMenuItem(input) { const s = adminStore("menu"); if (!s) return denied(); const p = parseMenuInput(input as unknown as Record<string, unknown>, false); return menuEdit(s, typeof p === "string" ? p : (items) => addMenuItem(items, p as MenuInput, id())); },
  async updateMenuItem(mid, patch) { const s = adminStore("menu"); if (!s) return denied(); const p = parseMenuPatch(patch as Record<string, unknown>); return menuEdit(s, typeof p === "string" ? p : (items) => updateMenuItem(items, mid, p)); },
  async deleteMenuItem(mid) { const s = adminStore("menu"); if (!s) return denied(); return menuEdit(s, (items) => deleteMenuItem(items, mid)); },
  async keyCounts() {
    const s = adminStore("products"); if (!s) return denied(); const counts: Record<string, KeyCounts> = {};
    for (const k of s.productKeys ?? []) (counts[k.productId] ??= emptyCounts())[k.status]++;
    return { ok: true, counts };
  },
  async keyInventory(productId) {
    const s = adminStore("products"); if (!s) return denied(); if (!demoCatalogAll().some((p) => p.id === productId)) return { ok: false, error: KEY_ERRORS.notFound };
    const mine = (s.productKeys ?? []).filter((k) => k.productId === productId); const counts = emptyCounts(); mine.forEach((k) => counts[k.status]++);
    return { ok: true, inventory: { counts, keys: [...mine].reverse().slice(0, 500).map((k) => ({ id: k.id, last4: k.code.slice(-4), status: k.status, batch: k.batch, createdAt: k.createdAt })) } };
  },
  async addKeys(productId, text, batch) {
    const s = adminStore("products"); if (!s) return denied();
    const p = demoCatalogAll().find((x) => x.id === productId); if (!p) return { ok: false, error: KEY_ERRORS.notFound }; if (p.kind !== "game_key") return { ok: false, error: KEY_ERRORS.notKey };
    if (batch.trim().length > 40) return { ok: false, error: KEY_ERRORS.batch };
    const parsed = parseKeyText(text.slice(0, 200_000));
    if (!parsed.codes.length) return { ok: false, error: KEY_ERRORS.empty };
    if (parsed.codes.length > KEYS_PER_UPLOAD) return { ok: false, error: KEY_ERRORS.tooMany };
    const now = Date.now(); while (keyTries.length && now - keyTries[0] > KEY_UPLOAD_LIMIT.windowMs) keyTries.shift();
    if (keyTries.length >= KEY_UPLOAD_LIMIT.max) return { ok: false, error: KEY_ERRORS.limit }; keyTries.push(now);
    const have = new Set((s.productKeys ?? []).filter((k) => k.productId === productId).map((k) => k.code));
    const fresh = parsed.codes.filter((c) => !have.has(c)); const at = new Date().toISOString();
    (s.productKeys ??= []).push(...fresh.map((code) => ({ id: id(), productId, code, status: "available" as const, batch: batch.trim() || null, createdAt: at })));
    save(s); return { ok: true, result: { added: fresh.length, duplicates: parsed.duplicates + parsed.codes.length - fresh.length, invalid: parsed.invalid } };
  },
  async removeKey(productId, keyId) {
    const s = adminStore("products"); if (!s) return denied();
    const k = (s.productKeys ?? []).find((x) => x.id === keyId && x.productId === productId); if (!k) return { ok: false, error: KEY_ERRORS.keyNotFound };
    if (k.status !== "available") return { ok: false, error: KEY_ERRORS.notAvailable };
    s.productKeys = s.productKeys!.filter((x) => x !== k); save(s); return { ok: true };
  },
  async giftCards() {
    const s = adminStore("giftcards"); if (!s) return denied();
    if (!s.giftSeeded) { await seedGift(s); save(s); }
    return { ok: true, cards: [...s.giftCards].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ codeHash: _h, redeemedById, ...c }) => ({ ...c, redeemedBy: redeemedById ? s.users.find((x) => x.id === redeemedById)?.email ?? "Deleted user" : null })) };
  },
  async createGiftCards(input) {
    const s = adminStore("giftcards"); if (!s) return denied();
    const error = checkNewGiftCards(input); if (error) return { ok: false, error };
    await seedGift(s); const at = new Date().toISOString(); const created: { id: string; code: string }[] = [];
    for (let i = 0; i < input.count; i++) {
      const code = generateCode(); const cid = id(); created.push({ id: cid, code });
      s.giftCards.push({ id: cid, codeHash: await hashCode(code), last4: code.slice(-4), amountMinor: input.amountMinor, note: input.note?.trim() || null, expiresAt: input.expiresAt, disabled: false, createdAt: at, createdBy: "demo-admin", redeemedAt: null, redeemedById: null });
    }
    save(s); return { ok: true, created };
  },
  async setGiftCardDisabled(cid, disabled) {
    const s = adminStore("giftcards"); if (!s) return denied();
    const c = s.giftCards.find((x) => x.id === cid); if (!c || c.redeemedAt) return { ok: false, error: "Gift card not found or already redeemed" };
    c.disabled = disabled; save(s); return { ok: true };
  },
  // Email previews: the demo outbox = every email "sent" in this browser (newest first); a test email goes to the signed-in admin.
  // N2: same rule as the server: only the master admin sees the outbox (the demo keeps it in this browser only).
  async emailOutbox() { const s = adminStore(); if (!s) return denied(); return { ok: true, outbox: isMasterRole(current(s)!.role) ? [...(s.outbox ?? [])].reverse() : null, resend: false, failures: isMasterRole(current(s)!.role) ? [] : null }; }, // the demo never fails to "send"
  async sendTestEmail(eid) {
    const s = adminStore(); if (!s) return denied(); const me = current(s)!;
    const idK = eid as EmailId; const mail = renderEmail(idK, sampleEmail(idK, siteBase(), absCover) as never, siteBase());
    const out = (s.outbox ??= []); out.push({ to: me.email, ...mail, subject: `[Test] ${mail.subject}`, template: idK, sentAt: new Date().toISOString() }); if (out.length > 50) out.splice(0, out.length - 50);
    save(s); return { ok: true, to: me.email };
  },
};
