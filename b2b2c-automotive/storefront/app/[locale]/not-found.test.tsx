// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import deDE from '@/messages/de-DE.json';
import { renderWithProviders } from '@/test/render';

vi.mock('next-intl/server', () => ({
  getTranslations: async (ns: string) => (key: string) => (deDE as Record<string, Record<string, string>>)[ns][key],
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/de-DE${href === '/' ? '' : href}`} {...rest}>
      {children}
    </a>
  ),
}));

import LocaleNotFound from './not-found';
import RootNotFound from '../not-found';

describe('Locale routing for two locales: not-found pages', () => {
  it('Not-found page has a link home', async () => {
    renderWithProviders(await LocaleNotFound(), { messages: deDE });
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', '/de-DE');
  });
  it('Root fallback shows German and English text', () => {
    renderWithProviders(<RootNotFound />);
    expect(screen.getByText('Seite nicht gefunden')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });
});
