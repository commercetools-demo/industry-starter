import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { SWRConfig } from 'swr';
import { ToastProvider } from '@/components/ui/Toast';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import type { Market } from '@/lib/utils';

const MESSAGES = { 'en-US': enMessages, 'de-DE': deMessages } as const;

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & { locale?: Market['locale'] };

export function renderWithProviders(ui: ReactElement, { locale = 'en-US', ...options }: RenderWithProvidersOptions = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ToastProvider>{ui}</ToastProvider>
      </SWRConfig>
    </NextIntlClientProvider>,
    options,
  );
}
