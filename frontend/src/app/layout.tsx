import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Devanagari } from "next/font/google";

import { BottomNav } from "@/components/Shell";
import { AppStateProvider } from "@/lib/app-state";

import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({
  variable: "--font-deva",
  subsets: ["devanagari"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FloodSense",
  description: "Street-level flood warnings for Central Delhi, hours before the water arrives.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dbe6ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${deva.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppStateProvider>
          <main>{children}</main>
          <BottomNav />
        </AppStateProvider>
      </body>
    </html>
  );
}

