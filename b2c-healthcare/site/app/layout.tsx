import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${lato.variable} ${roboto.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
