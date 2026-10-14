// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MalvaListingView } from '@/lib/listing/malva-load';
import type { MalvaProductSummary } from '@/lib/malva-types';
import { parseListingParams } from '@/lib/search/params';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/categories/brakes',
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/malva/FinderDrawerProvider', () => ({ useFinderDrawer: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }) }));

import { MalvaListing } from './MalvaListing';

const item = (n: number, over: Partial<MalvaProductSummary> = {}): MalvaProductSummary => ({
  id: `p${n}`,
  sku: `SK-${n}`,
  partNumber: `SK-${n}`,
  name: `Pad ${n}`,
  slug: `pad-${n}`,
  brand: n % 2 ? 'Vektra' : 'Brem Co',
  imageAlt: `Pad ${n}`,
  universalFit: n === 1,
  fitmentKeys: [],
  ...over,
});

type Ok = Extract<MalvaListingView, { kind: 'ok' }>;
const view = (over: Omit<Partial<Ok>, 'result'> & { result?: Partial<Ok['result']>; query?: Record<string, string | string[]> } = {}): Ok => {
  const { result, query, ...rest } = over;
  return {
    kind: 'ok',
    category: { id: 'c', slug: 'brakes', name: 'Brakes', ancestors: [{ id: 'r', slug: 'chassis', name: 'Chassis' }] },
    params: parseListingParams(query ?? {}),
    result: { items: [item(1), item(2)], total: 2, page: 1, totalPages: 1, facets: [{ name: 'brand', buckets: [{ key: 'vektra', count: 1 }, { key: 'brem-co', count: 1 }] }], ...result },
    vehicle: null,
    fitScopeOn: false,
    ...rest,
  };
};

const renderListing = (v: Ok, locale: 'en-US' | 'de-DE' = 'en-US') => renderWithProviders(<MalvaListing view={v} slug="brakes" />, { locale, messages: locale === 'en-US' ? enUS : deDE });

describe('MalvaListing', () => {
  it('shows the title, count, breadcrumb to the Malva home, sort and one card per product', () => {
    renderListing(view());
    expect(screen.getByRole('heading', { level: 1, name: 'Brakes' })).toBeInTheDocument();
    expect(screen.getByText('2 parts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en-US/');
    expect(screen.getByRole('link', { name: 'Chassis' })).toHaveAttribute('href', '/en-US/categories/chassis');
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument();
    const grid = screen.getByRole('list', { name: 'Parts' });
    expect(within(grid).getAllByRole('button', { name: /Select a reseller/ })).toHaveLength(2);
    expect(screen.queryByText(/add to cart/i)).toBeNull();
  });

  it('has a brand filter in the address: add, keep the others, remove', () => {
    renderListing(view({ query: { brand: 'vektra' } }));
    const filter = screen.getByRole('navigation', { name: 'Brand' });
    expect(within(filter).getByRole('link', { name: /Vektra/ })).toHaveAttribute('aria-current', 'true');
    expect(within(filter).getByRole('link', { name: /Vektra/ })).toHaveAttribute('href', '/en-US/categories/brakes');
    expect(within(filter).getByRole('link', { name: /Brem Co/ })).toHaveAttribute('href', '/en-US/categories/brakes?brand=brem-co&brand=vektra');
  });

  it('has no brand filter without brands', () => {
    renderListing(view({ result: { facets: [] } }));
    expect(screen.queryByRole('navigation', { name: 'Brand' })).toBeNull();
  });

  it('shows pagination that keeps the brand filter', () => {
    renderListing(view({ query: { brand: 'vektra' }, result: { totalPages: 3, page: 1, total: 60 } }));
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '/en-US/categories/brakes?brand=vektra&page=2');
  });

  it('shows the empty state for a category without parts', () => {
    renderListing(view({ result: { items: [], total: 0, facets: [] } }));
    expect(screen.getByRole('heading', { name: 'No parts in this category' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Parts' })).toBeNull();
  });

  it('offers to show parts that do not fit when the fit scope emptied the list', () => {
    renderListing(view({ result: { items: [], total: 0, facets: [] }, vehicle: { make: 'VW', model: 'Golf', year: 2015, engine: '2.0' }, vehicleLabel: '2015 Golf', fitScopeOn: true }));
    expect(screen.getByText('Only parts that fit 2015 Golf are shown.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Show parts that do not fit' })).toHaveAttribute('href', '/en-US/categories/brakes?fit=0');
  });

  it('reads German and has no accessibility violations', async () => {
    const { container } = renderListing(view(), 'de-DE');
    expect(screen.getByText('2 Teile')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
