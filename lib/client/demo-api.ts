import type { AccountApi, Order, PaymentMethod, SessionUser } from "./types";

// GitHub Pages demo: everything lives in this browser's localStorage. No server, no real accounts.
type DemoUser = SessionUser & { passwordHash?: string; salt?: string; provider: "email" | "google" };
type Token = { token: string; type: "verify" | "reset"; email: string; expires: number };
type Store = { users: DemoUser[]; sessionUserId: string | null; tokens: Token[]; orders: Record<string, Order[]>; cards: Record<string, PaymentMethod[]> };
const KEY = "corecart-demo-v1";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const empty = (): Store => ({ users: [], sessionUserId: null, tokens: [], orders: {}, cards: {} });

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
const publicUser = (u: DemoUser): SessionUser => ({ id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, image: u.image, role: u.role, createdAt: u.createdAt });
function issue(s: Store, type: Token["type"], email: string) {
  const token = rand(24);
  s.tokens = s.tokens.filter((t) => !(t.email === email && t.type === type));
  s.tokens.push({ token, type, email, expires: Date.now() + 3600_000 });
  return `${base}/${type === "verify" ? "verify-email" : "reset-password"}/?token=${token}`;
}
function seedOrders(s: Store, userId: string) {
  if (s.orders[userId]?.length) return;
  const now = Date.now();
  s.orders[userId] = [
    { id: id(), number: `CC-${rand(8)}`, status: "completed", currency: "USD", totalCents: 4898, isSample: true, createdAt: new Date(now - 86400_000 * 2).toISOString(),
      items: [
        { id: id(), name: "Elden Ring", kind: "game_key", platform: "Steam", region: "Global", quantity: 1, unitPriceCents: 2999, demoKey: `DEMO-${rand(5)}-${rand(5)}-${rand(5)}` },
        { id: id(), name: "Cyberpunk 2077", kind: "game_key", platform: "Steam", region: "Global", quantity: 1, unitPriceCents: 1899, demoKey: `DEMO-${rand(5)}-${rand(5)}-${rand(5)}` },
      ] },
    { id: id(), number: `CC-${rand(8)}`, status: "paid", currency: "USD", totalCents: 16999, isSample: true, createdAt: new Date(now - 86400_000 * 9).toISOString(),
      items: [{ id: id(), name: "Samsung 990 PRO 2TB NVMe SSD", kind: "hardware", quantity: 1, unitPriceCents: 16999 }] },
  ];
}
const current = (s: Store) => s.users.find((u) => u.id === s.sessionUserId) ?? null;
const wait = () => new Promise((r) => setTimeout(r, 350));

export const demoApi: AccountApi = {
  mode: "demo",
  async config() { return { google: true, stripe: true, email: true, sampleOrders: true }; },
  async getSession() { const u = current(load()); return u ? publicUser(u) : null; },
  async signUp({ name, email, password }) {
    await wait();
    const s = load(); const e = email.trim().toLowerCase();
    if (s.users.some((u) => u.email === e)) return { ok: false, error: "An account with this email already exists." };
    const salt = rand(12);
    s.users.push({ id: id(), name: name.trim(), email: e, emailVerified: false, role: "customer", createdAt: new Date().toISOString(), provider: "email", salt, passwordHash: await hash(password, salt) });
    const demoLink = issue(s, "verify", e); save(s);
    return { ok: true, demoLink };
  },
  async signIn({ email, password }) {
    await wait();
    const s = load(); const u = s.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || !u.salt || u.passwordHash !== await hash(password, u.salt)) return { ok: false, error: "Wrong email or password." };
    if (!u.emailVerified) return { ok: false, error: "Verify your email first.", code: "EMAIL_NOT_VERIFIED" };
    s.sessionUserId = u.id; save(s); return { ok: true };
  },
  async signInGoogle() {
    await wait();
    const s = load(); const e = "demo.google.user@gmail.com";
    let u = s.users.find((x) => x.email === e);
    if (!u) { u = { id: id(), name: "Demo Google User", email: e, emailVerified: true, role: "customer", createdAt: new Date().toISOString(), provider: "google" }; s.users.push(u); seedOrders(s, u.id); }
    s.sessionUserId = u.id; save(s); return { ok: true };
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
    u.emailVerified = true; s.sessionUserId = u.id; s.tokens = s.tokens.filter((x) => x !== t); seedOrders(s, u.id); save(s);
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
    list.unshift({ id: id(), number: `CC-${rand(8)}`, status: "completed", currency: "USD", totalCents: 1699, isSample: true, createdAt: new Date().toISOString(),
      items: [{ id: id(), name: "Xbox Game Pass Ultimate 1 Month", kind: "game_key", platform: "Xbox", region: "Global", quantity: 1, unitPriceCents: 1699, demoKey: `DEMO-${rand(5)}-${rand(5)}-${rand(5)}` }] });
    s.orders[u.id] = list; save(s); return { ok: true };
  },
  async listPaymentMethods() { const s = load(); const u = current(s); return u ? { ok: true, configured: true, methods: s.cards[u.id] ?? [] } : { ok: false, error: "Not signed in" }; },
  async addPaymentMethod(card) {
    await wait();
    const s = load(); const u = current(s); if (!u || !card) return { ok: false, error: "Not signed in" };
    (s.cards[u.id] ??= []).push({ id: id(), brand: card.brand, last4: card.last4, expMonth: 12, expYear: new Date().getFullYear() + 3 }); save(s);
    return { ok: true };
  },
  async removePaymentMethod(pid) { const s = load(); const u = current(s); if (!u) return { ok: false, error: "Not signed in" }; s.cards[u.id] = (s.cards[u.id] ?? []).filter((c) => c.id !== pid); save(s); return { ok: true }; },
};
