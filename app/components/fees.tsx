"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { charges, FEE_DEFAULTS, FEE_TIP, pctText, TAX_TIP, type Charges, type FeeSettings } from "@/lib/fees";
import { Price } from "./currency-provider";

// Service fee + sales tax lines for the cart, checkout and payment summaries (task 7). Settings load once per page view (public GET).
// Could not load = no fee / tax lines (the server computes the real amounts when the order is made).
let cache: Promise<FeeSettings | null> | null = null;
export function useFees(): FeeSettings | null {
  const [s, setS] = useState<FeeSettings | null>(null);
  useEffect(() => { let live = true; (cache ??= api.fees()).then((v) => { if (live) setS(v); }); return () => { live = false; }; }, []);
  return s;
}
// base = sub-total minus discount (THB satang). country null = billing country not known yet → tax "Calculated at payment".
export function useCharges(base: number, country: string | null | undefined): { settings: FeeSettings; c: Charges } {
  const settings = useFees() ?? FEE_DEFAULTS;
  return { settings, c: charges(settings, base, country) };
}

const Tip = ({ text }: { text: string }) => <span className="tip" tabIndex={0} role="note" aria-label={text}>?<span className="tip-box" aria-hidden="true">{text}</span></span>;
// always = show "Service fee ฿0.00" even when the fee is off (payment page, Eneba style); elsewhere the line shows only when the fee is on.
export function FeeTaxLines({ settings, c, always = false }: { settings: FeeSettings; c: Charges; always?: boolean }) {
  return <>
    {(settings.feeEnabled || always) && <div className="fee-line"><dt>Service fee <Tip text={settings.feeEnabled ? FEE_TIP : "CoreCart charges no service fee right now."} /></dt><dd><Price thb={c.fee} /></dd></div>}
    {settings.taxEnabled && <div className="tax-line"><dt>Sales tax{c.taxBp != null && ` ${pctText(c.taxBp)}`} <Tip text={TAX_TIP} /></dt>
      <dd>{c.tax == null ? <span className="muted-inline">Calculated at payment</span> : <Price thb={c.tax} />}</dd></div>}
  </>;
}
