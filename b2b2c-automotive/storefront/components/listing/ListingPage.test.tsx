// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseListingParams } from '@/lib/search/params';
import type { ListingResult, ListingView } from '@/lib/listing/load';
import type { ProductSummary } from '@/lib/types';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

class NotFound extends Error {}
class Redirected extends Error {
  constructor(public href: string) {
    super('NEXT_REDIRECT');
  }
}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const messages = (await import('@/messages/en-US.json')).default;
  return { setRequestLocale: () => {}, getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => createTranslator({ locale, messages, namespace: namespace as 'listing' }) };
});
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  redirect: ({ href }: { href: string }) => {
    throw new Redirected(href);
  },
}));
const getListing = vi.hoisted(() => vi.fn());
vi.mock('@/lib/listing/load', () => ({ getListing }));
vi.mock('@/lib/listing/metadata', () => ({ basePathOf: (store: string, s: { kind: string; slug?: string }) => (s.kind === 'category' ? `/${store}/category/${s.slug}` : s.kind === 'search' ? `/${store}/search` : `/${store}/parts`) }));
vi.mock('@/components/vehicle/GarageBar', () => ({ GarageBar: () => <div data-testid="garage-bar" /> }));
vi.mock('@/components/listing/SortSelect', () => ({ SortSelect: ({ value }: { value: string }) => <div data-testid="sort" data-value={value} /> }));
vi.mock('@/components/listing/FilterPanel', () => ({
  FilterPanel: ({ groups }: { groups: { title: string; options: { label: string }[] }[] }) => (
    <aside data-testid="filter-panel">{groups.map((g) => `${g.title}: ${g.options.map((o) => o.label).join(',')}`).join(' | ')}</aside>
  ),
  FilterSheet: () => <button type="button">Filters</button>,
}));
vi.mock('@/components/listing/ProductCard', () => ({
  ProductCard: ({ product, fit, alternativesHref }: { product: ProductSummary; fit: string; alternativesHref: string }) => (
    <article data-testid="card" data-fit={fit} data-alt={alternativesHref}>
      {product.name}
    </article>
  ),
}));

import { ListingPage, type ListingPageProps } from './ListingPage';

const product = (id: string): ProductSummary => ({ id, sku: `SKU-${id}`, slug: `slug-${id}`, name: `Part ${id}`, brand: 'Vektra', imageAlt: id, rating: null, price: null, stock: { atBranch: false, quantity: 0 }, universalFit: false, fitmentKeys: [], recurringEligible: false, variantCount: 1 });
const view = (over: Partial<ListingView> = {}, sp: Record<string, string | string[]> = {}): ListingView => ({
  kind: 'ok',
  surface: 'all',
  params: parseListingParams(sp),
  sort: 'popular',
  category: null,
  total: 2,
  page: 1,
  totalPages: 1,
  items: [{ product: product('a'), fit: 'fits' }, { product: product('b'), fit: 'does-not-fit' }],
  groups: [{ name: 'brand', param: 'brand', title: 'brand', options: [{ key: 'vektra', label: 'Vektra', count: 2, selected: false }] }, { name: 'quality-tier', param: 'attr.quality-tier', title: 'quality-tier', options: [{ key: 'oem', label: 'Original equipment (OEM) raw', count: 1, selected: false }, { key: 'premium', label: 'Premium raw', count: 1, selected: false }] }],
  city: 'Hamburg',
  shipDays: { min: 2, max: 3 },
  pickupAvailable: true,
  fitScopeOn: false,
  ...over,
});
const props = (over: Partial<ListingPageProps> = {}): ListingPageProps => ({ locale: 'en-US', store: 'mau-reseller-north', surface: { kind: 'all' }, searchParams: {}, ...over });
const render = async (result: ListingResult, p: Partial<ListingPageProps> = {}) => {
  getListing.mockResolvedValue(result);
  const element = await ListingPage(props(p));
  return renderWithProviders(<>{element}</>, { locale: 'en-US', messages: enUS });
};

beforeEach(() => {
  getListing.mockReset();
});

