import type { ReactNode } from 'react';
import { Caprasimo, Figtree } from 'next/font/google';
import './globals.css';

const caprasimo = Caprasimo({ weight: '400', subsets: ['latin'], variable: '--font-caprasimo', display: 'swap' });
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${caprasimo.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
