import type { CurrencyData } from "@/lib/currency/money";
import type { CurrencyPatch } from "@/lib/currency/rules";
import type { CartEntry, Product } from "@/lib/catalog";
import type { KeyCounts, KeyInventory, KeyUploadResult } from "@/lib/key-inventory";
import type { GameKey } from "@/lib/keys";
import type { BalanceData, GiftCard, NewGiftCards } from "@/lib/gift-cards";
import type { NewReturn, ReturnRequest } from "@/lib/returns";
import type { NewTicket, Ticket, TicketThread } from "@/lib/tickets";
import type { PromoCode, PromoErrors, PromoInput, PublicPromo } from "@/lib/promo";
import type { FilterConfig, FilterGroupId, GroupPatch, OptionPatch } from "@/lib/filters";
import type { MenuInput, MenuItem, MenuPatch } from "@/lib/menu";
import type { AdminWallet, Adjustment } from "@/lib/wallet";
import type { AuditRow, NewUser, Role } from "@/lib/users";
import type { AdminTopUpDetail, AdminTopUpPage, AdminTopUpQuery, NewTopUp, PaymentStart, PaymentsConfig, TopUp } from "@/lib/topup";
export type { AdminTopUpDetail, AdminTopUpPage, AdminTopUpQuery, NewTopUp, PaymentStart, PaymentsConfig, TopUp };
export type { AdminWallet, Adjustment };
export type { NewReturn, ReturnRequest, NewTicket, Ticket, TicketThread };
export type { GameKey, BalanceData, GiftCard, NewGiftCards, PromoCode, PromoErrors, PromoInput, PublicPromo };

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean; image?: string | null; role: string; createdAt: string; currency?: string | null;
  avatar?: string | null; country?: string | null; marketingOptIn?: boolean; marketingChoiceAt?: string | null };
export type ProfilePatch = { name?: string; avatar?: string | null; country?: string | null; marketingOptIn?: boolean };
// Customer login history row. ip is already masked by the API.
export type LoginRow = { method: string; ip: string; userAgent: string | null; createdAt: string };
export type OrderItem = { id: string; name: string; kind: "game_key" | "hardware" | string; platform?: string | null; region?: string | null; quantity: number; unitPriceCents: number; demoKey?: string; revealedAt?: string | null };
// currency + totalCents = what was charged (minor units). baseTotalMinor = same total in THB satang; fxRate = charged units per 1 THB.
export type Order = { id: string; number: string; status: string; currency: string; totalCents: number; baseCurrency?: string; baseTotalMinor?: number | null; fxRate?: string | null; ratesAt?: string | null; isSample?: boolean; createdAt: string; items: OrderItem[] };
export type PaymentMethod = { id: string; brand: string; last4: string; expMonth: number; expYear: number };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string };
export type SiteConfig = { google: boolean; stripe: boolean; email: boolean; sampleOrders: boolean; payments: PaymentsConfig };
export type DemoInbox = { demoLink?: string };

