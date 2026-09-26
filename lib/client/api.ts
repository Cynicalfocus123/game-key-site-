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
