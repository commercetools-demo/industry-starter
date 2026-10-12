import { Inter } from 'next/font/google';

// Self-hosted at build time by next/font: no runtime request to Google (Q-B01). Imported only by app/layout.tsx.
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const fontClassNames = [inter].map((f) => f.variable).join(' ');
