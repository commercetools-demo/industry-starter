import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import { CLOSED_ALL_WEEK } from '@/lib/hours';
import type { ListingView } from '@/lib/listing/load';
import { parseListingParams } from '@/lib/search/params';
import type { FacetGroup, ProductSummary, Store } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { nav, renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  default: ({ src, alt, priority, fetchPriority }: { src: string; alt: string; priority?: boolean; fetchPriority?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-priority={priority ? 'true' : undefined} data-fetchpriority={fetchPriority} />
  ),
}));

import ListingPage from '@/components/listing/ListingPage';
import { pageWindow } from '@/components/listing/Pagination';

const store: Store = {
  id: 's1', key: 'mcf-store-nyc-soho', name: 'Malva SoHo', addressLine: '1 Main St', city: 'New York', postalCode: '10001',
  country: 'US', hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 15,
};
const fb = (selectedKey: string | null, country = 'US') => ({
  [unstable_serialize(keyChannels(country))]: { stores: country === 'US' ? [store] : [], selectedKey },
});
const product = (n: number, over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: `p-${n}`, slug: `product-${n}`, sku: `SKU-${n}`, name: `Product ${n}`, categoryName: 'Pods', imageAlt: `Product ${n}`, badge: null,
  price: { from: { centAmount: 490 + n, currencyCode: 'USD' }, fromIsRange: false }, requiredChoice: null, rating: null, availability: null, ...over,
});
const roastGroup: FacetGroup = {
  name: 'roast', label: 'Roast', control: 'checkbox', selectedCount: 0,
  options: [{ value: 'dark', label: 'Dark', count: 3, selected: false, href: '/shop?f_roast=dark' }],
};
function view(over: Partial<ListingView> = {}): ListingView {
  return {
    kind: 'ok', scope: 'shop', params: parseListingParams({}, 'shop'), basePath: '/shop',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'All products' }],
    items: [product(1), product(2)], total: 2, page: 1, pageCount: 1, groups: [roastGroup], facetsFailed: false, store: null,
    chips: [], clearAllHref: '/shop', sortOptions: [{ value: 'featured', label: 'Featured', href: '/shop' }], availHref: '/shop?avail=1',
    otherParams: '', apiScope: 'shop', activeCount: 0, ...over,
  };
}

