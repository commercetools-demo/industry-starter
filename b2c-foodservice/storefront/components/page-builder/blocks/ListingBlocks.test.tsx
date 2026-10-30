import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import type { ListingView } from '@/lib/listing/load';
import { parseListingParams } from '@/lib/search/params';
import type { FacetGroup, ProductSummary } from '@/lib/types';
import { nav, renderShell, stubFetch } from '@/test/shell';

const m = vi.hoisted(() => ({ view: null as unknown }));
vi.mock('@/lib/listing/request-listing', () => ({ requestListing: async () => m.view }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => (k === 'results' ? 'Results' : k) }));
vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import {
  ActiveFiltersBlock, BreadcrumbsBlock, FacetsBlock, PaginationBlock, ProductGridBlock, ResultHeaderBlock, SortBlock,
} from '@/components/page-builder/blocks/ListingBlocks';

const product = (n: number, over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: `p-${n}`, slug: `product-${n}`, sku: `SKU-${n}`, name: `Product ${n}`, categoryName: 'Pods', imageAlt: `Product ${n}`, badge: null,
  price: { from: { centAmount: 490 + n, currencyCode: 'USD' }, fromIsRange: false }, requiredChoice: null, rating: null, availability: null,
  swatches: [{ key: 'red', name: 'Red' }], ...over,
});
const roast: FacetGroup = {
  name: 'roast', label: 'Roast', control: 'checkbox', selectedCount: 0,
  options: [{ value: 'dark', label: 'Dark', count: 3, selected: false, href: '/category/pods?f_roast=dark' }],
};
function view(over: Partial<ListingView> = {}): ListingView {
  return {
    kind: 'ok', scope: 'category', params: parseListingParams({}, 'category'), basePath: '/category/pods',
    category: { id: 'c1', key: 'mcf-cat-pods', slug: 'pods', name: 'Pods' } as ListingView['category'],
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Pods' }], items: [product(1), product(2)], total: 2, page: 1, pageCount: 3,
    groups: [roast], facetsFailed: false, store: null,
    chips: [{ key: 'roast:dark', label: 'Dark', href: '/category/pods' }], clearAllHref: '/category/pods',
    sortOptions: [{ value: 'featured', label: 'Featured', href: '/category/pods' }, { value: 'price-asc', label: 'Price: low to high', href: '/category/pods?sort=price-asc' }],
    availHref: '/category/pods?avail=1', otherParams: '', apiScope: 'category:pods', activeCount: 1, ...over,
  };
}
const fallback = { [unstable_serialize(keyChannels('US'))]: { stores: [], selectedKey: null } };
const draw = async (ui: Promise<React.ReactNode>) => renderShell(<>{await ui}</>, { fallback });
const empty = (c: HTMLElement) => expect(c.querySelector('h1, h2, ul, nav, aside, select, button, article')).toBeNull();

beforeEach(() => {
  nav.push.mockReset();
  m.view = view();
  stubFetch({ '/api/channels': () => ({ stores: [], selectedKey: null }), '/api/cart/count': () => ({ count: 0 }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('each listing component alone', () => {
  it('result header: breadcrumbs, the category name as h1 and the count', async () => {
    await draw(ResultHeaderBlock());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pods');
    expect(screen.getByText('2 products')).toBeInTheDocument();
  });

  it('breadcrumbs: just the trail', async () => {
    await draw(BreadcrumbsBlock());
    expect(screen.getByRole('navigation')).toHaveTextContent('Pods');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('filters: the sidebar and the Filters button of the sheet', async () => {
    await draw(FacetsBlock());
    expect(screen.getByRole('complementary', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Filters/ }).length).toBeGreaterThan(0);
  });

  it('sort: the native select with the native options', async () => {
    await draw(SortBlock());
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Price: low to high' })).toBeInTheDocument();
  });

  it('active filters: a chip per selected value and clear all', async () => {
    await draw(ActiveFiltersBlock());
    expect(screen.getByRole('link', { name: /Dark/ })).toHaveAttribute('href', '/category/pods');
  });

  it('pagination: native page links', async () => {
    await draw(PaginationBlock());
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('pagination: nothing when there are no results', async () => {
    m.view = view({ items: [], total: 0, pageCount: 0 });
    const { container } = await draw(PaginationBlock());
    empty(container);
  });

  it('grid: a native product card per product', async () => {
    await draw(ProductGridBlock({ data: {} }));
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Results' })).toHaveClass('sr-only');
  });

  it('grid: the native empty state when nothing matches', async () => {
    m.view = view({ items: [], total: 0 });
    await draw(ProductGridBlock({ data: {} }));
    expect(screen.queryByTestId('product-card')).toBeNull();
    expect(screen.getByRole('link', { name: /clear/i })).toBeInTheDocument();
  });
});

describe('grid settings', () => {
  it.each([[2, 'grid3:grid-cols-2'], ['3', 'grid3:grid-cols-3'], [4, 'grid3:grid-cols-4']])('items per row %s', async (value, cls) => {
    await draw(ProductGridBlock({ data: { itemsPerRow: value } }));
    expect(screen.getByTestId('product-grid').className).toContain(cls);
  });
  it('an unsupported value uses four', async () => {
    await draw(ProductGridBlock({ data: { itemsPerRow: '9' } }));
    expect(screen.getByTestId('product-grid').className).toContain('grid3:grid-cols-4');
  });
  it('price hidden: no tile shows a price', async () => {
    await draw(ProductGridBlock({ data: { showPrice: false } }));
    for (const card of screen.getAllByTestId('product-card')) expect(card).not.toHaveTextContent('$');
  });
  it('price shown by default', async () => {
    await draw(ProductGridBlock({ data: {} }));
    expect(screen.getAllByTestId('product-card')[0]).toHaveTextContent('$4.91');
  });
  it('swatches: shown by default, hidden when off', async () => {
    const { container, unmount } = await draw(ProductGridBlock({ data: {} }));
    const withSwatches = container.querySelectorAll('[aria-label*="Red"], [title*="Red"]').length;
    expect(withSwatches).toBeGreaterThan(0);
    unmount();
    const off = await draw(ProductGridBlock({ data: { showSwatches: false } }));
    expect(off.container.querySelectorAll('[aria-label*="Red"], [title*="Red"]').length).toBe(0);
  });
});

describe('combinations and absent data', () => {
  it('a grid without filters, sort or pagination renders on its own', async () => {
    await draw(ProductGridBlock({ data: {} }));
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('filters without a grid render on their own', async () => {
    await draw(FacetsBlock());
    expect(screen.queryByTestId('product-card')).toBeNull();
  });

  it('every component renders nothing when there is no listing (not a category page, redirect or prompt)', async () => {
    m.view = null;
    for (const ui of [ResultHeaderBlock(), BreadcrumbsBlock(), FacetsBlock(), SortBlock(), ActiveFiltersBlock(), PaginationBlock(), ProductGridBlock({ data: {} })]) {
      const { container, unmount } = await draw(ui);
      empty(container);
      unmount();
    }
  });
});
