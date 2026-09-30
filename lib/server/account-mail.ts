import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";
import { deviceName } from "@/lib/device";
import { emailTime, VERIFY_CODE_MINUTES } from "@/lib/emails";
import { maskIp } from "@/lib/profile";
import { db } from "./db";
import { emailCode, knownDevice } from "./db/schema";
import { sendTemplate } from "./email";
import { locationFor } from "./geo";
import { hmacOf } from "./secure";

// Account emails that need server facts: 6-digit verify code, new-device sign-in alert, password changed (email task, 2026-09-29).

const secret = () => Buffer.from(process.env.BETTER_AUTH_SECRET || "corecart-dev-only-secret");
const codeHash = (email: string, code: string) => hmacOf(secret(), `verify:${email.toLowerCase()}:${code}`);
export const CODE_TRIES = 5;
export const CODE_ERRORS = { format: "Enter the 6-digit code from the email.", wrong: "Wrong code. Check the email and try again.", expired: "This code has expired. Send a new code.",
  tries: "Too many wrong codes. Send a new code.", limit: "Too many tries. Wait a few minutes and try again." };

// Made while Better Auth sends its verification link: the code stands for that link's token (one live code per user, 10 minutes).
export async function issueVerifyCode(userId: string, email: string, token: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.delete(emailCode).where(eq(emailCode.userId, userId));
  await db.insert(emailCode).values({ id: crypto.randomUUID(), userId, email: email.toLowerCase(), codeHash: codeHash(email, code), token, expiresAt: new Date(Date.now() + VERIFY_CODE_MINUTES * 60_000) });
  return code;
}

// Right code → the Better Auth token (the caller verifies with it, which also signs in). 5 tries per code, then it is dead.
// N1: every try first takes one attempt in ONE SQL statement (attempts = attempts + 1 … where attempts < 5), so parallel guesses
// each count; the right code is then used once (delete … returning: a second parallel use gets "expired").
export async function checkVerifyCode(email: string, code: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: CODE_ERRORS.format };
  const [row] = await db.select().from(emailCode).where(eq(emailCode.email, email.toLowerCase())).orderBy(desc(emailCode.createdAt)).limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, error: CODE_ERRORS.expired };
  const [tried] = await db.update(emailCode).set({ attempts: sql`${emailCode.attempts} + 1` }).where(and(eq(emailCode.id, row.id), lt(emailCode.attempts, CODE_TRIES))).returning({ attempts: emailCode.attempts });
  if (!tried) return { ok: false, error: CODE_ERRORS.tries };
  const want = Buffer.from(row.codeHash), got = Buffer.from(codeHash(email, code));
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, error: tried.attempts >= CODE_TRIES ? CODE_ERRORS.tries : CODE_ERRORS.wrong };
  const [used] = await db.delete(emailCode).where(eq(emailCode.id, row.id)).returning({ token: emailCode.token });
  return used ? { ok: true, token: used.token } : { ok: false, error: CODE_ERRORS.expired };
}

// Sign-in facts for emails: device, masked IP, approximate place (lib/server/geo.ts), Bangkok time.
export function signInFacts(name: string, ip: string | null | undefined, ua: string | null | undefined, headers?: Headers | null) {
  return { name, when: emailTime(new Date()), device: deviceName(ua), ip: ip ? maskIp(ip) : "Unknown", location: locationFor(headers, ip) };
}

// ---- known devices (cookie cc_device = random 32 bytes; only its SHA-256 is stored) ----
export const DEVICE_COOKIE = "cc_device";
export const DEVICE_COOKIE_DAYS = 400;
const deviceHash = (v: string) => createHash("sha256").update(v).digest("base64url");
const validCookie = (v: string | null | undefined): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);

// After every sign-in. Returns the cookie value to (re)set. The first device of an account never alerts; any later unknown device emails "New sign-in".
export async function noteDevice(u: { id: string; name: string; email: string }, cookie: string | null | undefined, ip: string | null | undefined, ua: string | null | undefined, headers?: Headers | null) {
  const value = validCookie(cookie) ? cookie : randomBytes(32).toString("base64url");
  const hash = deviceHash(value); const now = new Date();
  const [known] = await db.select({ id: knownDevice.id }).from(knownDevice).where(and(eq(knownDevice.userId, u.id), eq(knownDevice.deviceHash, hash))).limit(1);
  const facts = signInFacts(u.name, ip, ua, headers);
  if (known) { await db.update(knownDevice).set({ lastSeenAt: now, ipAddress: ip ?? null, location: facts.location }).where(eq(knownDevice.id, known.id)); return value; }
  const [{ n }] = await db.select({ n: count() }).from(knownDevice).where(eq(knownDevice.userId, u.id));
  await db.insert(knownDevice).values({ id: crypto.randomUUID(), userId: u.id, deviceHash: hash, label: facts.device, ipAddress: ip ?? null, location: facts.location }).onConflictDoNothing();
  if (Number(n) > 0) await sendTemplate(u.email, "newSignIn", facts);
  return value;
}
