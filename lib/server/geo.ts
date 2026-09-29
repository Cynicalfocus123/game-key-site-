// Approximate place of a sign-in from its IP (sign-in alert, password changed email, login history).
// GEO_PROVIDER (user 2026-09-29: the real lookup waits for the real server):
//   sample     = every IP shows "Bangkok, Thailand (sample location)" — the default outside production, to see the system working.
//   cloudflare = country from Cloudflare's free CF-IPCountry header (when the VPS sits behind Cloudflare). No data file.
//   none       = no location (default in production until one of the above is chosen).
//   Later option: DB-IP Lite file (CC BY 4.0) + the small "maxmind" reader — add an adapter here, nothing else changes.
const COUNTRY_NAMES = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

export type GeoProvider = "none" | "sample" | "cloudflare";
export const geoProvider = (): GeoProvider => {
  const v = process.env.GEO_PROVIDER;
  if (v === "none" || v === "sample" || v === "cloudflare") return v;
  return process.env.NODE_ENV === "production" ? "none" : "sample";
};

// Text for emails and login history, or null when unknown.
export function locationFor(headers: Headers | null | undefined, ip: string | null | undefined): string | null {
  const provider = geoProvider();
  if (provider === "sample") return ip || headers ? "Bangkok, Thailand (sample location)" : null;
  if (provider === "cloudflare" && headers) {
    const cc = (headers.get("cf-ipcountry") || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc) || cc === "XX" || cc === "T1") return null; // XX = unknown, T1 = Tor
    const country = COUNTRY_NAMES?.of(cc) ?? cc;
    const city = headers.get("cf-ipcity"); // only with Cloudflare's "visitor location headers" setting
    return `${city ? `${city}, ` : ""}${country} (approximate)`;
  }
  return null;
}
