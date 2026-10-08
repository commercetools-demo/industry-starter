import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Malva Healthcare",
  description: "Malva Healthcare storefront",
};

// The root layout is the only one that may render <html>; lang follows the active locale
// (set by proxy.ts for /<locale>/... routes, default locale elsewhere).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
