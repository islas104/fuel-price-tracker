import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FuelFinder — Live UK Fuel Prices",
  description: "Find the cheapest petrol and diesel near you with live UK prices.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FuelFinder" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-gray-900 overscroll-none`}>
        {children}
      </body>
    </html>
  );
}