beforeEach(() => {
  nav.push.mockReset();
  stubFetch({ '/api/channels': () => ({ stores: [store], selectedKey: null }), '/api/cart/count': () => ({ count: 0 }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('ListingPage', () => {
  it('renders header, sidebar, toolbar and a card grid for All products', () => {
    renderShell(<ListingPage result={view()} />, { fallback: fb(null) });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All products');
    expect(screen.getByText('2 products')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(document.querySelector('main')).toBeNull();
  });

  it('The first card image is the one the page waits for: it loads at once, the others stay lazy (LCP, perf.md)', () => {
    renderShell(<ListingPage result={view({ items: [1, 2, 3].map((n) => product(n, { imageUrl: `https://img.example/p-${n}.jpg` })) })} />, { fallback: fb(null) });
    const images = screen.getAllByTestId('product-grid')[0]!.querySelectorAll('img');
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute('data-priority', 'true');
    expect(images[0]).toHaveAttribute('data-fetchpriority', 'high');
    expect(images[1]).not.toHaveAttribute('data-fetchpriority');
    expect(images[1]).not.toHaveAttribute('data-priority');
    expect(images[2]).not.toHaveAttribute('data-priority');
  });

  it('B2C only: a card grid, no variant table or pack selector', () => {
    renderShell(<ListingPage result={view()} />, { fallback: fb(null) });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/pack size|trade|case of/i)).toBeNull();
  });

  it('Facet combination with no matches keeps removable chips and a clear button', () => {
    const r = view({
      items: [], total: 0, activeCount: 2,
      chips: [{ key: 'roast:dark', label: 'Dark', href: '/shop?f_decaf=true' }, { key: 'decaf:true', label: 'Decaf', href: '/shop?f_roast=dark' }],
      clearAllHref: '/shop',
    });
    renderShell(<ListingPage result={r} />, { fallback: fb(null) });
    expect(screen.getByText('No products match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remove filter Dark' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear all filters' })).toHaveAttribute('href', '/shop');
    expect(screen.queryByTestId('product-grid')).toBeNull();
  });

  it('No price for this buyer card states it', () => {
    renderShell(<ListingPage result={view({ items: [product(1, { price: null })] })} />, { fallback: fb(null) });
    expect(screen.getByText('No price available')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add')).toBeDisabled();
  });

  it('Query matches nothing keeps the query editable and shows fallback content', () => {
    const r = view({
      scope: 'search', params: parseListingParams({ q: 'zzzzqq' }, 'search'), basePath: '/search', items: [], total: 0,
      crumbs: [{ label: 'Home', href: '/' }, { label: 'Search' }],
      noResults: { categories: [{ name: 'Pods', href: '/category/pods' }, { name: 'Coffee', href: '/category/coffee' }], bestsellers: [product(9)] },
    });
    renderShell(<ListingPage result={r} />, { fallback: fb(null) });
    expect(screen.getByText(/We couldn.t find anything for "zzzzqq"/)).toBeInTheDocument();
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('zzzzqq');
    expect(input).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Pods' })).toHaveAttribute('href', '/category/pods');
    expect(screen.getAllByTestId('product-card')).toHaveLength(1);
    expect(screen.getByText(/Typo-tolerant matching was already applied/)).toBeInTheDocument();
    expect(screen.queryByText(/did you mean/i)).toBeNull();
  });

  it('search results name the query and show the matched SKU', () => {
    const r = view({
      scope: 'search', params: parseListingParams({ q: 'SKU-1' }, 'search'), basePath: '/search',
      items: [product(1, { matchedSku: 'SKU-1' })], total: 1, crumbs: [{ label: 'Home', href: '/' }, { label: 'Search' }],
    });
    renderShell(<ListingPage result={r} />, { fallback: fb(null) });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for "SKU-1"');
    expect(screen.getByText('Matched SKU SKU-1')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).not.toHaveFocus();
  });

  it('empty q shows the prompt', () => {
    const r = { kind: 'prompt' as const, scope: 'search' as const, params: parseListingParams({}, 'search'), basePath: '/search', crumbs: [{ label: 'Home', href: '/' }, { label: 'Search' }] };
    renderShell(<ListingPage result={r} />, { fallback: fb(null) });
    expect(screen.getByText('Enter a coffee, a machine or a product code')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('Unsupported language reports it', () => {
    renderShell(<ListingPage result={{ kind: 'unsupported_language' }} />, { fallback: fb(null) });
    expect(screen.getByRole('alert')).toHaveTextContent('Browsing is not available in this language yet.');
  });

  it('Pagination keeps filters and marks the current page', () => {
    const params = parseListingParams({ f_roast: 'dark', page: '2' }, 'shop');
    renderShell(<ListingPage result={view({ params, page: 2, pageCount: 3, total: 60 })} />, { fallback: fb(null) });
    const nav2 = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav2).getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav2).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/shop?f_roast=dark&page=3');
    expect(within(nav2).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/shop?f_roast=dark');
  });

  it('pageWindow shows first, last and two each side with gaps', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(10, 20)).toEqual([1, 0, 8, 9, 10, 11, 12, 0, 20]);
  });

  it('facet-only failure shows an unobtrusive line and the grid', () => {
    renderShell(<ListingPage result={view({ facetsFailed: true, groups: [] })} />, { fallback: fb(null) });
    expect(screen.getByText('Filters are unavailable right now.')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
  });

  it('Canada listing has no availability controls', () => {
    stubFetch({ '/api/channels': () => ({ stores: [], selectedKey: null }) });
    renderShell(<ListingPage result={view()} />, { locale: 'en-CA', fallback: fb(null, 'CA') });
    expect(screen.queryByRole('button', { name: /Available at/ })).toBeNull();
    expect(screen.queryByText('Choose a store')).toBeNull();
  });

  it('no axe violations', async () => {
    const { container } = renderShell(<ListingPage result={view()} />, { fallback: fb(null) });
    await expectNoAxeViolations(container);
  });
});
