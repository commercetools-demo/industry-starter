import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { SWRConfig } from 'swr';
import { ToastProvider } from '@/components/ui/Toast';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';

const MESSAGES: Record<string, typeof enMessages> = { 'en-US': enMessages, 'de-DE': deMessages };

type Options = Omit<RenderOptions, 'wrapper'> & { locale?: 'en-US' | 'de-DE' };

export function renderWithProviders(ui: ReactElement, { locale = 'en-US', ...options }: Options = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ToastProvider>{ui}</ToastProvider>
      </SWRConfig>
    </NextIntlClientProvider>,
    options,
  );
}
