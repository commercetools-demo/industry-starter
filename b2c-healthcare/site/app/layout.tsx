import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Malva Healthcare",
  description: "Malva Healthcare storefront",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
