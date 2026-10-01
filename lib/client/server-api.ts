import { createAuthClient } from "better-auth/react";
import { TERMS_VERSION } from "@/lib/terms";
import type { CurrencyData } from "@/lib/currency/money";
import type { CartEntry, Product } from "@/lib/catalog";
import type { KeyCounts, KeyInventory, KeyUploadResult } from "@/lib/key-inventory";
import type { NewReturn, ReturnRequest } from "@/lib/returns";
import type { NewTicket, Ticket, TicketThread } from "@/lib/tickets";
import type { FilterConfig } from "@/lib/filters";
import type { MenuItem } from "@/lib/menu";
import type { PopupEvent, PopupFeed, PopupSettings } from "@/lib/purchase-popup";
import type { AdminWallet } from "@/lib/wallet";
import type { AdminTopUpDetail, AdminTopUpPage, BankEvent, BankInfo, BankSettings, PaymentStart, TopUp } from "@/lib/topup";
import type { AdminPerm } from "@/lib/admin-perms";
import type { MyApplication, SellerDetail, SellerErrors, SellerFile } from "@/lib/sellers";
import type { Rating, TaxInfo } from "@/lib/orders";
import type { AddressErrors, BillingAddress, FeeEvent, FeeSettings } from "./types";
import type { AccountApi, AdminApi, EmailFailure, SentMail, AdminCurrencyState, AdminList, AdminMe, SellerList, BalanceData, GiftCard, PromoCode, PromoErrors, PublicPromo, GameKey, AdminStats, AdminUserDetail, AdminUserPage, LoginRow, Order, PaymentMethod, SessionUser, SiteConfig } from "./types";

