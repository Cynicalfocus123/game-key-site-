// Currency list shared by server, client and build script. Rates are "units per 1 USD" (ExchangeRate-API format).
export type CurrencyInfo = { code: string; name: string; symbol: string; decimals: number };

export const BASE_CURRENCY = "THB"; // admin enters product prices in THB
export const DEFAULT_CURRENCY = "USD"; // fallback display + charge currency; always enabled and chargeable
export const RATE_SOURCE = "https://open.er-api.com/v6/latest/USD";
export const RATE_CREDIT = { label: "Rates by Exchange Rate API", href: "https://www.exchangerate-api.com" };

const zero = ["JPY", "KRW", "CLP", "ISK"];
const three = ["BHD", "JOD", "KWD", "TND"];
const list: [string, string, string][] = [
  ["AED", "UAE Dirham", "AED"], ["ARS", "Argentine Peso", "AR$"], ["AUD", "Australian Dollar", "A$"], ["AZN", "Azerbaijani Manat", "₼"],
  ["BDT", "Bangladeshi Taka", "৳"], ["BGN", "Bulgarian Lev", "лв"], ["BHD", "Bahraini Dinar", "BD"], ["BRL", "Brazilian Real", "R$"],
  ["CAD", "Canadian Dollar", "C$"], ["CHF", "Swiss Franc", "CHF"], ["CLP", "Chilean Peso", "CLP$"], ["CNY", "Chinese Yuan", "CN¥"],
  ["COP", "Colombian Peso", "COL$"], ["CRC", "Costa Rican Colón", "₡"], ["CZK", "Czech Koruna", "Kč"], ["DKK", "Danish Krone", "DKK"],
  ["DZD", "Algerian Dinar", "DA"], ["EUR", "Euro", "€"], ["GBP", "British Pound", "£"], ["HKD", "Hong Kong Dollar", "HK$"],
  ["HUF", "Hungarian Forint", "Ft"], ["IDR", "Indonesian Rupiah", "Rp"], ["ILS", "Israeli New Shekel", "₪"], ["INR", "Indian Rupee", "₹"],
  ["ISK", "Icelandic Króna", "ISK"], ["JOD", "Jordanian Dinar", "JD"], ["JPY", "Japanese Yen", "¥"], ["KRW", "South Korean Won", "₩"],
  ["KWD", "Kuwaiti Dinar", "KD"], ["KZT", "Kazakhstani Tenge", "₸"], ["MAD", "Moroccan Dirham", "MAD"], ["MXN", "Mexican Peso", "MX$"],
  ["MYR", "Malaysian Ringgit", "RM"], ["NOK", "Norwegian Krone", "NOK"], ["NZD", "New Zealand Dollar", "NZ$"], ["PEN", "Peruvian Sol", "S/"],
  ["PHP", "Philippine Peso", "₱"], ["PKR", "Pakistani Rupee", "Rs"], ["PLN", "Polish Złoty", "zł"], ["QAR", "Qatari Riyal", "QR"],
  ["RON", "Romanian Leu", "lei"], ["RUB", "Russian Ruble", "₽"], ["SAR", "Saudi Riyal", "SAR"], ["SEK", "Swedish Krona", "SEK"],
  ["SGD", "Singapore Dollar", "S$"], ["THB", "Thai Baht", "฿"], ["TND", "Tunisian Dinar", "DT"], ["TRY", "Turkish Lira", "₺"],
  ["UAH", "Ukrainian Hryvnia", "₴"], ["USD", "US Dollar", "$"], ["UYU", "Uruguayan Peso", "$U"], ["UZS", "Uzbekistani Som", "soʻm"],
  ["ZAR", "South African Rand", "R"],
];
export const CURRENCIES: CurrencyInfo[] = list.map(([code, name, symbol]) => ({ code, name, symbol, decimals: zero.includes(code) ? 0 : three.includes(code) ? 3 : 2 }));
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
export const currencyInfo = (code: string) => CURRENCIES.find((c) => c.code === code);
export const isCurrencyCode = (v: unknown): v is string => typeof v === "string" && CURRENCY_CODES.includes(v);

