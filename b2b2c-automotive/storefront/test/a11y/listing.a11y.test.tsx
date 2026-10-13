// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y: page-level axe for the listing, category and search pages (with a vehicle, without results, search prompt, paginated).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseListingParams } from '@/lib/search/params';
import type { ListingResult, ListingView } from '@/lib/listing/load';
import { product } from '@/test/home';
import { axePage, LOCALES, renderStorePage, stubShellFetch, type Locale } from '@/test/a11y';

class NotFound extends Error {}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('NEXT_NOT_FOUND');
  },
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const de = (await import('@/messages/de-DE.json')).default;
  const en = (await import('@/messages/en-US.json')).default;
  return {
    setRequestLocale: () => {},
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
      createTranslator({ locale, messages: locale === 'de-DE' ? de : en, namespace: namespace as 'listing' }),
  };
});
vi.mock('@/i18n/routing', async () => ({
  ...(await import('@/test/routing-mock')).mockRouting(),
  redirect: () => {
    throw new Error('redirect');
  },
}));
const getListing = vi.hoisted(() => vi.fn());
vi.mock('@/lib/listing/load', () => ({ getListing }));
vi.mock('@/lib/listing/metadata', () => ({ basePathOf: (store: string, s: { kind: string; slug?: string }) => (s.kind === 'category' ? `/${store}/category/${s.slug}` : s.kind === 'search' ? `/${store}/search` : `/${store}/parts`) }));

import { ListingPage } from '@/components/listing/ListingPage';

const item = (id: string, fit: 'fits' | 'does-not-fit' | 'unknown') => ({ product: product({ id, sku: `SKU-${id}`, slug: `slug-${id}`, name: `Bremsbelag ${id}`, rating: id === 'a' ? { average: 4.5, count: 12 } : null }), fit });
const view = (over: Partial<ListingView> = {}, sp: Record<string, string> = {}): ListingView => ({
  kind: 'ok',
  surface: 'all',
  params: parseListingParams(sp),
  sort: 'popular',
  category: null,
  total: 3,
  page: 1,
  totalPages: 1,
  items: [item('a', 'fits'), item('b', 'does-not-fit'), item('c', 'unknown')],
  groups: [
    { name: 'brand', param: 'brand', title: 'brand', options: [{ key: 'vektra', label: 'Vektra', count: 3, selected: false }, { key: 'kestrel', label: 'Kestrel', count: 1, selected: false }] },
    { name: 'quality-tier', param: 'attr.quality-tier', title: 'quality-tier', options: [{ key: 'oem', label: 'OEM', count: 1, selected: false }, { key: 'premium', label: 'Premium', count: 2, selected: false }] },
  ],
  city: 'Hamburg',
  shipDays: { min: 2, max: 3 },
  pickupAvailable: true,
  fitScopeOn: false,
  ...over,
});

const CATEGORY = { id: 'c1', slug: 'brakes', name: 'Bremsen', ancestors: [{ id: 'root', slug: 'parts-root', name: 'Ersatzteile' }] };

async function show(result: ListingResult, locale: Locale, theme: 'default' | 'themed', surface = { kind: 'all' } as Parameters<typeof ListingPage>[0]['surface'], searchParams: Record<string, string> = {}) {
  getListing.mockResolvedValue(result);
  const element = await ListingPage({ locale, store: 'mau-reseller-north', surface, searchParams });
  stubShellFetch();
  renderStorePage(<>{element}</>, { locale, theme });
}

beforeEach(() => getListing.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe.each(LOCALES)('a11y: listing pages (%s)', (locale) => {
  it.each(['default', 'themed'] as const)('category listing with a vehicle (fit filter on), %s theme', async (theme) => {
    await show(view({ category: CATEGORY, surface: 'category', fitScopeOn: true, vehicleLabel: '2016 Volkswagen Golf', params: parseListingParams({ brand: 'vektra' }), groups: view().groups.map((g) => (g.name === 'brand' ? { ...g, options: g.options.map((o) => ({ ...o, selected: o.key === 'vektra' })) } : g)) }, { brand: 'vektra' }), locale, theme, { kind: 'category', slug: 'brakes' }, { brand: 'vektra' });
    expect(await axePage()).toHaveNoViolations();
  });

  it('listing with pagination', async () => {
    await show(view({ total: 90, totalPages: 4, page: 2 }, { page: '2' }), locale, 'default');
    expect(await axePage()).toHaveNoViolations();
  });

  it('zero results with the fit-only hint', async () => {
    await show(view({ items: [], total: 0, fitScopeOn: true, vehicleLabel: '2016 Volkswagen Golf' }), locale, 'default');
    expect(await axePage()).toHaveNoViolations();
  });

  it('search results', async () => {
    await show(view({ surface: 'search', sort: 'relevance', params: parseListingParams({ q: 'bremse' }) }, { q: 'bremse' }), locale, 'default', { kind: 'search' }, { q: 'bremse' });
    expect(await axePage()).toHaveNoViolations();
  });

  it('empty search prompt', async () => {
    await show({ kind: 'prompt', params: parseListingParams({}) }, locale, 'default', { kind: 'search' });
    expect(await axePage()).toHaveNoViolations();
  });

  it('has one h1', async () => {
    await show(view(), locale, 'default');
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });
});
