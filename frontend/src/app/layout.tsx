import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Devanagari } from "next/font/google";

import { BottomNav, Header } from "@/components/Shell";
import { AppStateProvider } from "@/lib/app-state";

import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({
  variable: "--font-deva",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FloodSense",
  description: "Street-level flood warnings for Central Delhi, hours before the water arrives.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${deva.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <AppStateProvider>
          <Header />
          <main className="pb-20 md:pb-0">{children}</main>
          <BottomNav />
        </AppStateProvider>
      </body>
    </html>
  );
}
