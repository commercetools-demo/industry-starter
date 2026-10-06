import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { makeProduct } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import type { SearchResult } from '@/lib/types';
import SearchPage from './page';

const mocks = vi.hoisted(() => ({ searchProducts: vi.fn(), redirect: vi.fn() }));

vi.mock('@/lib/ct/search', () => ({ searchProducts: mocks.searchProducts, DEFAULT_PAGE_SIZE: 24 }));
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
  usePathname: () => '/search',
}));

function result(over: Partial<SearchResult> = {}): SearchResult {
  const products = over.products ?? [makeProduct({ id: 'a', name: 'Whole milk', slug: 'whole-milk' }), makeProduct({ id: 'b', name: 'Oat drink', slug: 'oat-drink' })];
  return {
    products,
    total: products.length,
    page: 1,
    pageSize: 24,
    facets: { categories: [], priceBands: [], availability: { inStock: 0, outOfStock: 0 } },
    ...over,
  };
}

const render = async (searchParams: Record<string, string | string[] | undefined> = {}, locale: 'en-US' | 'de-DE' = 'en-US') => {
  const ui = await SearchPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(searchParams) });
  return renderWithProviders(ui, { locale });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchProducts.mockResolvedValue(result());
  mocks.redirect.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
});

describe('SearchPage', () => {
  it('Empty search: heading, input and suggestion tags are shown and no search is made', async () => {
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Find it' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    for (const term of ['Fresh', 'Vegan', 'Bakery', 'Organic', 'Gifts', 'Under $5']) {
      expect(screen.getByRole('link', { name: term })).toHaveAttribute('href', `/en-US/search?q=${encodeURIComponent(term).replace(/%20/g, '+')}`);
    }
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });

  it('a blank query counts as empty', async () => {
    await render({ q: '   ' });
    expect(screen.getByRole('link', { name: 'Fresh' })).toBeInTheDocument();
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });

  it('Matching query / Shared link: the count line, the grid and no suggestions', async () => {
    await render({ q: 'milk' });
    expect(mocks.searchProducts).toHaveBeenCalledWith({ locale: 'en-US', currency: 'USD', country: 'US', text: 'milk', page: 1, pageSize: 24 });
    expect(screen.getByText('2 found for “milk”')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('milk');
    expect(screen.getByText('Whole milk')).toBeInTheDocument();
    expect(screen.getByText('Oat drink')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fresh' })).not.toBeInTheDocument();
  });

  it('No match: a message with a link to the shop', async () => {
    mocks.searchProducts.mockResolvedValue(result({ products: [], total: 0 }));
    await render({ q: 'zzzz' });
    expect(screen.getByRole('heading', { name: 'Nothing matched “zzzz”' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('page=2 searches page 2 and pagination keeps q', async () => {
    const products = Array.from({ length: 24 }, (_, i) => makeProduct({ id: `p${i}`, name: `Milk ${i}`, slug: `milk-${i}` }));
    mocks.searchProducts.mockResolvedValue(result({ products, total: 50, page: 2 }));
    await render({ q: 'milk', page: '2' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ text: 'milk', page: 2 }));
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByRole('link', { name: /Previous/ })).toHaveAttribute('href', '/en-US/search?q=milk');
    expect(within(nav).getByRole('link', { name: /Next/ })).toHaveAttribute('href', '/en-US/search?q=milk&page=3');
  });

  it('a page beyond the last redirects to the last page with q', async () => {
    mocks.searchProducts.mockResolvedValue(result({ total: 30, page: 9 }));
    await expect(render({ q: 'milk', page: '9' })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith({ href: '/search?q=milk&page=2', locale: 'en-US' });
  });

  it('q longer than 100 characters is truncated', async () => {
    await render({ q: 'a'.repeat(150) });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ text: 'a'.repeat(100) }));
    expect(screen.getByRole('searchbox')).toHaveValue('a'.repeat(100));
  });

  it('invalid page falls back to 1; the first of repeated q values is used', async () => {
    await render({ q: ['milk', 'tea'], page: 'abc' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ text: 'milk', page: 1 }));
  });

  it('de-DE: German copy, German suggestions and the EUR market', async () => {
    await render({}, 'de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Finden Sie es' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Backwaren' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unter 5 €' })).toBeInTheDocument();
    mocks.searchProducts.mockClear();
    await render({ q: 'milch' }, 'de-DE');
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ locale: 'de-DE', currency: 'EUR', country: 'DE', text: 'milch' }));
    expect(screen.getByText('2 gefunden für „milch“')).toBeInTheDocument();
  });
});
