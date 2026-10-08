import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AuthProvider } from "./components/auth-provider";
import { CartProvider } from "./components/cart-provider";
import { CheckoutGate } from "./components/checkout-gate";
import { CurrencyProvider } from "./components/currency-provider";
import { FavoritesProvider } from "./components/favorites-provider";
import { PurchasePopup } from "./components/purchase-popup";
import "./globals.css";
import "./account.css";
import "./admin.css";
import "./cart.css";
import "./seller.css";

// Geist is downloaded at build time and served from /_next/static/media: no third-party request, no render-blocking @import.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = { title: "CoreCart | PC Hardware & Games", description: "PC hardware, technology and digital games." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={geist.variable}><body><AuthProvider><CurrencyProvider><CartProvider><FavoritesProvider>{children}<CheckoutGate /><PurchasePopup /></FavoritesProvider></CartProvider></CurrencyProvider></AuthProvider></body></html>;
}
