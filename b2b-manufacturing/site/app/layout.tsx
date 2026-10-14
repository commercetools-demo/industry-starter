/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactNode } from 'react';

// The <html> element is rendered by app/[locale]/layout.tsx so that it carries the active locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
