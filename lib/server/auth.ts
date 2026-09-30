import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { isCurrencyCode } from "@/lib/currency/currencies";
import { isAvatar, isCountry } from "@/lib/profile";
import { loginMethod } from "./admin";
import { db } from "./db";
import { signupRole } from "@/lib/users";
import { isAdminRole } from "@/lib/admin-perms";
import { CLOSE_ERRORS, claimPlaceholder, isClaimPlaceholder } from "@/lib/account-close";
import { TERMS_COOKIE, TERMS_ERROR, TERMS_VERSION } from "@/lib/terms";
import { claimStillOpen, closedHolder, finishEmailClaim, isClosed, pendingClaim } from "./account-close";
import { termsFromCookie } from "./terms";
import { account as accountTable, loginEvent, schema, user as userTable } from "./db/schema";
import { sendTemplate } from "./email";
import { DEVICE_COOKIE, DEVICE_COOKIE_DAYS, issueVerifyCode, noteDevice, signInFacts } from "./account-mail";
import { locationFor } from "./geo";

const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
  : undefined;

// Send after response so timing does not reveal whether an email exists.
const queue = (fn: () => Promise<unknown>) => after(() => fn().catch((e) => console.error("[CoreCart email]", e)));

export const auth = betterAuth({
  appName: "CoreCart",
  baseURL: process.env.BETTER_AUTH_URL,
  // Build step imports this file without runtime env; real secret is required at runtime.
  secret: process.env.BETTER_AUTH_SECRET || (process.env.NEXT_PHASE === "phase-production-build" ? "build-time-placeholder-secret-not-used" : undefined),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // No login yet = account made by an admin (S7 Add user): "set your password" email.
      const [login] = await db.select({ id: accountTable.id }).from(accountTable).where(eq(accountTable.userId, user.id)).limit(1);
      queue(() => login ? sendTemplate(user.email, "reset", { name: user.name, url }) : sendTemplate(user.email, "adminCreated", { name: user.name, url }));
    },
    // The reset link proves the email address (admin-created accounts start unverified). A verified account gets "password changed".
    onPasswordReset: async ({ user }, request) => {
      if (!user.emailVerified) { await db.update(userTable).set({ emailVerified: true, updatedAt: new Date() }).where(eq(userTable.id, user.id)); return; }
      const h = request?.headers ?? null; const ip = h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip") || null;
      queue(() => sendTemplate(user.email, "passwordChanged", signInFacts(user.name, ip, h?.get("user-agent"), h)));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    // Email task: a 6-digit code (10 min, /api/verify-code) + the Better Auth link (1 hour), in one email.
    // R1: a sign-up that reuses a closed account's email has a placeholder email; its code + link go to claim_email.
    sendVerificationEmail: async ({ user, url, token }) => {
      const to = (await claimOf(user)) ?? user.email;
      const code = await issueVerifyCode(user.id, to, token);
      queue(() => sendTemplate(to, "verify", { name: user.name, code, url }));
    },
    // R1: a claim only finishes while the closed account still holds the address (not reopened, no other claim won).
    beforeEmailVerification: async (user) => {
      const claim = await claimOf(user);
      if (claim && !(await claimStillOpen(claim))) throw new APIError("BAD_REQUEST", { message: CLOSE_ERRORS.claimLost });
    },
    afterEmailVerification: async (user) => {
      const claim = await claimOf(user);
      if (claim && !(await finishEmailClaim(user.id, claim))) throw new APIError("BAD_REQUEST", { message: CLOSE_ERRORS.claimLost });
      queue(() => sendTemplate(claim ?? user.email, "welcome", { name: user.name }));
    },
  },
  socialProviders: google,
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  user: {
    additionalFields: {
      // T3: every sign-up is a customer (sellers apply at /sell/apply); the create hook forces it, the update hook blocks any change.
      role: { type: "string", required: false, defaultValue: "customer", input: true },
      termsAcceptedAt: { type: "date", required: false, input: false },
      termsVersion: { type: "string", required: false, input: true }, // R7: email sign-up must send TERMS_VERSION (checked in the create hook)
      claimEmail: { type: "string", required: false, input: true, returned: false }, // R1: set ONLY by the sign-up before hook (client values are stripped)
      marketingOptIn: { type: "boolean", required: false, defaultValue: false, input: true },
      stripeCustomerId: { type: "string", required: false, input: false, returned: false },
      currency: { type: "string", required: false, input: true }, // display currency; validated in databaseHooks
      avatar: { type: "string", required: false, input: true }, // preset colour id; validated in databaseHooks
      country: { type: "string", required: false, input: true }, // ISO country code; validated in databaseHooks
      marketingChoiceAt: { type: "date", required: false, input: false }, // set by databaseHooks when marketingOptIn is chosen
    },
  },
  databaseHooks: {
    // Every sign-up is a customer (T3). Admins: scripts/create-admin.mjs or an admin in /admin/users (lib/server/users.ts, direct DB, not this hook).
    user: {
      // R7: Terms are recorded only with proof: email sign-up sends termsVersion = TERMS_VERSION; a new Google account needs the
      // signed cc_terms cookie from /api/terms/accept. Other paths (none today) get no terms record.
      create: { before: async (u, ctx) => {
        const path = ctx?.path ?? "";
        let terms: string | null = null;
        if (path === "/sign-up/email") { if (u.termsVersion !== TERMS_VERSION) throw new APIError("BAD_REQUEST", { message: TERMS_ERROR }); terms = TERMS_VERSION; }
        else if (path.startsWith("/callback/") || path === "/sign-in/social") {
          terms = termsFromCookie(ctx?.getCookie(TERMS_COOKIE));
          if (!terms) throw new APIError("FORBIDDEN", { message: TERMS_ERROR });
        }
        const claimEmail = path === "/sign-up/email" && typeof u.claimEmail === "string" && u.claimEmail !== "" && isClaimPlaceholder(u.email) ? u.claimEmail : null;
        return { data: { ...u, role: signupRole(u.role), termsVersion: terms, termsAcceptedAt: terms ? new Date() : null, claimEmail, currency: isCurrencyCode(u.currency) ? u.currency : null,
          avatar: isAvatar(u.avatar) ? u.avatar : null, country: isCountry(u.country) ? u.country : null, marketingChoiceAt: u.marketingOptIn === true ? new Date() : null } };
      } },
      // Only known currency codes, avatar presets and countries can be saved. Choosing deal emails (yes or no) records the time.
      update: {
        // Fields not sent arrive as undefined (they must not fail the check). Bad values → 400 with a message (returning false made the API answer 200 without saving).
        before: async (u) => {
          const sent = (k: string) => (u as Record<string, unknown>)[k] !== undefined;
          const bad = (message: string) => { throw new APIError("BAD_REQUEST", { message }); };
          if (sent("role")) bad("Role cannot be changed here.");
          if (sent("termsVersion") || sent("claimEmail")) bad("This field cannot be changed here.");
          if (sent("currency") && u.currency !== null && !isCurrencyCode(u.currency)) bad("Unknown currency.");
          if (sent("avatar") && u.avatar !== null && !isAvatar(u.avatar)) bad("Unknown avatar.");
          if (sent("country") && u.country !== null && !isCountry(u.country)) bad("Unknown country.");
          if (sent("name") && (typeof u.name !== "string" || !u.name.trim() || u.name.length > 80)) bad("Enter your name (up to 80 characters).");
          return { data: sent("marketingOptIn") ? { ...u, marketingChoiceAt: new Date() } : u };
        },
      },
    },
    // Admin accounts sign in with email + password only: never link Google (or any other provider) to them.
    account: {
      create: {
        before: async (a) => {
          if (a.providerId === "credential") return { data: a };
          const [u] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, a.userId)).limit(1);
          return u && isAdminRole(u.role) ? false : { data: a };
        },
      },
    },
    // Every new session = one successful sign-in. Record it for the admin login history.
    session: {
      create: {
        // T3: closed accounts never get a session (email, Google, reset link, verification link).
        before: async (s) => {
          if (await isClosed(s.userId)) throw new APIError("FORBIDDEN", { message: CLOSE_ERRORS.signIn });
          return { data: s };
        },
        after: async (s, ctx) => {
          try {
            const method = loginMethod(ctx?.path);
            if (!method) return;
            await db.insert(loginEvent).values({ id: crypto.randomUUID(), userId: s.userId, method, ipAddress: s.ipAddress ?? null, userAgent: s.userAgent ?? null, location: locationFor(ctx?.headers ?? ctx?.request?.headers, s.ipAddress) });
          } catch (e) { console.error("[CoreCart login log]", e); }
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  hooks: {
    // R1: a sign-up with the email of a closed account never changes the closed account. The new account gets a placeholder
    // email + claim_email (finished in afterEmailVerification). Client-sent claimEmail is always dropped. Resend of the
    // verification email for such an address goes to the newest pending claim. Better Auth MERGES the returned body into the
    // request body (defu), so a client claimEmail is overwritten with "" (leaving it out would keep the client's value).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && ctx.body && typeof ctx.body === "object") {
        const email = (ctx.body as Record<string, unknown>).email;
        if (typeof email === "string" && (await closedHolder(email)))
          return { context: { body: { email: claimPlaceholder(crypto.randomUUID()), claimEmail: email.trim().toLowerCase() } } };
        return { context: { body: { claimEmail: "" } } };
      }
      if (ctx.path === "/send-verification-email" && typeof ctx.body?.email === "string" && (await closedHolder(ctx.body.email))) {
        const claim = await pendingClaim(ctx.body.email);
        if (claim) return { context: { body: { ...ctx.body, email: claim.email } } };
      }
    }),
    // Email task: every sign-in checks the device cookie (unknown device → "New sign-in" email); a password change in Settings → "Password changed".
    after: createAuthMiddleware(async (ctx) => {
      try {
        if (isAPIError(ctx.context.returned)) return;
        const fresh = ctx.context.newSession;
        if (fresh && loginMethod(ctx.path)) {
          const value = await noteDevice(fresh.user, ctx.getCookie(DEVICE_COOKIE), fresh.session.ipAddress, fresh.session.userAgent, ctx.headers ?? ctx.request?.headers);
          ctx.setCookie(DEVICE_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DEVICE_COOKIE_DAYS * 86400 });
        }
        if (ctx.path === "/change-password" && ctx.context.session) {
          const { user: u, session: se } = ctx.context.session;
          queue(() => sendTemplate(u.email, "passwordChanged", signInFacts(u.name, se.ipAddress, se.userAgent, ctx.headers ?? ctx.request?.headers)));
        }
      } catch (e) { console.error("[CoreCart sign-in mail]", e); }
    }),
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
// R1: claim_email of a placeholder account (read from the database when the user object passed by Better Auth leaves it out).
async function claimOf(u: { id: string; email: string }) {
  if (!isClaimPlaceholder(u.email)) return null;
  const c = (u as { claimEmail?: unknown }).claimEmail;
  if (typeof c === "string" && c) return c;
  const [row] = await db.select({ claimEmail: userTable.claimEmail }).from(userTable).where(eq(userTable.id, u.id)).limit(1);
  return row?.claimEmail || null;
}
