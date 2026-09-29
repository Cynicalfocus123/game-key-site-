import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// AES-256-GCM + HMAC with env KEY_ENCRYPTION_KEY (base64, 32 bytes). Used for game keys (task B) and seller KYC data (T3).
// Local development without the env var uses a fixed dev key; production never does.
export function encryptionKey(): Buffer | null {
  const env = process.env.KEY_ENCRYPTION_KEY?.trim();
  if (env) { const b = Buffer.from(env, "base64"); return b.length === 32 ? b : null; }
  if (process.env.NODE_ENV === "production") return null; // never a built-in key in production
  return createHash("sha256").update("corecart-dev-key-inventory").digest();
}
export const hmacOf = (key: Buffer, text: string) => createHmac("sha256", key).update(text).digest("base64url");
export function encryptText(key: Buffer, text: string) {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
export function decryptText(key: Buffer, enc: string) {
  const [iv, tag, data] = enc.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
// Files: iv (12) + tag (16) + data.
export function encryptBytes(key: Buffer, bytes: Uint8Array) {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(bytes), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]);
}
export function decryptBytes(key: Buffer, blob: Buffer) {
  const d = createDecipheriv("aes-256-gcm", key, blob.subarray(0, 12)); d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}
