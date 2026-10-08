import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { SWRConfig } from 'swr';

/**
 * Wraps a component in the providers every test needs. Workstreams C (NextIntlClientProvider)
 * and H (design-system/context providers) extend `Providers` below; do not create other helpers.
 */
export function Providers({ children }: { children: ReactNode }): ReactElement {
  // A fresh cache per render keeps SWR state from leaking between tests.
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
