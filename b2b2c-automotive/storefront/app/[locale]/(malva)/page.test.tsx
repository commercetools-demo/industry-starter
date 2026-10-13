// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import deDE from '@/messages/de-DE.json';
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
  getTranslations: async ({ locale }: { locale: string }) => {
    const finder = (locale === 'de-DE' ? deDE : enUS).malva.finder;
    return (key: 'title' | 'intro') => finder[key];
  },
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
}));
const banners = vi.hoisted(() => vi.fn());
const categories = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/malva-banners', () => ({ getMalvaBanners: banners }));
vi.mock('@/lib/ct/malva-catalog', () => ({ getMalvaNavCategories: categories }));
vi.mock('@/components/malva/ResellerFinder', () => ({
  ResellerFinder: ({ mode, locale }: { mode: string; locale: string }) => <div data-testid="finder" data-mode={mode} data-locale={locale} />,
}));

import MalvaHome from './page';

const slide = { headline: 'Brakes for safe driving', subline: 'Pads', categorySlug: 'brakes' };
const tiles = [{ id: 'c1', slug: 'brakes', name: 'Brakes' }];

beforeEach(() => {
  banners.mockReset().mockResolvedValue([slide, { ...slide, headline: 'Filters' }, { ...slide, headline: 'Batteries' }]);
  categories.mockReset().mockResolvedValue(tiles);
});

const render = async (locale = 'en-US') =>
  renderWithProviders(await MalvaHome({ params: Promise.resolve({ locale }) }), { locale, messages: locale === 'de-DE' ? deDE : enUS });

describe('Malva home', () => {
  it('shows banner, the inline finder in the middle, then the category tiles, in that order', async () => {
    await render();
    const banner = screen.getByRole('region', { name: 'Featured offers' });
    const finder = screen.getByTestId('finder');
    const tilesHeading = screen.getByRole('heading', { name: 'Shop by category' });
    expect(banner.compareDocumentPosition(finder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(finder.compareDocumentPosition(tilesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(finder).toHaveAttribute('data-mode', 'inline');
    expect(finder).toHaveAttribute('data-locale', 'en-US');
    expect(screen.getByRole('heading', { name: 'Brakes for safe driving' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Find your reseller' })).toBeInTheDocument();
  });
  it('reads banners and categories for the locale', async () => {
    await render('de-DE');
    expect(banners).toHaveBeenCalledWith('de-DE');
    expect(categories).toHaveBeenCalledWith('de-DE');
    expect(screen.getByRole('heading', { level: 2, name: 'Händler finden' })).toBeInTheDocument();
  });
  it('no banner object: no carousel, the home still renders', async () => {
    banners.mockResolvedValue([]);
    await render();
    expect(screen.queryByRole('region', { name: 'Featured offers' })).toBeNull();
    expect(screen.getByTestId('finder')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop Brakes' })).toHaveAttribute('href', '/en-US/categories/brakes');
  });
  it('a read failure drops that block, not the page', async () => {
    banners.mockRejectedValue(new Error('down'));
    categories.mockRejectedValue(new Error('down'));
    await render();
    expect(screen.getByTestId('finder')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shop by category' })).toBeNull();
  });
  it('an unsupported locale is not found', async () => {
    await expect(MalvaHome({ params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
