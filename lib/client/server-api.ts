import { createAuthClient } from "better-auth/react";
import type { CurrencyData } from "@/lib/currency/money";
import type { CartEntry } from "@/lib/catalog";
import type { AccountApi, AdminApi, AdminCurrencyState, AdminStats, AdminUserDetail, AdminUserPage, Order, PaymentMethod, SessionUser, SiteConfig } from "./types";

const client = createAuthClient({ basePath: "/api/auth" });
type ErrLike = { message?: string; code?: string; status?: number } | null | undefined;
const fail = (e: ErrLike, fallback = "Something went wrong. Try again.") => ({ ok: false as const, error: e?.message || fallback, code: e?.code });
const origin = () => window.location.origin;

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { credentials: "include", ...init });
    const data = await res.json();
    return res.ok ? { ok: true, data } : { ok: false, error: data?.error || `Error ${res.status}` };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}

async function cartCall(method: string, body?: object) {
  const r = await call<{ items: CartEntry[] }>("/api/cart", { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  return r.ok ? { ok: true as const, items: r.data.items } : r;
}

export const serverApi: AccountApi = {
  mode: "server",
  async config() {
    const r = await call<SiteConfig>("/api/config");
    return r.ok ? r.data : { google: false, stripe: false, email: false, sampleOrders: false };
  },
  async getSession() {
    const { data } = await client.getSession();
    return (data?.user as unknown as SessionUser) ?? null;
  },
  async signUp({ name, email, password, marketingOptIn, callbackPath = "/account" }) {
    const { error } = await client.signUp.email({ name, email, password, marketingOptIn, callbackURL: `${origin()}${callbackPath}?verified=1` } as Parameters<typeof client.signUp.email>[0]);
    return error ? fail(error) : { ok: true };
  },
  async signIn({ email, password, rememberMe = true, callbackPath = "/account" }) {
    const { error } = await client.signIn.email({ email, password, rememberMe, callbackURL: `${origin()}${callbackPath}?verified=1` });
    if (error?.status === 403) return { ok: false, error: "Verify your email first. We sent a new link.", code: "EMAIL_NOT_VERIFIED" };
    return error ? fail(error, "Wrong email or password.") : { ok: true };
  },
  async signInGoogle(callbackPath) {
    const { error } = await client.signIn.social({ provider: "google", callbackURL: `${origin()}${callbackPath}`, errorCallbackURL: `${origin()}/login?error=google` });
    return error ? fail(error, "Google login is not available yet.") : { ok: true };
  },
  async signOut() { await client.signOut(); },
  async resendVerification(email, callbackPath = "/account") {
    const { error } = await client.sendVerificationEmail({ email, callbackURL: `${origin()}${callbackPath}?verified=1` });
    return error ? fail(error) : { ok: true };
  },
  async verifyEmail() { return { ok: true }; }, // Server verifies via emailed link directly.
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
  async changePassword(current, next) {
    const { error } = await client.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    return error ? fail(error, "Current password is wrong.") : { ok: true };
  },
  async listOrders() {
    const r = await call<{ orders: Order[] }>("/api/account/orders");
    return r.ok ? { ok: true, orders: r.data.orders } : r;
  },
  async createSampleOrder() {
    const r = await call("/api/account/orders", { method: "POST" });
    return r.ok ? { ok: true } : r;
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
  async setCurrency(currency) {
    const { error } = await client.updateUser({ currency } as Parameters<typeof client.updateUser>[0]);
    return error ? fail(error) : { ok: true };
  },
};

export const serverAdminApi: AdminApi = {
  async me() {
    const r = await call<{ admin: boolean }>("/api/admin/me");
    return r.ok && r.data.admin;
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
};
