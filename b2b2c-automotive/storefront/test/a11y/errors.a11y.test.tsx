// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y: page-level axe for not-found, the error boundary, the root pages and the impersonation banner on and off.
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { axePage, LOCALES, renderStorePage, stubShellFetch } from '@/test/a11y';

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const de = (await import('@/messages/de-DE.json')).default;
  const en = (await import('@/messages/en-US.json')).default;
  return { getTranslations: async (namespace: string) => createTranslator({ locale: document.documentElement.lang, messages: document.documentElement.lang === 'de-DE' ? de : en, namespace: namespace as 'errors' }) };
});
vi.mock('@/i18n/routing', async () => ({
  ...(await import('@/test/routing-mock')).mockRouting(),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import LocaleNotFound from '@/app/[locale]/not-found';
import LocaleError from '@/app/[locale]/error';
import RootNotFound from '@/app/not-found';

afterEach(() => vi.unstubAllGlobals());

describe.each(LOCALES)('a11y: error pages (%s)', (locale) => {
  it('not-found inside the store shell', async () => {
    stubShellFetch();
    document.documentElement.lang = locale;
    const page = await LocaleNotFound();
    renderStorePage(<>{page.props.children}</>, { locale, bare: false });
    expect(await axePage()).toHaveNoViolations();
  });

  it('error boundary with the retry button', async () => {
    stubShellFetch();
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={locale === 'de-DE' ? deDE : enUS}>
        <LocaleError error={new Error('x')} reset={() => undefined} />
      </NextIntlClientProvider>,
    );
    document.documentElement.lang = locale;
    document.title = 'Error';
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(await axePage()).toHaveNoViolations();
  });

  it('impersonation banner on (and the shell without it)', async () => {
    stubShellFetch();
    renderStorePage(<h1>Konto</h1>, { locale, banner: <ImpersonationBanner name="Anna S." store="mau-reseller-north" /> });
    expect(await axePage()).toHaveNoViolations();
  });
});

describe('a11y: root not-found', () => {
  it('has a heading and a main landmark', async () => {
    document.documentElement.lang = 'de-DE';
    document.title = 'Nicht gefunden';
    render(<RootNotFound />);
    expect(await axePage()).toHaveNoViolations();
  });
});