const client = createAuthClient({ basePath: "/api/auth" });
type ErrLike = { message?: string; code?: string; status?: number } | null | undefined;
const fail = (e: ErrLike, fallback = "Something went wrong. Try again.") => ({ ok: false as const, error: e?.message || fallback, code: e?.code });
const origin = () => window.location.origin;

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number; errors?: PromoErrors & AddressErrors }> {
  try {
    const res = await fetch(url, { credentials: "include", ...init });
    const data = await res.json();
    return res.ok ? { ok: true, data } : { ok: false, error: data?.error || `Error ${res.status}`, status: res.status, errors: data?.errors };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}

async function cartCall(method: string, body?: object) {
  const r = await call<{ items: CartEntry[] }>("/api/cart", { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  return r.ok ? { ok: true as const, items: r.data.items } : r;
}

async function favCall(method: string, url: string, body?: object) {
  const r = await call<{ ids: string[] }>(url, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  return r.ok ? { ok: true as const, ids: r.data.ids } : r;
}

export const serverApi: AccountApi = {
  mode: "server",
  async config() {
    const r = await call<SiteConfig>("/api/config");
    return r.ok ? r.data : { google: false, stripe: false, email: false, sampleOrders: false, payments: { provider: "none", available: false, simulate: false } };
  },
  async getSession() {
    const { data } = await client.getSession();
    return (data?.user as unknown as SessionUser) ?? null;
  },
  async signUp({ name, email, password, marketingOptIn, termsVersion, role = "customer", callbackPath = "/account" }) {
    const { error } = await client.signUp.email({ name, email, password, marketingOptIn, termsVersion, role, callbackURL: `${origin()}${callbackPath}?verified=1` } as Parameters<typeof client.signUp.email>[0]);
    return error ? fail(error) : { ok: true };
  },
  async signIn({ email, password, rememberMe = true, callbackPath = "/account" }) {
    const { error } = await client.signIn.email({ email, password, rememberMe, callbackURL: `${origin()}${callbackPath}?verified=1` });
    if (error?.status === 403) return { ok: false, error: "Verify your email first. We sent a new link.", code: "EMAIL_NOT_VERIFIED" };
    return error ? fail(error, "Wrong email or password.") : { ok: true };
  },
  async signInGoogle(callbackPath) {
    // R7: the click under the "By continuing with Google you agree…" notice is recorded first (signed cookie, 10 min);
    // a new Google account is only created with it.
    const t = await call<{ version: string }>("/api/terms/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: TERMS_VERSION }) });
    if (!t.ok) return t;
    const { error } = await client.signIn.social({ provider: "google", callbackURL: `${origin()}${callbackPath}`, errorCallbackURL: `${origin()}/login?error=google` });
    return error ? fail(error, "Google login is not available yet.") : { ok: true };
  },
  async signOut() { await client.signOut(); },
  async resendVerification(email, callbackPath = "/account") {
    const { error } = await client.sendVerificationEmail({ email, callbackURL: `${origin()}${callbackPath}?verified=1` });
    return error ? fail(error) : { ok: true };
  },
  async verifyEmail() { return { ok: true }; }, // Server verifies via emailed link directly.
  async verifyCode(email, code) {
    const r = await call("/api/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
    return r.ok ? { ok: true } : r;
  },
  async requestReset(email) {
    const { error } = await client.requestPasswordReset({ email, redirectTo: `${origin()}/reset-password` });
    return error ? fail(error) : { ok: true };
  },
  async resetPassword(token, password) {
    const { error } = await client.resetPassword({ token, newPassword: password });
    return error ? fail(error, "Reset link is invalid or expired.") : { ok: true };
  },
  async updateName(name) {
    const { error } = await client.updateUser({ name });
    return error ? fail(error) : { ok: true };
  },
  async updateProfile(patch) {
    const { error } = await client.updateUser(patch as Parameters<typeof client.updateUser>[0]);
    return error ? fail(error, "Could not save your profile.") : { ok: true };
  },
  async loginHistory() {
    const r = await call<{ logins: LoginRow[] }>("/api/account/logins");
    return r.ok ? { ok: true, logins: r.data.logins } : r;
  },
  async changePassword(current, next) {
    const { error } = await client.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    return error ? fail(error, "Current password is wrong.") : { ok: true };
  },
  async listOrders() {
    const r = await call<{ orders: Order[] }>("/api/account/orders");
    return r.ok ? { ok: true, orders: r.data.orders } : r;
  },
  async listReturns() { const r = await call<{ returns: ReturnRequest[] }>("/api/account/returns"); return r.ok ? { ok: true, returns: r.data.returns } : r; },
  async requestReturn(input: NewReturn) {
    const r = await call<{ ret: ReturnRequest }>("/api/account/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, ret: r.data.ret } : r;
  },
  async listTickets() { const r = await call<{ tickets: Ticket[]; unread: number }>("/api/account/tickets"); return r.ok ? { ok: true, ...r.data } : r; },
  async ticketUnread() { const r = await call<{ unread: number }>("/api/account/tickets?unread=1"); return r.ok ? r.data.unread : 0; },
  async getTicket(id) { const r = await call<{ ticket: TicketThread }>(`/api/account/tickets?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, ticket: r.data.ticket } : r; },
  async createTicket(input: NewTicket) {
    const r = await call<{ id: string }>("/api/account/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, id: r.data.id } : r;
  },
  async replyTicket(id, reply) { const r = await call("/api/account/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reply }) }); return r.ok ? { ok: true } : r; },
  async closeTicket(id) { const r = await call("/api/account/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, close: true }) }); return r.ok ? { ok: true } : r; },
  async createSampleOrder() {
    const r = await call("/api/account/orders", { method: "POST" });
    return r.ok ? { ok: true } : r;
  },
  async getOrder(id) { const r = await call<{ order: Order }>(`/api/account/orders?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, order: r.data.order } : r; },
  async saveTaxInfo(id, taxInfo) {
    const r = await call<{ taxInfo: TaxInfo | null }>("/api/account/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, taxInfo }) });
    return r.ok ? { ok: true, taxInfo: r.data.taxInfo } : r;
  },
  async rateSeller(input) {
    const r = await call<{ rating: Rating }>("/api/account/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, rating: r.data.rating } : r;
  },
  async listPaymentMethods() {
    const r = await call<{ configured: boolean; methods: PaymentMethod[] }>("/api/account/payment-methods");
    return r.ok ? { ok: true, ...r.data } : r;
  },
  async addPaymentMethod() {
    const r = await call<{ url: string }>("/api/account/payment-methods", { method: "POST" });
    return r.ok ? { ok: true, redirect: r.data.url } : r;
  },
  async removePaymentMethod(id) {
    const r = await call(`/api/account/payment-methods?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return r.ok ? { ok: true } : r;
  },
  async currencies() {
    const r = await call<CurrencyData>("/api/currencies");
    return r.ok ? r.data : null;
  },
  async cart() { return cartCall("GET"); },
  async setCartItem(productId, qty) { return cartCall("PUT", { productId, qty }); },
  async mergeCart(items) { return cartCall("POST", { items }); },
  async clearCart() { return cartCall("DELETE"); },
  async favorites() { return favCall("GET", "/api/favorites"); },
  async addFavorite(productId) { return favCall("PUT", "/api/favorites", { productId }); },
  async removeFavorite(productId) { return favCall("DELETE", `/api/favorites?productId=${encodeURIComponent(productId)}`); },
  async mergeFavorites(ids) { return favCall("POST", "/api/favorites", { ids }); },
  async listKeys() { const r = await call<{ keys: GameKey[] }>("/api/account/keys"); return r.ok ? { ok: true, keys: r.data.keys } : r; },
  async getKey(id) { const r = await call<{ key: GameKey }>(`/api/account/keys?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, key: r.data.key } : r; },
  async revealKey(id) {
    const r = await call<{ key: GameKey }>("/api/account/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    return r.ok ? { ok: true, key: r.data.key } : r;
  },
  async balance() { const r = await call<BalanceData>("/api/account/balance"); return r.ok ? { ok: true, balance: r.data } : r; },
  async redeemGiftCard(code) {
    const r = await call<{ amountMinor: number; balance: BalanceData }>("/api/account/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    return r.ok ? { ok: true, ...r.data } : r;
  },
  async topUps() { const r = await call<{ topUps: TopUp[]; dailyLeftMinor: number; bank: BankInfo | null }>("/api/account/topups"); return r.ok ? { ok: true, ...r.data } : r; },
  async topUp(id) { const r = await call<{ topUp: TopUp }>(`/api/account/topups?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, topUp: r.data.topUp } : r; },
  async createTopUp(input) {
    const r = await call<{ topUp: TopUp; payment: PaymentStart | null }>("/api/account/topups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, ...r.data } : r;
  },
  async simulateTopUp(id, outcome) {
    const r = await call<{ topUp: TopUp; result: string }>("/api/account/topups/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, outcome }) });
    return r.ok ? { ok: true, ...r.data } : r;
  },
  async filters() { const r = await call<{ config: FilterConfig }>("/api/filters"); return r.ok ? r.data.config : null; },
  async catalog() { const r = await call<{ products: Product[] }>("/api/catalog"); return r.ok ? r.data.products : null; },
  async menu() { const r = await call<{ items: MenuItem[] }>("/api/menu"); return r.ok ? r.data.items : null; },
  async recentPurchases() { const r = await call<PopupFeed>("/api/recent-purchases"); return r.ok ? r.data : null; },
  async billingAddress() { const r = await call<{ address: BillingAddress | null }>("/api/account/billing-address"); return r.ok ? { ok: true, address: r.data.address } : r; },
  async saveBillingAddress(address) {
    const r = await call<{ address: BillingAddress }>("/api/account/billing-address", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(address) });
    return r.ok ? { ok: true, address: r.data.address } : r;
  },
  async fees() { const r = await call<{ settings: FeeSettings }>("/api/fees"); return r.ok ? r.data.settings : null; },
  async sellerStatus() { const r = await call<{ application: MyApplication | null }>("/api/sell"); return r.ok ? { ok: true, application: r.data.application } : r; },
  async uploadSellerFile(kind, file) {
    const form = new FormData(); form.append("kind", kind); form.append("file", file);
    const r = await call<{ file: SellerFile }>("/api/sell/files", { method: "POST", body: form });
    return r.ok ? { ok: true, file: r.data.file } : r;
  },
  async submitSeller(input) {
    try {
      const res = await fetch("/api/sell", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await res.json() as { application?: MyApplication; error?: string; errors?: SellerErrors };
      return res.ok && data.application ? { ok: true, application: data.application } : { ok: false, error: data.error || `Error ${res.status}`, errors: data.errors };
    } catch { return { ok: false, error: "Network error. Check your connection." }; }
  },
  async closeAccount(input) {
    const r = await call("/api/account/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true } : r;
  },
  async validatePromo(code) {
    const r = await call<{ promo: PublicPromo }>("/api/promo/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    return r.ok ? { ok: true, promo: r.data.promo } : { ok: false, error: r.error, gone: r.status === 404 || r.status === 400 };
  },
  async setCurrency(currency) {
    const { error } = await client.updateUser({ currency } as Parameters<typeof client.updateUser>[0]);
    return error ? fail(error) : { ok: true };
  },
};

async function menuCall(method: string, body?: object, query = "") {
  const r = await call<{ items: MenuItem[] }>(`/api/admin/menu${query}`, body ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method });
  return r.ok ? { ok: true as const, items: r.data.items } : r;
}

async function filterCall(method: string, body: object) {
  const r = await call<{ config: FilterConfig }>("/api/admin/filters", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.ok ? { ok: true as const, config: r.data.config } : r;
}

export const serverAdminApi: AdminApi = {
  async me() {
    const r = await call<{ admin: boolean } & Partial<AdminMe>>("/api/admin/me");
    return r.ok ? (r.data.admin ? { master: Boolean(r.data.master), perms: r.data.perms ?? [] } : false) : null;
  },
  async stats() {
    const r = await call<AdminStats>("/api/admin/stats");
    return r.ok ? { ok: true, stats: r.data } : r;
  },
  async users(query) {
    const p = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    const r = await call<AdminUserPage>(`/api/admin/users?${p}`);
    return r.ok ? { ok: true, data: r.data } : r;
  },
  async user(id) {
    const r = await call<AdminUserDetail>(`/api/admin/user?id=${encodeURIComponent(id)}`);
    return r.ok ? { ok: true, data: r.data } : r;
  },
  async currencies() {
    const r = await call<AdminCurrencyState>("/api/admin/currencies");
    return r.ok ? { ok: true, data: r.data } : r;
  },
  async updateCurrency(code, patch) {
    const r = await call("/api/admin/currencies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, ...patch }) });
    return r.ok ? { ok: true } : r;
  },
  async refreshRates() {
    const r = await call("/api/admin/currencies/refresh", { method: "POST" });
    return r.ok ? { ok: true } : r;
  },
  async promoCodes() { const r = await call<{ promos: PromoCode[] }>("/api/admin/promo-codes"); return r.ok ? { ok: true, promos: r.data.promos } : r; },
  async promoCode(id) { const r = await call<{ promo: PromoCode }>(`/api/admin/promo-codes?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, promo: r.data.promo } : r; },
  async savePromo(id, input) {
    const r = await call<{ promo: PromoCode }>("/api/admin/promo-codes", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id, ...input } : input) });
    return r.ok ? { ok: true, promo: r.data.promo } : { ok: false, error: r.error, errors: r.errors };
  },
  async setPromoEnabled(id, enabled) {
    const r = await call("/api/admin/promo-codes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled }) });
    return r.ok ? { ok: true } : r;
  },
  async deletePromo(id) { const r = await call(`/api/admin/promo-codes?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return r.ok ? { ok: true } : r; },
  async returns() { const r = await call<{ returns: ReturnRequest[] }>("/api/admin/returns"); return r.ok ? { ok: true, returns: r.data.returns } : r; },
  async updateReturn(id, status, note) {
    const r = await call("/api/admin/returns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, note }) });
    return r.ok ? { ok: true } : r;
  },
  async addUser(input) {
    const r = await call<{ id: string }>("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, id: r.data.id } : r;
  },
  async setUserRole(id, role) {
    const r = await call("/api/admin/user", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, role }) });
    return r.ok ? { ok: true } : r;
  },
  async closeUser(id, reason) { const r = await call("/api/admin/user", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, close: reason }) }); return r.ok ? { ok: true } : r; },
  async reopenUser(id, note) { const r = await call("/api/admin/user", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reopen: note }) }); return r.ok ? { ok: true } : r; },
  async sellers(tab, q) { const r = await call<SellerList>(`/api/admin/sellers?${new URLSearchParams({ tab, q })}`); return r.ok ? { ok: true, data: r.data } : r; },
  async seller(id) { const r = await call<{ seller: SellerDetail }>(`/api/admin/sellers?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, seller: r.data.seller } : r; },
  async sellerAction(id, action, reason) { const r = await call("/api/admin/sellers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, reason }) }); return r.ok ? { ok: true } : r; },
  // Each call = one audited view / download on the server (the browser gets a blob URL, never a shareable link).
  async sellerFile(id, download) {
    try {
      const res = await fetch(`/api/admin/seller-files?id=${encodeURIComponent(id)}${download ? "&download=1" : ""}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) { const d = await res.json().catch(() => null) as { error?: string } | null; return { ok: false, error: d?.error || `Error ${res.status}` }; }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "file";
      return { ok: true, blob: await res.blob(), name };
    } catch { return { ok: false, error: "Network error. Check your connection." }; }
  },
  async admins() { const r = await call<AdminList>("/api/admin/admins"); return r.ok ? { ok: true, data: r.data } : r; },
  async setAdminPerms(id, perms) {
    const r = await call<{ perms: AdminPerm[] }>("/api/admin/admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, perms }) });
    return r.ok ? { ok: true, perms: r.data.perms } : r;
  },
  async tickets() { const r = await call<{ tickets: Ticket[] }>("/api/admin/tickets"); return r.ok ? { ok: true, tickets: r.data.tickets } : r; },
  async ticket(id) { const r = await call<{ ticket: TicketThread }>(`/api/admin/tickets?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, ticket: r.data.ticket } : r; },
  async replyTicket(id, reply) { const r = await call("/api/admin/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reply }) }); return r.ok ? { ok: true } : r; },
  async setTicketStatus(id, status) { const r = await call("/api/admin/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); return r.ok ? { ok: true } : r; },
  async adjustBalance(input) {
    const r = await call<{ wallet: AdminWallet }>("/api/admin/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, wallet: r.data.wallet } : r;
  },
  async topUps(q) {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    const r = await call<{ data: AdminTopUpPage }>(`/api/admin/topups?${p}`); return r.ok ? { ok: true, data: r.data.data } : r;
  },
  async topUp(id) { const r = await call<{ topUp: AdminTopUpDetail }>(`/api/admin/topups?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, topUp: r.data.topUp } : r; },
  async closeTopUp(id, action, reason) {
    const r = await call<{ topUp: AdminTopUpDetail }>("/api/admin/topups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, reason }) });
    return r.ok ? { ok: true, topUp: r.data.topUp } : r;
  },
  async confirmTopUp(id, receivedMinor, bankRef) {
    const r = await call<{ topUp: AdminTopUpDetail }>("/api/admin/topups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "confirm", receivedMinor, bankRef }) });
    return r.ok ? { ok: true, topUp: r.data.topUp } : r;
  },
  async bankSettings() { const r = await call<{ settings: BankSettings; history: BankEvent[] }>("/api/admin/bank-transfer"); return r.ok ? { ok: true, ...r.data } : r; },
  async saveBankSettings(settings) {
    const r = await call<{ settings: BankSettings; history: BankEvent[] }>("/api/admin/bank-transfer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    return r.ok ? { ok: true, ...r.data } : r;
  },
  async filters() { const r = await call<{ config: FilterConfig }>("/api/admin/filters"); return r.ok ? { ok: true, config: r.data.config } : r; },
  async addFilterOption(group, label) { return filterCall("POST", { group, label }); },
  async updateFilterOption(id, patch) { return filterCall("PATCH", { id, ...patch }); },
  async deleteFilterOption(id) { const r = await call<{ config: FilterConfig }>(`/api/admin/filters?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return r.ok ? { ok: true, config: r.data.config } : r; },
  async updateFilterGroup(group, patch) { return filterCall("PATCH", { group, ...patch }); },
  async menu() { return menuCall("GET"); },
  async addMenuItem(input) { return menuCall("POST", input); },
  async updateMenuItem(id, patch) { return menuCall("PATCH", { id, ...patch }); },
  async deleteMenuItem(id) { return menuCall("DELETE", undefined, `?id=${encodeURIComponent(id)}`); },
  async purchasePopup() { const r = await call<{ settings: PopupSettings; history: PopupEvent[] }>("/api/admin/purchase-popup"); return r.ok ? { ok: true, ...r.data } : r; },
  async savePurchasePopup(settings) {
    const r = await call<{ settings: PopupSettings; history: PopupEvent[] }>("/api/admin/purchase-popup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    return r.ok ? { ok: true, ...r.data } : r;
  },
  async feeSettings() { const r = await call<{ settings: FeeSettings; history: FeeEvent[] }>("/api/admin/fees"); return r.ok ? { ok: true, ...r.data } : r; },
  async saveFeeSettings(settings) {
    const r = await call<{ settings: FeeSettings; history: FeeEvent[] }>("/api/admin/fees", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    return r.ok ? { ok: true, ...r.data } : r;
  },
  async products() { const r = await call<{ products: Product[] }>("/api/admin/products"); return r.ok ? { ok: true, products: r.data.products } : r; },
  async product(id) { const r = await call<{ product: Product }>(`/api/admin/products?id=${encodeURIComponent(id)}`); return r.ok ? { ok: true, product: r.data.product } : r; },
  async saveProduct(input, isNew) {
    const r = await call<{ product: Product }>("/api/admin/products", { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, product: r.data.product } : r;
  },
  async deleteProduct(id) { const r = await call(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" }); return r.ok ? { ok: true } : r; },
  async uploadProductImage(dataUrl) {
    const r = await call<{ url: string }>("/api/admin/products/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
    return r.ok ? { ok: true, url: r.data.url } : r;
  },
  async keyCounts() { const r = await call<{ counts: Record<string, KeyCounts> }>("/api/admin/products/keys"); return r.ok ? { ok: true, counts: r.data.counts } : r; },
  async keyInventory(productId) { const r = await call<{ inventory: KeyInventory }>(`/api/admin/products/keys?productId=${encodeURIComponent(productId)}`); return r.ok ? { ok: true, inventory: r.data.inventory } : r; },
  async addKeys(productId, text, batch) {
    const r = await call<{ result: KeyUploadResult }>("/api/admin/products/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, text, batch }) });
    return r.ok ? { ok: true, result: r.data.result } : r;
  },
  async removeKey(productId, keyId) { const r = await call(`/api/admin/products/keys?productId=${encodeURIComponent(productId)}&keyId=${encodeURIComponent(keyId)}`, { method: "DELETE" }); return r.ok ? { ok: true } : r; },
  async giftCards() { const r = await call<{ cards: GiftCard[] }>("/api/admin/gift-cards"); return r.ok ? { ok: true, cards: r.data.cards } : r; },
  async createGiftCards(input) {
    const r = await call<{ created: { id: string; code: string }[] }>("/api/admin/gift-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return r.ok ? { ok: true, created: r.data.created } : r;
  },
  async setGiftCardDisabled(id, disabled) {
    const r = await call("/api/admin/gift-cards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, disabled }) });
    return r.ok ? { ok: true } : r;
  },
  async emailOutbox() { const r = await call<{ outbox: SentMail[] | null; resend: boolean; failures: EmailFailure[] | null }>("/api/admin/emails"); return r.ok ? { ok: true, ...r.data } : r; },
  async sendTestEmail(id) {
    const r = await call<{ to: string }>("/api/admin/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    return r.ok ? { ok: true, to: r.data.to } : r;
  },
};
