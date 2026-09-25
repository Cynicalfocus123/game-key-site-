// Minimal Stripe REST client (no SDK). Card data never touches CoreCart servers:
// cards are entered on Stripe-hosted Checkout (setup mode) and stored by Stripe.
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export async function stripe<T = Record<string, unknown>>(path: string, method: "GET" | "POST" = "GET", params?: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  if (method === "GET" && params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" && params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data as T;
}
