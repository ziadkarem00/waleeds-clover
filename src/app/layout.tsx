import type { Metadata, Viewport } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["600", "700"],
  variable: "--font-subtitle-ar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Waleed's Clover — Black Clover Season 1",
  description:
    "Dedicated to Walid. Minimal dark-mode streaming app for Black Clover Season 1 (Episodes 1–170).",
};

export const viewport: Viewport = {
  themeColor: "#09090B",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${cairo.variable}`}>
      <body className="min-h-screen bg-obsidian font-sans text-zinc-100 antialiased selection:bg-crimson/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
