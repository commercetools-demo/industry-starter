/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { Inter } from 'next/font/google';

// Self-hosted at build time by next/font: no runtime request to Google (Q-B01). Imported only by app/layout.tsx.
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const fontClassNames = [inter].map((f) => f.variable).join(' ');
