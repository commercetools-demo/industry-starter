import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Lato, Poppins, Roboto } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font at build time (no runtime request to Google).
// tokens.css re-points --font-display/--font-meta/--font-body at these variables.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-lato",
});
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Malva Healthcare",
  description: "Malva Healthcare storefront",
};

// The root layout is the only one that may render <html>; lang follows the active locale
// (set by proxy.ts for /<locale>/... routes, default locale elsewhere).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${poppins.variable} ${lato.variable} ${roboto.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
