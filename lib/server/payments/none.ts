import type { PaymentProvider } from "./types";

// Default adapter: no payment provider yet. Pay stays disabled ("Card payments coming soon"), no top-up rows are created,
// and every webhook is rejected (there is nothing to verify it against).
export const noneProvider: PaymentProvider = {
  id: "none",
  label: "No payment provider",
  available: false,
  simulate: false,
  supports: () => false,
  async createPayment() { throw new Error("No payment provider configured"); },
  async verifyWebhook() { return null; },
};
