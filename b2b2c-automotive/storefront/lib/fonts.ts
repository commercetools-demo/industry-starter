// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Self-hosted at build time by next/font (no runtime request to Google). Imported only by app/layout.tsx.
import { Archivo, Inter, Poppins, Public_Sans } from 'next/font/google';

export const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' });
export const archivo = Archivo({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-archivo', display: 'swap' });
export const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-public-sans', display: 'swap' });
export const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap', preload: false }); // only a theme may pick Inter: no preload, the file is fetched when a theme uses it

export const fontClassNames = [poppins, archivo, publicSans, inter].map((f) => f.variable).join(' ');
