// Future task S6: payment method logos (cleaned by "Claude outputs/tools/payment-logos.mjs" from "site image/", 2x size WebP).
// Each logo sits inside an equal white rounded tile (2:1) and scales to fit. No AMEX / PromptPay for now (user 2026-09-28).
// w / h = display size (half the file size) so the browser reserves the space before the image loads.
export const PAYMENT_BRANDS = [
  { id: "visa", name: "Visa", w: 88, h: 29 },
  { id: "mastercard", name: "Mastercard", w: 60, h: 36 },
  { id: "paypal", name: "PayPal", w: 88, h: 22 },
  { id: "apple-pay", name: "Apple Pay", w: 57, h: 36 },
  { id: "google-pay", name: "Google Pay", w: 88, h: 35 },
  { id: "alipay", name: "Alipay", w: 88, h: 31 },
  { id: "unionpay", name: "UnionPay", w: 57, h: 36 },
  { id: "jcb", name: "JCB", w: 48, h: 36 },
  { id: "discover", name: "Discover", w: 57, h: 36 },
  { id: "klarna", name: "Klarna", w: 86, h: 36 },
] as const;

const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`; // server-safe copy of cart-ui assetPath

// Also used alone (Wallet "Top up with payment methods" panel: one small row).
export function PaymentTiles({ lazy }: { lazy?: boolean }) {
  return <ul className="pay-tiles">{PAYMENT_BRANDS.map((b) => <li key={b.id}>
    <img src={assetPath(`/images/payments/${b.id}.webp`)} alt={b.name} width={b.w} height={b.h} loading={lazy ? "lazy" : undefined} decoding="async" />
  </li>)}</ul>;
}

// Cart summary block: lock + title + tiles, 4 per row.
export function PaymentLogos() {
  return <section className="pay-methods" aria-label="Payment methods">
    <p className="pay-methods-title"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" strokeWidth="2" d="M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5z" /></svg>Safe and secure payment methods</p>
    <PaymentTiles />
  </section>;
}

// Strip above the dark footer on every storefront page (lazy: below the fold).
export function PaymentStrip() {
  return <section className="pay-strip" aria-label="Payment methods we accept"><PaymentTiles lazy /></section>;
}
