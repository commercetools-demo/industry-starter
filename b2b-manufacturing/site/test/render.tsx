import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { SWRConfig } from 'swr';

type Messages = Record<string, unknown>;

/** Renders with the providers every client component needs: next-intl and an isolated SWR cache. */
export function renderWithProviders(ui: ReactElement, { locale = 'en-US', messages = {} as Messages, ...options }: { locale?: string; messages?: Messages } & Omit<RenderOptions, 'wrapper'> = {}) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}
