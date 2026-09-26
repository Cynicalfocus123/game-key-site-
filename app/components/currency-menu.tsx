"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_CURRENCY } from "@/lib/currency/currencies";
import { Flag, useCurrency } from "./currency-provider";

// Search + grid of enabled currencies. Desktop panel uses 3 columns, mobile sheet 2 (CSS).
export function CurrencyList({ onPick, searchRef }: { onPick: () => void; searchRef?: React.RefObject<HTMLInputElement | null> }) {
  const { currency, currencies, setCurrency } = useCurrency();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = currencies.filter((c) => !query || c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query));
  const pick = (code: string) => { setCurrency(code); setQ(""); onPick(); };
  const chargeable = currency.chargeable;
  return <>
    <label className="cur-search"><span className="sr-only">Search currency</span><input ref={searchRef} type="search" placeholder="Search currency" value={q} onChange={(e) => setQ(e.target.value)} /></label>
    <div className="cur-grid">
      {shown.map((c) => <button key={c.code} type="button" className={c.code === currency.code ? "selected" : ""} aria-pressed={c.code === currency.code} title={c.name} onClick={() => pick(c.code)}>
        <Flag code={c.code} /><span>{c.code}</span><span className="sr-only"> {c.name}</span>{c.code === currency.code && <b aria-hidden="true">✓</b>}
      </button>)}
      {!shown.length && <p className="cur-empty">No currency matches “{q}”.</p>}
    </div>
    {!chargeable && <p className="cur-note">Payment in {currency.code} is not available yet. Checkout charges {DEFAULT_CURRENCY} and shows the exact amount first.</p>}
  </>;
}

// Desktop / tablet header: settings dropdown (Currency, Language, Help) that slides to the currency panel.
export function CurrencyDropdown() {
  const { currency } = useCurrency();
  const [open, setOpen] = useState(false); const [panel, setPanel] = useState<"menu" | "currency">("menu");
  const [height, setHeight] = useState<number>();
  const wrap = useRef<HTMLDivElement>(null); const toggle = useRef<HTMLButtonElement>(null);
  const menuPane = useRef<HTMLDivElement>(null); const curPane = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null); const currencyRow = useRef<HTMLButtonElement>(null);

  const close = (focus = true) => { setOpen(false); if (focus) toggle.current?.focus(); window.setTimeout(() => setPanel("menu"), 250); };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  // Animate the panel height to whichever pane is showing.
  useLayoutEffect(() => { const el = panel === "menu" ? menuPane.current : curPane.current; if (el) setHeight(el.offsetHeight); }, [panel, open, currency.code]);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => (panel === "currency" ? search.current : currencyRow.current)?.focus({ preventScroll: true }), panel === "currency" ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [open, panel]);

  return <div className="cur-wrap" ref={wrap}>
    <button ref={toggle} type="button" className="cur-toggle" aria-haspopup="dialog" aria-expanded={open} aria-label={`Settings. Currency ${currency.code}`} onClick={() => (open ? close() : setOpen(true))}>
      <Flag code={currency.code} /><span>{currency.code}</span><i aria-hidden="true">▾</i>
    </button>
    <div className={`cur-drop${open ? " open" : ""}`} role="dialog" aria-label="Settings" aria-hidden={!open} inert={!open} style={{ height }}>
      <div className={`cur-track${panel === "currency" ? " sub" : ""}`}>
        <div className="cur-pane" ref={menuPane} inert={panel !== "menu"}>
          <button ref={currencyRow} type="button" className="cur-row" onClick={() => setPanel("currency")}>Currency <span><Flag code={currency.code} />{currency.code} ›</span></button>
          <div className="cur-row static">Language <span>English</span></div>
          <a className="cur-row" href="#">Help and support</a>
        </div>
        <div className="cur-pane cur-pane-list" ref={curPane} inert={panel !== "currency"}>
          <div className="cur-head"><button type="button" onClick={() => setPanel("menu")}>‹ Go back</button><strong>Currency</strong></div>
          <CurrencyList searchRef={search} onPick={() => close()} />
        </div>
      </div>
    </div>
  </div>;
}

// Mobile: drawer row + full-screen list sliding in from the right. Parent owns `open` so Escape closes the sheet first.
export function CurrencyDrawerRow({ onOpen }: { onOpen: () => void }) {
  const { currency } = useCurrency();
  return <button type="button" className="drawer-setting" onClick={onOpen}>Currency <span><Flag code={currency.code} />{currency.code} ›</span></button>;
}
export function CurrencySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { const t = window.setTimeout(() => search.current?.focus({ preventScroll: true }), 280); return () => window.clearTimeout(t); } }, [open]);
  return <div className={`cur-sheet${open ? " open" : ""}`} role="dialog" aria-label="Choose currency" aria-hidden={!open} inert={!open}>
    <div className="cur-head"><button type="button" onClick={onClose}>‹ Go back</button><strong>Currency</strong></div>
    <CurrencyList searchRef={search} onPick={onClose} />
  </div>;
}
