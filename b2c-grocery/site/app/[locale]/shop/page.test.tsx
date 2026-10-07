import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { makeProduct } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import type { Category, SearchResult } from '@/lib/types';
import ShopPage, { generateMetadata } from './page';

const mocks = vi.hoisted(() => ({
  searchProducts: vi.fn(),
  getCategoryTree: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/lib/ct/search', () => ({ searchProducts: mocks.searchProducts, DEFAULT_PAGE_SIZE: 24 }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: mocks.getCategoryTree }));
vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
vi.mock('@/hooks/useSaved', () => ({ useSaved: () => ({ isSaved: () => false, toggle: async () => {} }) }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace } as never),
}));
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  redirect: mocks.redirect,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/shop',
}));

const tree: Category[] = [
  { id: 'c-bakery', key: 'bakery', name: 'Bakery', slug: 'bakery' },
  { id: 'c-drinks', key: 'drinks', name: 'Drinks', slug: 'drinks' },
];

function result(over: Partial<SearchResult> = {}): SearchResult {
  const products = over.products ?? [makeProduct({ id: 'a', name: 'Apples', slug: 'apples' }), makeProduct({ id: 'b', name: 'Pears', slug: 'pears' })];
  return {
    products,
    total: products.length,
    page: 1,
    pageSize: 24,
    facets: {
      categories: [{ id: 'c-bakery', count: 6 }],
      priceBands: [{ id: 'lt-500', count: 2 }],
      availability: { inStock: 2, outOfStock: 0 },
    },
    ...over,
  };
}

const render = async (searchParams: Record<string, string | string[] | undefined> = {}, locale: 'en-US' | 'de-DE' = 'en-US') => {
  const ui = await ShopPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(searchParams) });
  return renderWithProviders(ui, { locale });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchProducts.mockResolvedValue(result());
  mocks.getCategoryTree.mockResolvedValue(tree);
  mocks.redirect.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
});

describe('ShopPage', () => {
  it('Default listing: heading "Everything", rail, toolbar count and the grid render', async () => {
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Everything' })).toBeInTheDocument();
    expect(screen.getByText('The shop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Bakery\s*6$/ })).toBeInTheDocument();
    expect(screen.getByText('2 products')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Apples' })).toBeInTheDocument();
    expect(mocks.searchProducts).toHaveBeenCalledTimes(1);
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 24, currency: 'USD', country: 'US', locale: 'en-US', sort: 'relevance' }));
  });

  it('Tablet filters (1000 px): the rail only shows from the desktop breakpoint (1200 px) and the Filters button covers everything below', async () => {
    await render();
    const rail = screen.getByRole('button', { name: /^Bakery\s*6$/ }).closest('aside');
    expect(rail).toHaveClass('hidden', 'desktop:block');
    const sheetButton = screen.getByRole('button', { name: 'Filters' });
    expect(sheetButton.closest('.desktop\\:hidden')).not.toBeNull();
    expect(sheetButton.closest('aside')).toBeNull();
  });

  it('Parallel fetches: the category tree and the search both start before either resolves', async () => {
    let resolveTree: (value: Category[]) => void = () => {};
    let resolveSearch: (value: SearchResult) => void = () => {};
    mocks.getCategoryTree.mockReturnValue(new Promise((resolve) => (resolveTree = resolve)));
    mocks.searchProducts.mockReturnValue(new Promise((resolve) => (resolveSearch = resolve)));
    const pending = ShopPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({}) });
    await vi.waitFor(() => {
      expect(mocks.getCategoryTree).toHaveBeenCalled();
      expect(mocks.searchProducts).toHaveBeenCalled();
    });
    resolveTree(tree);
    resolveSearch(result());
    await expect(pending).resolves.toBeTruthy();
  });

  it('Unknown category is ignored: no category filter and the default heading', async () => {
    await render({ category: 'nope' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ categoryId: undefined }));
    expect(screen.getByRole('heading', { level: 1, name: 'Everything' })).toBeInTheDocument();
  });

  it('A known category filters by its id and names the heading and breadcrumbs', async () => {
    await render({ category: 'bakery' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'c-bakery' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Bakery' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Bakery')).toHaveAttribute('aria-current', 'page');
  });

  it('Page 2 passes page: 2, and the pagination keeps the other filters', async () => {
    mocks.searchProducts.mockResolvedValue(result({ total: 36, page: 2 }));
    await render({ page: '2', price: 'lt-500', sort: 'newest' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 2, priceBand: 'lt-500', sort: 'newest' }));
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/shop?price=lt-500&sort=newest');
  });

  it('Active filters map to the search: availability and an active filter chip', async () => {
    await render({ stock: 'out' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ availability: 'out-of-stock' }));
    expect(screen.getByRole('list', { name: 'Applied filters' })).toBeInTheDocument();
  });

  it('Invalid parameters are ignored, not errors', async () => {
    await render({ sort: 'cheapest', page: 'abc', stock: 'maybe' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ sort: 'relevance', page: 1, availability: undefined }));
  });

  it('No results: the empty state replaces the grid', async () => {
    mocks.searchProducts.mockResolvedValue(result({ products: [], total: 0 }));
    await render({ price: 'gt-3000' });
    expect(screen.getByRole('heading', { name: 'Nothing under those terms' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('A page beyond the last one redirects to the last page', async () => {
    mocks.searchProducts.mockResolvedValue(result({ total: 30, page: 9 }));
    await expect(ShopPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({ page: '9', category: 'bakery' }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith({ href: '/shop?category=bakery&page=2', locale: 'en-US' });
  });

  it('German locale: EUR and DE market, German copy', async () => {
    await render({}, 'de-DE');
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EUR', country: 'DE', locale: 'de-DE' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Alles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Unter 5,00\s€$/ })).toBeInTheDocument();
  });

  it('Counts reflect the other filters: a filtered facet group is loaded without its own filter', async () => {
    await render({ category: 'bakery', price: 'lt-500' });
    const calls = mocks.searchProducts.mock.calls.map(([p]) => p as { categoryId?: string; priceBand?: string; pageSize: number });
    expect(calls).toHaveLength(3);
    expect(calls.filter((p) => p.categoryId === 'c-bakery' && p.priceBand === 'lt-500' && p.pageSize === 24)).toHaveLength(1);
    expect(calls.filter((p) => p.categoryId === undefined && p.priceBand === 'lt-500' && p.pageSize === 1)).toHaveLength(1);
    expect(calls.filter((p) => p.categoryId === 'c-bakery' && p.priceBand === undefined && p.pageSize === 1)).toHaveLength(1);
  });
});

describe('generateMetadata', () => {
  it('uses the category name, else "Shop"', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({ category: 'drinks' }) })).toEqual({ title: 'Drinks' });
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({}) })).toEqual({ title: 'Shop' });
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'de-DE' }), searchParams: Promise.resolve({ category: 'x' }) })).toEqual({ title: 'Shop' });
  });
});
