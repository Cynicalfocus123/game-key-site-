export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean; image?: string | null; role: string; createdAt: string };
export type OrderItem = { id: string; name: string; kind: "game_key" | "hardware" | string; platform?: string | null; region?: string | null; quantity: number; unitPriceCents: number; demoKey?: string };
export type Order = { id: string; number: string; status: string; currency: string; totalCents: number; isSample?: boolean; createdAt: string; items: OrderItem[] };
export type PaymentMethod = { id: string; brand: string; last4: string; expMonth: number; expYear: number };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string };
export type SiteConfig = { google: boolean; stripe: boolean; email: boolean; sampleOrders: boolean };
export type DemoInbox = { demoLink?: string };

export interface AccountApi {
  mode: "demo" | "server";
  config(): Promise<SiteConfig>;
  getSession(): Promise<SessionUser | null>;
  signUp(input: { name: string; email: string; password: string; marketingOptIn: boolean; callbackPath?: string; admin?: boolean }): Promise<Result<DemoInbox>>;
  signIn(input: { email: string; password: string; callbackPath?: string }): Promise<Result>;
  signInGoogle(callbackPath: string): Promise<Result>;
  signOut(): Promise<void>;
  resendVerification(email: string): Promise<Result<DemoInbox>>;
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

export interface AdminApi {
  me(): Promise<boolean>;
  stats(): Promise<Result<{ stats: AdminStats }>>;
  users(query: AdminUserQuery): Promise<Result<{ data: AdminUserPage }>>;
  user(id: string): Promise<Result<{ data: AdminUserDetail }>>;
}
