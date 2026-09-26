import type { Metadata } from "next";
import { AuthProvider } from "./components/auth-provider";
import { CartProvider } from "./components/cart-provider";
import { CheckoutGate } from "./components/checkout-gate";
import { CurrencyProvider } from "./components/currency-provider";
import "./globals.css";
import "./account.css";
import "./admin.css";
import "./cart.css";

export const metadata: Metadata = { title: "CoreCart | PC Hardware & Games", description: "PC hardware, technology and digital games." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><CurrencyProvider><CartProvider>{children}<CheckoutGate /></CartProvider></CurrencyProvider></AuthProvider></body></html>;
}
