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
  signUp(input: { name: string; email: string; password: string; marketingOptIn: boolean }): Promise<Result<DemoInbox>>;
  signIn(input: { email: string; password: string }): Promise<Result>;
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