describe('Listing page assembly: components/listing/ListingPage', () => {
  it('renders title, count line, sort, garage bar and the cards with their fit state', async () => {
    await render(view());
    expect(screen.getByRole('heading', { level: 1, name: 'All parts' })).toBeInTheDocument();
    expect(screen.getByText('2 parts · prices and stock for Hamburg')).toBeInTheDocument();
    expect(screen.getByTestId('sort')).toHaveAttribute('data-value', 'popular');
    expect(screen.getByTestId('garage-bar')).toBeInTheDocument();
    const cards = screen.getAllByTestId('card');
    expect(cards.map((c) => c.getAttribute('data-fit'))).toEqual(['fits', 'does-not-fit']);
    expect(screen.getByRole('list', { name: 'Parts' })).toBeInTheDocument();
  });

  it('translates the group titles and the closed lists, keeps brand labels', async () => {
    await render(view());
    expect(screen.getByTestId('filter-panel')).toHaveTextContent('Brand: Vektra | Quality: Original equipment (OEM),Premium aftermarket');
  });

  it('no matches shows the empty state and chips', async () => {
    await render(view({ items: [], total: 0, groups: [{ name: 'brand', param: 'brand', title: 'brand', options: [{ key: 'kestrel', label: 'Kestrel', count: 0, selected: true }] }] }, { brand: 'kestrel', sort: 'rated' }));
    const empty = screen.getByText('No parts match these filters');
    expect(empty.closest('div')).toHaveClass('border-dashed');
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    const chip = screen.getByRole('link', { name: 'Remove filter Kestrel' });
    const url = new URL(chip.getAttribute('href') as string, 'http://x');
    expect(url.pathname).toBe('/en-US/mau-reseller-north/parts');
    expect(url.searchParams.has('brand')).toBe(false);
    expect(url.searchParams.get('sort')).toBe('rated');
    expect(screen.getByRole('link', { name: 'Clear all' })).toBeInTheDocument();
  });

  it('an empty fit-only result offers the parts that do not fit', async () => {
    await render(view({ items: [], total: 0, fitScopeOn: true, vehicleLabel: '2016 Volkswagen Golf · 2.0 TDI' }));
    expect(screen.getByText('Only parts that fit 2016 Volkswagen Golf · 2.0 TDI are shown.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Show parts that do not fit' });
    expect(new URL(link.getAttribute('href') as string, 'http://x').searchParams.get('fit')).toBe('0');
  });

  it('search with q sets the title', async () => {
    await render(view({ surface: 'search', sort: 'relevance' }, { q: 'MLV-BP-41001' }), { surface: { kind: 'search' }, searchParams: { q: 'MLV-BP-41001' } });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for "MLV-BP-41001"');
    expect(screen.getByTestId('sort')).toHaveAttribute('data-value', 'relevance');
  });

  it('part number search keeps the exact part first with its badge', async () => {
    await render(view({ items: [{ product: product('exact'), fit: 'does-not-fit' }, { product: product('other'), fit: 'fits' }], surface: 'search' }, { q: 'MLV-BP-41005' }), { surface: { kind: 'search' } });
    const cards = screen.getAllByTestId('card');
    expect(cards[0]).toHaveTextContent('Part exact');
    expect(cards[0]).toHaveAttribute('data-fit', 'does-not-fit');
  });

  it('an empty search shows the prompt and no results', async () => {
    await render({ kind: 'prompt', params: parseListingParams({}) }, { surface: { kind: 'search' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Enter a part name, number or brand' })).toBeInTheDocument();
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
  });

  it('category page has the breadcrumb of its ancestors and the category name as title', async () => {
    const category = { id: 'c-pads', slug: 'pads', name: 'Brake pads', ancestors: [{ id: 'c-brakes', slug: 'brakes', name: 'Brakes' }] };
    await render(view({ surface: 'category', category }), { surface: { kind: 'category', slug: 'pads' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Brake pads' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Brakes' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
  });

  it('the alternatives link drops fit, keeps the filters and the category', async () => {
    await render(view({ surface: 'category', category: { id: 'c', slug: 'pads', name: 'Pads', ancestors: [] } }, { fit: '0', brand: 'vektra', page: '2' }), { surface: { kind: 'category', slug: 'pads' } });
    const alt = screen.getAllByTestId('card')[0].getAttribute('data-alt') as string;
    expect(alt).toBe('/mau-reseller-north/category/pads?brand=vektra');
  });

  it('shows pagination links for several pages', async () => {
    await render(view({ total: 60, totalPages: 3, page: 1 }));
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en-US/mau-reseller-north/parts?page=2');
  });

  it('unknown category 404', async () => {
    getListing.mockResolvedValue({ kind: 'not-found' });
    await expect(ListingPage(props({ surface: { kind: 'category', slug: 'nope' } }))).rejects.toBeInstanceOf(NotFound);
  });

  it('a page beyond the last redirects to the last page', async () => {
    getListing.mockResolvedValue({ kind: 'redirect', page: 3, params: parseListingParams({ page: '99', brand: 'vektra' }) });
    await expect(ListingPage(props())).rejects.toMatchObject({ href: '/mau-reseller-north/parts?brand=vektra&page=3' });
  });
});
