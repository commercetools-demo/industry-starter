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
import LocaleRoot from './page';
import StorePlaceholder from './[store]/page';

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
  it('No store segment is not found', () => {
    expect(() => LocaleRoot()).toThrow('NEXT_NOT_FOUND');
  });
  it('Placeholder renders the store in English', async () => {
    const el = await StorePlaceholder({ params: Promise.resolve({ locale: 'en-US', store: 'hartmann' }) });
    renderWithProviders(el, { locale: 'en-US' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The hartmann shop is being built here.');
  });
});
