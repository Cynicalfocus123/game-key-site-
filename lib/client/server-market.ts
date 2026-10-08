import type { KeyAddResult, KeyReport, ProductRequest, RequestErrors, SellerHome, SellerOffer, SellerStore } from "@/lib/marketplace";
import type { MarketApi } from "./types";

// Seller marketplace API client (server mode). Same answers as lib/client/demo-market.ts.
type Fail = { ok: false; error: string; errors?: RequestErrors; productId?: string };
async function call<T>(url: string, method = "GET", body?: object): Promise<({ ok: true } & T) | Fail> {
  try {
    const res = await fetch(url, { method, credentials: "include", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const data = await res.json();
    return res.ok ? { ok: true, ...data } : { ok: false, error: data?.error || `Error ${res.status}`, errors: data?.errors, productId: data?.productId };
  } catch {
    return { ok: false, error: "Network error. Check your connection." };
  }
}
export const serverMarketApi: MarketApi = {
  home: () => call<{ home: SellerHome }>("/api/seller"),
  saveStore: (patch) => call<{ store: SellerStore }>("/api/seller", "PATCH", patch),
  offers: () => call<{ offers: SellerOffer[] }>("/api/seller/offers"),
  createOffer: (input) => call<{ offer: SellerOffer; keys: KeyAddResult | null }>("/api/seller/offers", "POST", input),
  updateOffer: (id, patch) => call<{ offer: SellerOffer }>("/api/seller/offers", "PATCH", { id, ...patch }),
  checkKeys: (productId, text) => call<{ report: KeyReport }>("/api/seller/keys", "POST", { productId, text, check: true }),
  addKeys: (offerId, text) => call<{ result: KeyAddResult }>("/api/seller/keys", "POST", { offerId, text }),
  requests: () => call<{ requests: ProductRequest[] }>("/api/seller/requests"),
  sendRequest: (input) => call<{ request: ProductRequest }>("/api/seller/requests", "POST", input),
};
