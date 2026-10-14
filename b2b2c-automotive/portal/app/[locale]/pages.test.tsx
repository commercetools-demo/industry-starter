/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'next-intl';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const catalogs = { 'de-DE': de, 'en-US': en } as const;
const state = vi.hoisted(() => ({ locale: 'de-DE' }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getMessages: async () => catalogs[state.locale as keyof typeof catalogs],
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: state.locale, messages: catalogs[state.locale as keyof typeof catalogs], namespace: namespace as 'common' }),
}));

import LocaleError from './error';
import LocaleLayout from './layout';
import LocaleNotFound from './not-found';

const params = (locale: string) => Promise.resolve({ locale });

describe('locale layout', () => {
  it('Unsupported locale is not found', async () => {
    await expect(LocaleLayout({ children: null, params: params('fr-FR') })).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('Supported locale renders children', async () => {
    state.locale = 'en-US';
    const el = await LocaleLayout({ children: <p>child</p>, params: params('en-US') });
    expect(isValidElement(el)).toBe(true);
    renderWithProviders(el, { locale: 'en-US', messages: en });
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});

describe('error and not-found', () => {
  it('Error boundary offers retry', async () => {
    const reset = vi.fn();
    renderWithProviders(<LocaleError error={new Error('x')} reset={reset} />, { locale: 'en-US', messages: en });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
  it('Not-found page has a link home', () => {
    renderWithProviders(<LocaleNotFound />, { locale: 'de-DE', messages: de });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seite nicht gefunden');
    expect(screen.getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', '/de-DE');
  });
});
