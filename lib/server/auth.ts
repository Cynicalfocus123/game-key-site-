import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { isCurrencyCode } from "@/lib/currency/currencies";
import { loginMethod } from "./admin";
import { db } from "./db";
import { loginEvent, schema, user as userTable } from "./db/schema";
import { actionEmail, sendEmail } from "./email";

const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
  : undefined;

// Send after response so timing does not reveal whether an email exists.
const queue = (fn: () => Promise<void>) => after(() => fn().catch((e) => console.error("[CoreCart email]", e)));

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
      const mail = actionEmail("Reset your password", "Use the button below to choose a new CoreCart password. Link expires in 1 hour.", "Reset password", url);
      queue(() => sendEmail({ to: user.email, subject: "Reset your CoreCart password", ...mail }));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const mail = actionEmail("Verify your email", `Hi ${user.name}, confirm this email address to activate your CoreCart account.`, "Verify email", url);
      queue(() => sendEmail({ to: user.email, subject: "Verify your CoreCart account", ...mail }));
    },
  },
  socialProviders: google,
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "customer", input: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
      marketingOptIn: { type: "boolean", required: false, defaultValue: false, input: true },
      stripeCustomerId: { type: "string", required: false, input: false, returned: false },
      currency: { type: "string", required: false, input: true }, // display currency; validated in databaseHooks
    },
  },
  databaseHooks: {
    // Every sign-up is a customer. Admins are created only by scripts/create-admin.mjs (lib/server/admin.ts).
    user: {
      create: { before: async (u) => ({ data: { ...u, role: "customer", termsAcceptedAt: new Date(), currency: isCurrencyCode(u.currency) ? u.currency : null } }) },
      // Only known currency codes can be saved on the account.
      update: { before: async (u) => { if ("currency" in u && u.currency !== null && !isCurrencyCode(u.currency)) return false; return { data: u }; } },
    },
    // Admin accounts sign in with email + password only: never link Google (or any other provider) to them.
    account: {
      create: {
        before: async (a) => {
          if (a.providerId === "credential") return { data: a };
          const [u] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, a.userId)).limit(1);
          return u?.role === "admin" ? false : { data: a };
        },
      },
    },
    // Every new session = one successful sign-in. Record it for the admin login history.
    session: {
      create: {
        after: async (s, ctx) => {
          try {
            const method = loginMethod(ctx?.path);
            if (!method) return;
            await db.insert(loginEvent).values({ id: crypto.randomUUID(), userId: s.userId, method, ipAddress: s.ipAddress ?? null, userAgent: s.userAgent ?? null });
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
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
