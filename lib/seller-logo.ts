// Seller store logo (marketplace step 4, user 2026-10-08): profile picture only (never a banner). WebP or AVIF, checked by file
// content (not the name); any shape; longest side 256–2048 px; up to 1 MB. Shown fitted (contain, centred, never stretched or cut)
// in a square frame at 96 px (store page), 56 px (seller card) and 40 px (offer row). Same checks in the browser, the demo and the API.
export const LOGO_MIN_SIDE = 256;
export const LOGO_MAX_SIDE = 2048;
export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_SIZES = [96, 56, 40] as const;
export const LOGO_LIMIT = { max: 30, windowMs: 10 * 60_000 }; // logo saves per seller
export type LogoType = "webp" | "avif";
export const LOGO_MIME: Record<LogoType, string> = { webp: "image/webp", avif: "image/avif" };
export type LogoInfo = { type: LogoType; width: number; height: number };
export const LOGO_ERRORS = {
  type: "Use a WebP or AVIF file.",
  big: "Logo is too big. Longest side up to 2048 px and up to 1 MB.",
  small: (w: number, h: number) => `Logo is too small (${w} × ${h}). The longest side must be at least ${LOGO_MIN_SIDE} px.`,
  unreadable: "This file could not be read. Save it again as WebP or AVIF.",
  limit: "Too many logo changes. Wait a few minutes and try again.",
} as const;
export const LOGO_RULES_TEXT = "WebP or AVIF only · any shape (shown fitted inside the square, never stretched or cut) · longest side 256 to 2048 px · up to 1 MB.";

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];

// WebP: RIFF....WEBP + first chunk VP8 (lossy), VP8L (lossless) or VP8X (extended: animation, alpha) — each stores the canvas size.
function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null; // key frame start code
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null; // lossless signature
    return { width: 1 + (((b[22] & 0x3f) << 8) | b[21]), height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
  }
  if (chunk === "VP8X") return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  return null;
}
// AVIF: ISO BMFF "ftyp" box with brand avif / avis, size from the "ispe" (image spatial extents) property. A grid image has one ispe per
// tile plus the full image; the largest one is the picture.
function avifSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 32 || ascii(b, 4, 4) !== "ftyp") return null;
  const ftypEnd = Math.min(u32be(b, 0), b.length, 256); let brand = false;
  for (let i = 8; i + 4 <= ftypEnd; i += 4) if (i !== 12 && /^avi[fs]$/.test(ascii(b, i, 4))) brand = true; // major brand + compatible brands (skip minor version)
  if (!brand) return null;
  let best: { width: number; height: number } | null = null;
  const end = Math.min(b.length - 16, 1 << 20); // the box needs 16 bytes from "ispe" on (it may end the file)
  for (let i = 4; i <= end; i++) {
    if (b[i] !== 0x69 || ascii(b, i, 4) !== "ispe") continue; // "ispe": size(4) type(4) version+flags(4) width(4) height(4)
    const width = u32be(b, i + 8); const height = u32be(b, i + 12);
    if (width > 0 && height > 0 && (!best || width * height > best.width * best.height)) best = { width, height };
  }
  return best;
}
// Type + size from the bytes. null = not a WebP / AVIF (a PNG renamed to .webp is null here).
export function logoInfo(b: Uint8Array): LogoInfo | null {
  const w = webpSize(b); if (w) return { type: "webp", ...w };
  const a = avifSize(b); if (a) return { type: "avif", ...a };
  return null;
}
// One message per problem, in the order the seller fixes them: size in bytes, type, pixels.
export function checkLogo(b: Uint8Array): { ok: true; info: LogoInfo } | { ok: false; error: string } {
  if (b.length > LOGO_MAX_BYTES) return { ok: false, error: LOGO_ERRORS.big };
  const info = logoInfo(b);
  if (!info) return { ok: false, error: LOGO_ERRORS.type };
  if (!info.width || !info.height) return { ok: false, error: LOGO_ERRORS.unreadable };
  const long = Math.max(info.width, info.height);
  if (long > LOGO_MAX_SIDE) return { ok: false, error: LOGO_ERRORS.big };
  if (long < LOGO_MIN_SIDE) return { ok: false, error: LOGO_ERRORS.small(info.width, info.height) };
  return { ok: true, info };
}
// data:image/webp;base64,… ↔ bytes (the upload is JSON like the product image upload). The declared type is ignored: content decides.
export function dataUrlBytes(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== "string" || dataUrl.length > Math.ceil(LOGO_MAX_BYTES * 1.4) + 100) return null;
  const m = /^data:[a-z0-9.+/-]*;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl); if (!m) return null;
  try { const bin = atob(m[1]); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; } catch { return null; }
}
export function bytesDataUrl(b: Uint8Array, type: LogoType) {
  let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `data:${LOGO_MIME[type]};base64,${btoa(bin)}`;
}