// Launch defaults (user decision 2026-09-26). Admin changes them on /admin/currencies.
// BGN off: Bulgaria uses the euro since 2026-01-01. RUB off: sanctions.
export const DEFAULT_DISABLED = ["BGN", "RUB"];
export const DEFAULT_CHARGEABLE = ["USD", "THB", "AED"];

// Country (ISO 3166 alpha-2) → currency, for auto-pick. Countries not listed fall back to USD.
const euro = "AT BE BG CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK AD MC SM VA ME XK";
const countryGroups: Record<string, string> = {
  AE: "AED", AR: "ARS", AU: "AUD", AZ: "AZN", BD: "BDT", BH: "BHD", BR: "BRL", CA: "CAD", CH: "CHF", LI: "CHF", CL: "CLP", CN: "CNY",
  CO: "COP", CR: "CRC", CZ: "CZK", DK: "DKK", DZ: "DZD", GB: "GBP", HK: "HKD", HU: "HUF", ID: "IDR", IL: "ILS", IN: "INR", IS: "ISK",
  JO: "JOD", JP: "JPY", KR: "KRW", KW: "KWD", KZ: "KZT", MA: "MAD", MX: "MXN", MY: "MYR", NO: "NOK", NZ: "NZD", PE: "PEN", PH: "PHP",
  PK: "PKR", PL: "PLN", QA: "QAR", RO: "RON", RU: "RUB", SA: "SAR", SE: "SEK", SG: "SGD", TH: "THB", TN: "TND", TR: "TRY", UA: "UAH",
  US: "USD", EC: "USD", SV: "USD", PA: "USD", PR: "USD", UY: "UYU", UZ: "UZS", ZA: "ZAR",
};
for (const c of euro.split(" ")) countryGroups[c] = "EUR";
export const currencyForCountry = (country?: string | null) => (country ? countryGroups[country.toUpperCase()] : undefined);

// Demo mode has no IP lookup: guess the country from the browser time zone, then from the language region.
const zones: Record<string, string> = {
  "Asia/Bangkok": "TH", "Asia/Dubai": "AE", "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID", "Asia/Manila": "PH", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD",
  "Asia/Hong_Kong": "HK", "Asia/Shanghai": "CN", "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Bahrain": "BH",
  "Asia/Amman": "JO", "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL", "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ", "Asia/Baku": "AZ",
  "Europe/London": "GB", "Europe/Zurich": "CH", "Europe/Oslo": "NO", "Europe/Stockholm": "SE", "Europe/Copenhagen": "DK",
  "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Budapest": "HU", "Europe/Bucharest": "RO", "Europe/Istanbul": "TR",
  "Europe/Kyiv": "UA", "Europe/Kiev": "UA", "Europe/Moscow": "RU", "Atlantic/Reykjavik": "IS", "Africa/Johannesburg": "ZA",
  "Africa/Casablanca": "MA", "Africa/Algiers": "DZ", "Africa/Tunis": "TN", "Pacific/Auckland": "NZ", "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR", "America/Santiago": "CL", "America/Bogota": "CO",
  "America/Costa_Rica": "CR", "America/Lima": "PE", "America/Mexico_City": "MX", "America/Montevideo": "UY", "America/Toronto": "CA",
  "America/Vancouver": "CA", "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
};
export function guessCountry(timeZone?: string, languages: readonly string[] = []) {
  if (timeZone) {
    if (zones[timeZone]) return zones[timeZone];
    if (timeZone.startsWith("Australia/")) return "AU";
    if (timeZone.startsWith("Europe/")) return "DE"; // other European zones: euro area
  }
  for (const l of languages) { const region = l.split("-")[1]; if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase(); }
  return null;
}
