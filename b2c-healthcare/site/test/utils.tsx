import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import messages from '@/messages/en-US.json';
import { DEFAULT_LOCALE } from '@/lib/utils';

/**
 * Wraps a component in the providers every test needs. Workstreams C (NextIntlClientProvider)
 * and H (design-system/context providers) extend `Providers` below; do not create other helpers.
 */
export function Providers({ children }: { children: ReactNode }): ReactElement {
  // A fresh cache per render keeps SWR state from leaking between tests.
  return (
    <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={messages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
