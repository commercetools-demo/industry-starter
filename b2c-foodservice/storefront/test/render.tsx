import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';

const CATALOGUES: Record<string, typeof enUS> = { 'en-US': enUS, 'en-CA': enCA };

export function renderWithIntl(
  ui: ReactElement,
  { locale = 'en-US', ...options }: { locale?: string } & Omit<RenderOptions, 'wrapper'> = {},
): RenderResult {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
