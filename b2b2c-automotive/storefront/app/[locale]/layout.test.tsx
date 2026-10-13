// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getMessages: async () => ({}),
  getTranslations: async (ns: string) => (key: string, values?: Record<string, string>) => {
    const text = (enUS as unknown as Record<string, Record<string, string>>)[ns][key];
    return values ? text.replace('{store}', values.store) : text;
  },
}));

import LocaleLayout from './layout';
import MalvaHome from './(malva)/page';
import StoreNotFound from './store-not-found/page';

describe('Locale routing for two locales: locale layout', () => {
  it('Unsupported locale is not found', async () => {
    await expect(LocaleLayout({ children: null, params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
  it('Supported locale renders children', async () => {
    const el = await LocaleLayout({ children: <p>child</p>, params: Promise.resolve({ locale: 'de-DE' }) });
    renderWithProviders(el);
    expect(screen.getByText('child')).toBeInTheDocument();
  });
  it('No store segment is the Malva home', async () => {
    const el = await MalvaHome({ params: Promise.resolve({ locale: 'de-DE' }) });
    renderWithProviders(el);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
  it('The Malva home of an unsupported locale is not found', async () => {
    await expect(MalvaHome({ params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('An unknown store is rewritten to a page that is not found', () => {
    expect(() => StoreNotFound()).toThrow('NEXT_NOT_FOUND');
  });
  // The store home page is app/[locale]/[store]/page.test.tsx; the Malva layout and pages are in app/[locale]/(malva).
});
