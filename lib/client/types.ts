import type { CurrencyData } from "@/lib/currency/money";
import type { CurrencyPatch } from "@/lib/currency/rules";
import type { CartEntry } from "@/lib/catalog";

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean; image?: string | null; role: string; createdAt: string; currency?: string | null };
export type OrderItem = { id: string; name: string; kind: "game_key" | "hardware" | string; platform?: string | null; region?: string | null; quantity: number; unitPriceCents: number; demoKey?: string };
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
  me(): Promise<boolean>;
  stats(): Promise<Result<{ stats: AdminStats }>>;
  users(query: AdminUserQuery): Promise<Result<{ data: AdminUserPage }>>;
  user(id: string): Promise<Result<{ data: AdminUserDetail }>>;
  currencies(): Promise<Result<{ data: AdminCurrencyState }>>;
  updateCurrency(code: string, patch: CurrencyPatch): Promise<Result>;
  refreshRates(): Promise<Result>;
}
