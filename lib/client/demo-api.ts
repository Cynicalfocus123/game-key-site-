import { BASE_CURRENCY, DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/currency/currencies";
import { convertMinor, crossRate } from "@/lib/currency/money";
import fallbackRates from "@/lib/currency/fallback-rates.json";
import { demoAdminCurrencies, demoCurrencies, demoRefreshRates, demoUpdateCurrency } from "./demo-currency";
import type { AccountApi, AdminApi, AdminLogin, AdminUserRow, Order, OrderItem, PaymentMethod, SessionUser } from "./types";

// GitHub Pages demo: everything lives in this browser's localStorage. No server, no real accounts.
type DemoUser = SessionUser & { passwordHash?: string; salt?: string; provider: "email" | "google"; marketingOptIn?: boolean; sample?: boolean };
type DemoLogin = AdminLogin & { userId: string };
type Token = { token: string; type: "verify" | "reset"; email: string; expires: number };
type Store = { users: DemoUser[]; sessionUserId: string | null; tokens: Token[]; orders: Record<string, Order[]>; cards: Record<string, PaymentMethod[]>; logins: DemoLogin[]; adminSeeded?: boolean };
const KEY = "corecart-demo-v1";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const empty = (): Store => ({ users: [], sessionUserId: null, tokens: [], orders: {}, cards: {}, logins: [] });

function load(): Store {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...empty(), ...JSON.parse(raw) } : empty(); } catch { return empty(); }
}
function save(s: Store) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }
const id = () => crypto.randomUUID();
const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
async function hash(password: string, salt: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
const publicUser = (u: DemoUser): SessionUser => ({ id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, image: u.image, role: u.role, createdAt: u.createdAt, currency: u.currency ?? null });
function issue(s: Store, type: Token["type"], email: string, next?: string) {
  const token = rand(24);
  s.tokens = s.tokens.filter((t) => !(t.email === email && t.type === type));
  s.tokens.push({ token, type, email, expires: Date.now() + 3600_000 });
  return `${base}/${type === "verify" ? "verify-email" : "reset-password"}/?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
}
// Sample orders: prices in THB, charged in USD at the committed fallback rates. Stores amount, currency and rate used.
type SampleItem = Omit<OrderItem, "id" | "quantity" | "unitPriceCents"> & { thb: number };
const key = () => `DEMO-${rand(5)}-${rand(5)}-${rand(5)}`;
function sampleOrder(status: string, createdAt: number, items: SampleItem[]): Order {
  const r = fallbackRates.rates as Record<string, number>;
  const from = { code: BASE_CURRENCY, decimals: 2, rate: String(r[BASE_CURRENCY]) }; const to = { code: DEFAULT_CURRENCY, decimals: 2, rate: "1" };
  const lines = items.map(({ thb, ...i }) => ({ ...i, id: id(), quantity: 1, unitPriceCents: convertMinor(thb, from, to) }));
  return { id: id(), number: `CC-${rand(8)}`, status, currency: to.code, totalCents: lines.reduce((t, i) => t + i.unitPriceCents, 0), baseCurrency: BASE_CURRENCY,
    baseTotalMinor: items.reduce((t, i) => t + i.thb, 0), fxRate: crossRate(from, to), ratesAt: fallbackRates.updatedAt, isSample: true, createdAt: new Date(createdAt).toISOString(), items: lines };
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
const current = (s: Store) => s.users.find((u) => u.id === s.sessionUserId) ?? null;
const logLogin = (s: Store, userId: string, method: string) => { s.logins.push({ userId, method, ipAddress: "demo", userAgent: navigator.userAgent, createdAt: new Date().toISOString() }); };
const wait = () => new Promise((r) => setTimeout(r, 350));

export const demoApi: AccountApi = {
  mode: "demo",
  async config() { return { google: true, stripe: true, email: true, sampleOrders: true }; },
  async getSession() { const u = current(load()); return u ? publicUser(u) : null; },
  // Demo only: admin register page creates an admin. Server mode uses ADMIN_EMAILS instead.
  async signUp({ name, email, password, marketingOptIn, admin }) {
    await wait();
    const s = load(); const e = email.trim().toLowerCase();
    if (s.users.some((u) => u.email === e)) return { ok: false, error: "An account with this email already exists." };
    const salt = rand(12);
    s.users.push({ id: id(), name: name.trim(), email: e, emailVerified: false, role: admin ? "admin" : "customer", createdAt: new Date().toISOString(), provider: "email", marketingOptIn, salt, passwordHash: await hash(password, salt) });
    const demoLink = issue(s, "verify", e, admin ? "/admin" : undefined); save(s);
    return { ok: true, demoLink };
  },
  async signIn({ email, password }) {
    await wait();
    const s = load(); const u = s.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || !u.salt || u.passwordHash !== await hash(password, u.salt)) return { ok: false, error: "Wrong email or password." };
    if (!u.emailVerified) return { ok: false, error: "Verify your email first.", code: "EMAIL_NOT_VERIFIED" };
    s.sessionUserId = u.id; logLogin(s, u.id, "email"); save(s); return { ok: true };
  },
  async signInGoogle() {
    await wait();
    const s = load(); const e = "demo.google.user@gmail.com";
    let u = s.users.find((x) => x.email === e);
    if (!u) { u = { id: id(), name: "Demo Google User", email: e, emailVerified: true, role: "customer", createdAt: new Date().toISOString(), provider: "google" }; s.users.push(u); seedOrders(s, u.id); }
    s.sessionUserId = u.id; logLogin(s, u.id, "google"); save(s); return { ok: true };
  },
  async signOut() { const s = load(); s.sessionUserId = null; save(s); },
  async resendVerification(email) {
    const s = load(); const e = email.trim().toLowerCase();
    if (!s.users.some((u) => u.email === e && !u.emailVerified)) return { ok: true };
    const demoLink = issue(s, "verify", e); save(s); return { ok: true, demoLink };
  },
  async verifyEmail(token) {
    await wait();
    const s = load(); const t = s.tokens.find((x) => x.token === token && x.type === "verify");
    if (!t || t.expires < Date.now()) return { ok: false, error: "Verification link is invalid or expired." };
    const u = s.users.find((x) => x.email === t.email); if (!u) return { ok: false, error: "Account not found." };
    u.emailVerified = true; s.sessionUserId = u.id; logLogin(s, u.id, "email-verify"); s.tokens = s.tokens.filter((x) => x !== t); seedOrders(s, u.id); save(s);
    return { ok: true };
  },
  async requestReset(email) {
    await wait();
    const s = load(); const e = email.trim().toLowerCase();
    if (!s.users.some((u) => u.email === e && u.provider === "email")) return { ok: true };
    const demoLink = issue(s, "reset", e); save(s); return { ok: true, demoLink };
  },
  async resetPassword(token, password) {
    await wait();
    const s = load(); const t = s.tokens.find((x) => x.token === token && x.type === "reset");
    if (!t || t.expires < Date.now()) return { ok: false, error: "Reset link is invalid or expired." };
    const u = s.users.find((x) => x.email === t.email); if (!u) return { ok: false, error: "Account not found." };
    u.salt = rand(12); u.passwordHash = await hash(password, u.salt); s.tokens = s.tokens.filter((x) => x !== t); s.sessionUserId = null; save(s);
    return { ok: true };
  },
  async updateName(name) { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; u.name = name.trim(); save(s); return { ok: true }; },
  async changePassword(cur, next) {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    if (!u.salt) return { ok: false, error: "This account uses Google login and has no password." };
    if (u.passwordHash !== await hash(cur, u.salt)) return { ok: false, error: "Current password is wrong." };
    u.salt = rand(12); u.passwordHash = await hash(next, u.salt); save(s); return { ok: true };
  },
  async listOrders() { const s = load(); const u = current(s); return u ? { ok: true, orders: s.orders[u.id] ?? [] } : { ok: false, error: "Not signed in" }; },
  async createSampleOrder() {
    const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" };
    const list = s.orders[u.id] ?? [];
    list.unshift(sampleOrder("completed", Date.now(), [{ name: "Xbox Game Pass Ultimate 1 Month", kind: "game_key", platform: "Xbox", region: "Global", thb: 55900, demoKey: key() }]));
    s.orders[u.id] = list; save(s); return { ok: true };
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
  return { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, role: u.role, createdAt: u.createdAt, marketingOptIn: Boolean(u.marketingOptIn), methods: methodsOf(u), lastLogin: last, loginCount: mine.length };
}
function adminStore() {
  const s = load(); const u = current(s);
  if (!u || u.role !== "admin" || !u.emailVerified) return null;
  if (!s.adminSeeded) { seedAdminSamples(s); save(s); }
  return s;
}
const bangkokDay = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const denied = { ok: false as const, error: "Admin access only" };

export const demoAdminApi: AdminApi = {
  async me() { return Boolean(adminStore()); },
  async stats() {
    const s = adminStore(); if (!s) return denied;
    const since = (d: number) => Date.now() - d * 86400_000;
    const users = s.users;
    const newer = (d: number) => users.filter((u) => new Date(u.createdAt).getTime() >= since(d)).length;
    const recentLogins = s.logins.filter((l) => new Date(l.createdAt).getTime() >= since(7));
    const daily = new Map<string, number>();
    users.filter((u) => new Date(u.createdAt).getTime() >= since(30)).forEach((u) => { const k = bangkokDay(u.createdAt); daily.set(k, (daily.get(k) ?? 0) + 1); });
    return { ok: true, stats: {
      total: users.length, verified: users.filter((u) => u.emailVerified).length, admins: users.filter((u) => u.role === "admin").length,
      new1: newer(1), new7: newer(7), new30: newer(30), marketing: users.filter((u) => u.marketingOptIn).length,
      logins7: recentLogins.length, active7: new Set(recentLogins.map((l) => l.userId)).size,
      methods: ["credential", "google"].map((m) => ({ method: m, users: users.filter((u) => methodsOf(u).includes(m)).length })).filter((m) => m.users > 0),
      daily: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count })),
      recent: users.map((u) => row(s, u)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), timezone: "Asia/Bangkok",
    } };
  },
  async users(query) {
    const s = adminStore(); if (!s) return denied;
    const q = query.q?.trim().toLowerCase();
    const rows = s.users.map((u) => row(s, u)).filter((r) =>
      (!q || r.email.includes(q) || r.name.toLowerCase().includes(q)) &&
      (!query.method || r.methods.includes(query.method)) &&
      (!query.verified || (query.verified === "yes") === r.emailVerified) &&
      (!query.role || r.role === query.role))
      .sort((a, b) => query.sort === "login" ? (b.lastLogin ?? "").localeCompare(a.lastLogin ?? "") : query.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
    const pageSize = 25; const page = Math.max(query.page || 1, 1);
    return { ok: true, data: { total: rows.length, page, pageSize, users: rows.slice((page - 1) * pageSize, page * pageSize) } };
  },
  async user(uid) {
    const s = adminStore(); if (!s) return denied;
    const u = s.users.find((x) => x.id === uid); if (!u) return { ok: false, error: "User not found" };
    const logins: AdminLogin[] = s.logins.filter((l) => l.userId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
      .map((l) => ({ method: l.method, ipAddress: l.ipAddress, userAgent: l.userAgent, createdAt: l.createdAt }));
    const orders = s.orders[uid] ?? [];
    return { ok: true, data: {
      user: { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, role: u.role, createdAt: u.createdAt, updatedAt: u.createdAt, termsAcceptedAt: u.createdAt, marketingOptIn: Boolean(u.marketingOptIn) },
      accounts: methodsOf(u).map((method) => ({ method, createdAt: u.createdAt })),
      sessions: s.sessionUserId === uid ? [{ createdAt: logins[0]?.createdAt ?? u.createdAt, expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(), ipAddress: "demo", userAgent: navigator.userAgent }] : [],
      logins, orders: { count: orders.length, totalCents: orders.reduce((t, o) => t + o.totalCents, 0) },
    } };
  },
  async currencies() { if (!adminStore()) return denied; return { ok: true, data: await demoAdminCurrencies() }; },
  async updateCurrency(code, patch) { if (!adminStore()) return denied; return demoUpdateCurrency(code, patch); },
  async refreshRates() { if (!adminStore()) return denied; return demoRefreshRates(); },
};