export interface AccountApi {
  mode: "demo" | "server";
  config(): Promise<SiteConfig>;
  getSession(): Promise<SessionUser | null>;
  signUp(input: { name: string; email: string; password: string; marketingOptIn: boolean; role?: "customer" | "seller"; callbackPath?: string }): Promise<Result<DemoInbox>>;
  signIn(input: { email: string; password: string; rememberMe?: boolean; callbackPath?: string }): Promise<Result>;
  signInGoogle(callbackPath: string): Promise<Result>;
  signOut(): Promise<void>;
  resendVerification(email: string, callbackPath?: string): Promise<Result<DemoInbox>>;
  verifyEmail(token: string): Promise<Result>;
  requestReset(email: string): Promise<Result<DemoInbox>>;
  resetPassword(token: string, password: string): Promise<Result>;
  updateName(name: string): Promise<Result>;
  updateProfile(patch: ProfilePatch): Promise<Result>;
  loginHistory(): Promise<Result<{ logins: LoginRow[] }>>;
  changePassword(current: string, next: string): Promise<Result>;
  listOrders(): Promise<Result<{ orders: Order[] }>>;
  createSampleOrder(): Promise<Result>;
  listPaymentMethods(): Promise<Result<{ configured: boolean; methods: PaymentMethod[] }>>;
  addPaymentMethod(demoCard?: { brand: string; last4: string }): Promise<Result<{ redirect?: string }>>;
  removePaymentMethod(id: string): Promise<Result>;
  currencies(): Promise<CurrencyData | null>;
  setCurrency(code: string): Promise<Result>;
  // Account cart (signed in). Guest cart lives in localStorage (app/components/cart-provider.tsx).
  cart(): Promise<Result<{ items: CartEntry[] }>>;
  setCartItem(productId: string, qty: number): Promise<Result<{ items: CartEntry[] }>>; // qty 0 removes
  mergeCart(items: CartEntry[]): Promise<Result<{ items: CartEntry[] }>>;
  clearCart(): Promise<Result<{ items: CartEntry[] }>>;
  // Game keys (one per unit). code is null until revealed; revealKey stores revealed_at once and logs every reveal (audit).
  listKeys(): Promise<Result<{ keys: GameKey[] }>>;
  getKey(id: string): Promise<Result<{ key: GameKey }>>;
  revealKey(id: string): Promise<Result<{ key: GameKey }>>;
  // Account favorites (product ids, newest first). Guest favorites live in localStorage (app/components/favorites-provider.tsx).
  favorites(): Promise<Result<{ ids: string[] }>>;
  addFavorite(productId: string): Promise<Result<{ ids: string[] }>>;
  removeFavorite(productId: string): Promise<Result<{ ids: string[] }>>;
  mergeFavorites(ids: string[]): Promise<Result<{ ids: string[] }>>;
  // Balance (THB satang). Redeem is rate limited (lib/gift-cards.ts REDEEM_LIMIT).
  balance(): Promise<Result<{ balance: BalanceData }>>;
  redeemGiftCard(code: string): Promise<Result<{ amountMinor: number; balance: BalanceData }>>;
  // Wallet top-ups (T1, lib/topup.ts). create only makes a pending top-up; the provider webhook credits the wallet.
  // simulateTopUp: demo store + dev adapter only (resend = same event again, to show a double webhook credits once).
  topUps(): Promise<Result<{ topUps: TopUp[]; dailyLeftMinor: number }>>; // dailyLeftMinor = daily cap left, THB satang
  topUp(id: string): Promise<Result<{ topUp: TopUp }>>;
  createTopUp(input: NewTopUp): Promise<Result<{ topUp: TopUp; payment: PaymentStart | null }>>;
  simulateTopUp(id: string, outcome: "paid" | "failed" | "resend"): Promise<Result<{ topUp: TopUp; result: string }>>;
  // Returns (lib/returns.ts): one order line + quantity. Keys only while not revealed.
  listReturns(): Promise<Result<{ returns: ReturnRequest[] }>>;
  requestReturn(input: NewReturn): Promise<Result<{ ret: ReturnRequest }>>;
  // Support tickets (lib/tickets.ts). getTicket marks support replies as read.
  listTickets(): Promise<Result<{ tickets: Ticket[]; unread: number }>>;
  ticketUnread(): Promise<number>;
  getTicket(id: string): Promise<Result<{ ticket: TicketThread }>>;
  createTicket(input: NewTicket): Promise<Result<{ id: string }>>;
  replyTicket(id: string, body: string): Promise<Result>;
  closeTicket(id: string): Promise<Result>;
  // Promo codes (guests too). Returns the public rules; the cart computes the discount with lib/promo.ts promoDiscount. gone = code no longer exists / usable.
  validatePromo(code: string): Promise<Result<{ promo: PublicPromo }> & { gone?: boolean }>;
  // Admin filter config for the storefront (lib/filters.ts, public). null = could not load → catalog defaults.
  filters(): Promise<FilterConfig | null>;
  // Published products (task B). null = could not load → the built-in seed stays.
  catalog(): Promise<Product[] | null>;
  // Store menu (task D, public). null = could not load → the default menu stays.
  menu(): Promise<MenuItem[] | null>;
}

// Admin panel
export type AdminUserRow = { id: string; name: string; email: string; emailVerified: boolean; role: string; createdAt: string; marketingOptIn: boolean; methods: string[]; lastLogin: string | null; loginCount: number; balanceMinor: number }; // balance = wallet + gift (THB satang)
export type AdminStats = { total: number; verified: number; admins: number; new1: number; new7: number; new30: number; marketing: number; logins7: number; active7: number; methods: { method: string; users: number }[]; daily: { day: string; count: number }[]; recent: AdminUserRow[]; timezone: string; owed: { walletMinor: number; giftMinor: number } };
export type AdminUserQuery = { q?: string; method?: string; verified?: string; role?: string; sort?: string; page?: number };
export type AdminUserPage = { total: number; page: number; pageSize: number; users: AdminUserRow[] };
export type AdminLogin = { method: string; ipAddress: string | null; userAgent: string | null; createdAt: string };
export type AdminUserDetail = {
  user: { id: string; name: string; email: string; emailVerified: boolean; role: string; createdAt: string; updatedAt: string; termsAcceptedAt: string | null; marketingOptIn: boolean };
  accounts: { method: string; createdAt: string }[];
  sessions: { createdAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null }[];
  logins: AdminLogin[];
  // byCurrency: totals per charged currency (step 5: amounts in different currencies are never added together).
  orders: { count: number; byCurrency: { currency: string; totalMinor: number }[] };
  wallet: AdminWallet;
  topUps: TopUp[]; // T1: latest 20
  audit: AuditRow[]; // admin actions on this user (S7), newest first
};

