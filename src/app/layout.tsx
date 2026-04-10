import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FuelFinder — Live UK Fuel Prices",
  description: "Find the cheapest petrol and diesel near you with live UK prices.",
  manifest: "/manifest.json",
  appleWebApp: { statusBarStyle: "black-translucent", title: "FuelFinder" },
  other: { "mobile-web-app-capable": "yes" },
  openGraph: {
    title: "FuelFinder — Live UK Fuel Prices",
    description: "Find the cheapest petrol and diesel near you. Live prices from Asda, BP, Sainsbury's, MFG and more.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FuelFinder — Live UK Fuel Prices",
    description: "Find the cheapest petrol and diesel near you. Live prices from Asda, BP, Sainsbury's, MFG and more.",
  },
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
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
