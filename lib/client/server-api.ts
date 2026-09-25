import { createAuthClient } from "better-auth/react";
import type { AccountApi, Order, PaymentMethod, SessionUser, SiteConfig } from "./types";

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
  async signUp({ name, email, password, marketingOptIn }) {
    const { error } = await client.signUp.email({ name, email, password, marketingOptIn, callbackURL: `${origin()}/account?verified=1` } as Parameters<typeof client.signUp.email>[0]);
    return error ? fail(error) : { ok: true };
  },
  async signIn({ email, password }) {
    const { error } = await client.signIn.email({ email, password, callbackURL: `${origin()}/account?verified=1` });
    if (error?.status === 403) return { ok: false, error: "Verify your email first. We sent a new link.", code: "EMAIL_NOT_VERIFIED" };
    return error ? fail(error, "Wrong email or password.") : { ok: true };
  },
  async signInGoogle(callbackPath) {
    const { error } = await client.signIn.social({ provider: "google", callbackURL: `${origin()}${callbackPath}`, errorCallbackURL: `${origin()}/login?error=google` });
    return error ? fail(error, "Google login is not available yet.") : { ok: true };
  },
  async signOut() { await client.signOut(); },
  async resendVerification(email) {
    const { error } = await client.sendVerificationEmail({ email, callbackURL: `${origin()}/account?verified=1` });
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
};