// Admin currencies. Rates are decimal strings, units per 1 USD.
export type AdminCurrency = { code: string; name: string; symbol: string; decimals: number; enabled: boolean; chargeable: boolean; autoRate: string | null; overrideRate: string | null; roundStep: number; rateUpdatedAt: string | null; updatedAt: string };
export type RateFetchStatus = { source: string; lastAttemptAt: string | null; lastSuccessAt: string | null; providerUpdatedAt: string | null; lastError: string | null };
export type AdminCurrencyState = { currencies: AdminCurrency[]; status: RateFetchStatus };
export type { CurrencyPatch };

export interface AdminApi {
  me(): Promise<boolean | null>; // null = could not check (server error / not answering), not the same as "not an admin"
  stats(): Promise<Result<{ stats: AdminStats }>>;
  users(query: AdminUserQuery): Promise<Result<{ data: AdminUserPage }>>;
  user(id: string): Promise<Result<{ data: AdminUserDetail }>>;
  currencies(): Promise<Result<{ data: AdminCurrencyState }>>;
  updateCurrency(code: string, patch: CurrencyPatch): Promise<Result>;
  refreshRates(): Promise<Result>;
  giftCards(): Promise<Result<{ cards: GiftCard[] }>>;
  createGiftCards(input: NewGiftCards): Promise<Result<{ created: { id: string; code: string }[] }>>;
  setGiftCardDisabled(id: string, disabled: boolean): Promise<Result>;
  promoCodes(): Promise<Result<{ promos: PromoCode[] }>>;
  promoCode(id: string): Promise<Result<{ promo: PromoCode }>>;
  savePromo(id: string | null, input: PromoInput): Promise<Result<{ promo: PromoCode }> & { errors?: PromoErrors }>; // id null = create
  setPromoEnabled(id: string, enabled: boolean): Promise<Result>;
  deletePromo(id: string): Promise<Result>;
  returns(): Promise<Result<{ returns: ReturnRequest[] }>>;
  updateReturn(id: string, status: string, note: string | null): Promise<Result>;
  // Tickets (C11). reply → answered + customer unread (+ email on the server). Opening a thread changes nothing.
  tickets(): Promise<Result<{ tickets: Ticket[] }>>;
  ticket(id: string): Promise<Result<{ ticket: TicketThread }>>;
  replyTicket(id: string, body: string): Promise<Result>;
  setTicketStatus(id: string, status: string): Promise<Result>;
  // Users (S7): add a user (set-password email; demoLink in the demo) and change a role (audited).
  addUser(input: NewUser): Promise<Result<{ id: string } & DemoInbox>>;
  setUserRole(id: string, role: Role): Promise<Result>;
  // Admin wallet (S8): new ledger row, never an edit. Returns the user's new wallet.
  adjustBalance(input: Adjustment): Promise<Result<{ wallet: AdminWallet }>>;
  // Top-ups (T1): list with filters, detail with the webhook event log, mark failed / cancel a pending one (reason + audit). Never credits.
  topUps(query: AdminTopUpQuery): Promise<Result<{ data: AdminTopUpPage }>>;
  topUp(id: string): Promise<Result<{ topUp: AdminTopUpDetail }>>;
  closeTopUp(id: string, action: "fail" | "cancel", reason: string): Promise<Result<{ topUp: AdminTopUpDetail }>>;
  // Filter manager (S4). Every write returns the whole new config.
  filters(): Promise<Result<{ config: FilterConfig }>>;
  // Products (task B): drafts included. Image = upload the cropped 800 x 1000 file first, then save the product with its url.
  products(): Promise<Result<{ products: Product[] }>>;
  product(id: string): Promise<Result<{ product: Product }>>;
  saveProduct(input: Record<string, unknown>, isNew: boolean): Promise<Result<{ product: Product }>>;
  deleteProduct(id: string): Promise<Result>;
  uploadProductImage(dataUrl: string): Promise<Result<{ url: string }>>;
  // Game key inventory (task B): counts per product, one product's keys (last 4 only), paste / CSV upload, remove an available key.
  keyCounts(): Promise<Result<{ counts: Record<string, KeyCounts> }>>;
  keyInventory(productId: string): Promise<Result<{ inventory: KeyInventory }>>;
  addKeys(productId: string, text: string, batch: string): Promise<Result<{ result: KeyUploadResult }>>;
  removeKey(productId: string, keyId: string): Promise<Result>;
  addFilterOption(group: FilterGroupId, label: string): Promise<Result<{ config: FilterConfig }>>;
  updateFilterOption(id: string, patch: OptionPatch): Promise<Result<{ config: FilterConfig }>>;
  deleteFilterOption(id: string): Promise<Result<{ config: FilterConfig }>>;
  updateFilterGroup(id: FilterGroupId, patch: GroupPatch): Promise<Result<{ config: FilterConfig }>>;
  // Store menu (task D). Every write returns the whole menu.
  menu(): Promise<Result<{ items: MenuItem[] }>>;
  addMenuItem(input: MenuInput): Promise<Result<{ items: MenuItem[] }>>;
  updateMenuItem(id: string, patch: MenuPatch): Promise<Result<{ items: MenuItem[] }>>;
  deleteMenuItem(id: string): Promise<Result<{ items: MenuItem[] }>>;
}
