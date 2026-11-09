import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { SWRConfig } from 'swr';
import { ShellUiProvider } from '@/context/shell-ui-context';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';

type Catalogue = Record<string, unknown>;

function catalogue(locale: 'en-US' | 'en-CA'): Catalogue {
  return (locale === 'en-CA' ? enCA : enUS) as unknown as Catalogue;
}

export function renderCard(ui: ReactElement, { locale = 'en-US' }: { locale?: 'en-US' | 'en-CA' } = {}): RenderResult {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogue(locale) as never}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ShellUiProvider>{ui}</ShellUiProvider>
      </SWRConfig>
    </NextIntlClientProvider>,
  );
}
