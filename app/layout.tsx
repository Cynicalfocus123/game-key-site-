import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "CoreCart | PC Hardware & Games", description: "PC hardware, technology and digital games." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
