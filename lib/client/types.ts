import type { CurrencyData } from "@/lib/currency/money";
import type { CurrencyPatch } from "@/lib/currency/rules";
import type { CartEntry } from "@/lib/catalog";
import type { GameKey } from "@/lib/keys";
import type { BalanceData, GiftCard, NewGiftCards } from "@/lib/gift-cards";
import type { NewReturn, ReturnRequest } from "@/lib/returns";
import type { NewTicket, Ticket, TicketThread } from "@/lib/tickets";
import type { PromoCode, PromoErrors, PromoInput, PublicPromo } from "@/lib/promo";
import type { FilterConfig, FilterGroupId, GroupPatch, OptionPatch } from "@/lib/filters";
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
export type SiteConfig = { google: boolean; stripe: boolean; email: boolean; sampleOrders: boolean };
export type DemoInbox = { demoLink?: string };

export interface AccountApi {
  mode: "demo" | "server";
  config(): Promise<SiteConfig>;
  getSession(): Promise<SessionUser | null>;
  signUp(input: { name: string; email: string; password: string; marketingOptIn: boolean; callbackPath?: string }): Promise<Result<DemoInbox>>;
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
}

// Admin panel
export type AdminUserRow = { id: string; name: string; email: string; emailVerified: boolean; role: string; createdAt: string; marketingOptIn: boolean; methods: string[]; lastLogin: string | null; loginCount: number };
export type AdminStats = { total: number; verified: number; admins: number; new1: number; new7: number; new30: number; marketing: number; logins7: number; active7: number; methods: { method: string; users: number }[]; daily: { day: string; count: number }[]; recent: AdminUserRow[]; timezone: string };
export type AdminUserQuery = { q?: string; method?: string; verified?: string; role?: string; sort?: string; page?: number };
export type AdminUserPage = { total: number; page: number; pageSize: number; users: AdminUserRow[] };
export type AdminLogin = { method: string; ipAddress: string | null; userAgent: string | null; createdAt: string };
export type AdminUserDetail = {
  user: { id: string; name: string; email: string; emailVerified: boolean; role: string; createdAt: string; updatedAt: string; termsAcceptedAt: string | null; marketingOptIn: boolean };
  accounts: { method: string; createdAt: string }[];
  sessions: { createdAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null }[];
  logins: AdminLogin[];
  orders: { count: number; totalCents: number };
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
  // Filter manager (S4). Every write returns the whole new config.
  filters(): Promise<Result<{ config: FilterConfig }>>;
  addFilterOption(group: FilterGroupId, label: string): Promise<Result<{ config: FilterConfig }>>;
  updateFilterOption(id: string, patch: OptionPatch): Promise<Result<{ config: FilterConfig }>>;
  deleteFilterOption(id: string): Promise<Result<{ config: FilterConfig }>>;
  updateFilterGroup(id: FilterGroupId, patch: GroupPatch): Promise<Result<{ config: FilterConfig }>>;
}
