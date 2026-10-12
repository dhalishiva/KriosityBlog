import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { site, blogUrl } from "@/lib/site";

const bricolage = localFont({ src: "./fonts/bricolage.woff2", variable: "--font-display", weight: "500 800", display: "swap" });
const instrument = localFont({ src: "./fonts/instrument-sans.woff2", variable: "--font-sans", weight: "400 700", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: { default: `${site.name} — AI news, models and comparisons`, template: `%s | ${site.name}` },
  description: site.description,
  alternates: { canonical: blogUrl(), types: { "application/rss+xml": blogUrl("/rss.xml") } },
  openGraph: { type: "website", siteName: "Kriosity", locale: "en_IN", url: blogUrl(), images: [{ url: blogUrl("/og"), width: 1200, height: 630, alt: "Kriosity Blog" }] },
  twitter: { card: "summary_large_image", site: "@dhalishiva", images: [blogUrl("/og")] },
};

export const viewport: Viewport = { themeColor: "#f2f5f7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${bricolage.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
