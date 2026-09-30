// R7: Terms + Privacy Policy acceptance. The server records this version + time only when the sign-up sends it
// (email sign-up: register checkbox or checkout-gate button under the notice; Google: /api/terms/accept right before the redirect).
// Change TERMS_VERSION whenever /terms or /privacy changes; accounts with an older or null terms_version have no proof of this one.
export const TERMS_VERSION = "2026-09-30";
export const TERMS_COOKIE = "cc_terms"; // Google sign-up: signed "version.time", 10 minutes
export const TERMS_COOKIE_MINUTES = 10;
export const TERMS_ERROR = "Accept the Terms and Privacy Policy to continue.";
