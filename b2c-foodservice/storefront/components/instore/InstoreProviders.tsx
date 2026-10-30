'use client';

import type { ReactNode } from 'react';
import { ScannerProvider } from '@/components/instore/scan/scanner-context';
import ShellProviders from '@/components/layout/ShellProviders';

/**
 * Providers of the In-store companion: the shell's (toast, store and overlay state, SWR; the product page and the cart hooks
 * read them) and the scanner dialog's open state. There is no server-read fallback: this mode reads nothing at the layout.
 */
export default function InstoreProviders({ children }: { children: ReactNode }) {
  return (
    <ShellProviders fallback={{}}>
      <ScannerProvider>{children}</ScannerProvider>
    </ShellProviders>
  );
}
