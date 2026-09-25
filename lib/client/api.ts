import { demoAdminApi, demoApi } from "./demo-api";
import { serverAdminApi, serverApi } from "./server-api";

export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const api = isDemo ? demoApi : serverApi;
export const adminApi = isDemo ? demoAdminApi : serverAdminApi;
export const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
export const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
