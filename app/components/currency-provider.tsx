"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { BASE_CURRENCY, CURRENCIES, DEFAULT_CHARGEABLE, DEFAULT_CURRENCY, DEFAULT_DISABLED } from "@/lib/currency/currencies";
import { chargeCurrency, convertMinor, formatMoney, rateString, type CurrencyData, type SiteCurrency } from "@/lib/currency/money";
import fallback from "@/lib/currency/fallback-rates.json";
import { useAuth } from "./auth-provider";

// First render (static HTML + hydration) uses the committed fallback rates in USD, so server and client markup match.
const fallbackRates = fallback.rates as Record<string, number>;
const initialData: CurrencyData = {
  base: { code: BASE_CURRENCY, decimals: 2, rate: rateString(fallbackRates[BASE_CURRENCY]) },
  currencies: CURRENCIES.filter((c) => !DEFAULT_DISABLED.includes(c.code)).map((c) => ({ ...c, rate: rateString(fallbackRates[c.code]), roundStep: 1, chargeable: DEFAULT_CHARGEABLE.includes(c.code) })),
  updatedAt: fallback.updatedAt, suggested: null,
};
const STORAGE_KEY = "corecart-currency";
const readStored = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const writeStored = (code: string) => { try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage blocked */ } };

type Ctx = {
  currency: SiteCurrency; currencies: SiteCurrency[]; updatedAt: string | null; ready: boolean;
  setCurrency: (code: string) => void;
  convert: (thbMinor: number, to?: SiteCurrency) => number; // THB satang → minor units of `to` (default: chosen)
  price: (thbMinor: number) => string; // THB satang → formatted in chosen currency
  format: (minor: number, code: string) => string; // already-converted amount (orders)
  charge: (thbMinor: number) => { currency: SiteCurrency; minor: number; text: string; differs: boolean };
};
const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState(initialData); const [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState(DEFAULT_CURRENCY); const [ready, setReady] = useState(false);
  const pickedFor = useRef<string | null>(null);

  useEffect(() => { api.currencies().then((d) => { if (d?.currencies.length) setData(d); }).finally(() => setLoaded(true)); }, []);

  // Choose once rates and session are known, and again when a different user signs in.
  // Order: account setting → this browser's choice → visitor country → USD. Disabled currencies fall back to USD.
  useEffect(() => {
    if (!loaded || user === undefined) return;
    const who = user?.id ?? "guest";
    if (pickedFor.current === who) return;
    pickedFor.current = who;
    const enabled = (c?: string | null) => (c && data.currencies.some((x) => x.code === c) ? c : null);
    const stored = readStored();
    const next = enabled(user?.currency) ?? enabled(stored) ?? enabled(data.suggested) ?? DEFAULT_CURRENCY;
    setCode(next); setReady(true);
    if (user && !user.currency && stored === next) api.setCurrency(next); // keep a guest choice after sign-in
  }, [loaded, user, data]);

  const setCurrency = useCallback((c: string) => {
    setCode(c); writeStored(c);
    if (user) api.setCurrency(c);
  }, [user]);

  const value = useMemo<Ctx>(() => {
    const byCode = (c: string) => data.currencies.find((x) => x.code === c);
    const currency = byCode(code) ?? byCode(DEFAULT_CURRENCY) ?? data.currencies[0];
    const convert = (thb: number, to = currency) => convertMinor(thb, data.base, to);
    const format = (minor: number, c: string) => { const x = byCode(c) ?? CURRENCIES.find((y) => y.code === c); return x ? formatMoney(minor, x) : `${(minor / 100).toFixed(2)} ${c}`; };
    const charge = (thb: number) => {
      const to = chargeCurrency(currency, data.currencies) ?? currency; const minor = convert(thb, to);
      return { currency: to, minor, text: formatMoney(minor, to), differs: to.code !== currency.code };
    };
    return { currency, currencies: data.currencies, updatedAt: data.updatedAt, ready, setCurrency, convert, price: (thb) => formatMoney(convert(thb), currency), format, charge };
  }, [data, code, ready, setCurrency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency needs CurrencyProvider");
  return ctx;
}

// One price element for the whole site. `thb` is the base price in satang.
export function Price({ thb, className }: { thb: number; className?: string }) {
  const { price } = useCurrency();
  return <span className={className} data-price>{price(thb)}</span>;
}

// Honesty rule: when the chosen currency cannot be charged, say exactly what will be charged before payment.
export function ChargeNotice({ thb }: { thb: number }) {
  const { charge, currency } = useCurrency();
  const c = charge(thb);
  if (!c.differs) return null;
  return <p className="charge-notice" role="note">You will be charged <strong>{c.text} {c.currency.code}</strong>. {currency.code} prices are shown for reference only.</p>;
}

export const flagSrc = (code: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/images/flags/${code.toLowerCase()}.svg`;
export const Flag = ({ code }: { code: string }) => <img className="flag" src={flagSrc(code)} alt="" width={20} height={15} loading="lazy" decoding="async" />;
