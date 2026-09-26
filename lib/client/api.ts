import { currencyInfo } from "@/lib/currency/currencies";
import { formatMoney } from "@/lib/currency/money";
import { demoAdminApi, demoApi } from "./demo-api";
import { serverAdminApi, serverApi } from "./server-api";

export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const api = isDemo ? demoApi : serverApi;
export const adminApi = isDemo ? demoAdminApi : serverAdminApi;
// Amount already in `currency` minor units. Same formatter as <Price> (lib/currency/money.ts).
export const money = (minor: number, currency = "USD") => formatMoney(minor, currencyInfo(currency) ?? { code: currency, decimals: 2 });
export const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
// "2 days ago" style text for dashboard rows.
export function agoText(iso: string, now = Date.now()) {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000); const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of steps) if (Math.abs(sec) >= size) return rtf.format(Math.round(sec / size), unit);
  return "just now";
}
