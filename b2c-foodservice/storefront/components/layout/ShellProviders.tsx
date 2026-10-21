'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { StoreProvider } from '@/context/store-context';
import { ShellUiProvider } from '@/context/shell-ui-context';
import { ToastProvider } from '@/context/toast';

/**
 * Providers for the shell: toast, store picker state, overlay flags, and the server-read SWR fallback so the store pill
 * is right on first paint. `fallback` keys are `unstable_serialize(...)` strings produced by the layout.
 */
export default function ShellProviders({
  fallback,
  children,
}: {
  fallback: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <SWRConfig value={{ fallback }}>
      <ToastProvider>
        <StoreProvider>
          <ShellUiProvider>{children}</ShellUiProvider>
        </StoreProvider>
      </ToastProvider>
    </SWRConfig>
  );
}
