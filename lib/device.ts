// "Chrome on Windows" from a browser user agent (sign-in alert, password changed email, login history). Small on purpose: no parser package.
export function deviceParts(ua: string | null | undefined) {
  if (!ua) return null;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  return { browser, os };
}
export const deviceName = (ua: string | null | undefined) => { const d = deviceParts(ua); return d ? `${d.browser} on ${d.os}` : "Unknown device"; };
