import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { makeProduct } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import JournalPage from './page';

const mocks = vi.hoisted(() => ({ searchProducts: vi.fn() }));

vi.mock('@/lib/ct/search', () => ({ searchProducts: mocks.searchProducts }));
vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
vi.mock('@/hooks/useSaved', () => ({ useSaved: () => ({ isSaved: () => false, toggle: async () => {} }) }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace } as never),
}));
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const products = ['a', 'b', 'c', 'd'].map((id) => makeProduct({ id, name: `Product ${id}`, slug: `product-${id}` }));
const page = (locale: string) => JournalPage({ params: Promise.resolve({ locale }) });

beforeEach(() => {
  mocks.searchProducts.mockReset();
  mocks.searchProducts.mockResolvedValue({ products, total: 4, page: 1, pageSize: 4, facets: {} });
});

describe('Journal page', () => {
  it('editorial layout: title column beside the article body (1fr / 1.4fr)', async () => {
    renderWithProviders(await page('en-US'));
    const layout = screen.getByTestId('journal-layout');
    expect(layout.className).toContain('desktop:grid-cols-[1fr_1.4fr]');
    const column = within(layout).getByTestId('journal-title-column');
    expect(column.className).toContain('desktop:sticky');
    expect(within(column).getByRole('heading', { level: 1, name: 'The quiet table' })).toBeInTheDocument();
    expect(within(layout).getByRole('heading', { level: 2, name: 'Small decisions' })).toBeInTheDocument();
  });

  it('Shop the story: four newest products from the search call, market from the locale', async () => {
    renderWithProviders(await page('de-DE'), { locale: 'de-DE' });
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ sort: 'newest', pageSize: 4, currency: 'EUR', locale: 'de-DE' }));
    const section = screen.getByRole('region', { name: 'Die Geschichte shoppen' });
    expect(within(section).getAllByRole('article')).toHaveLength(4);
    expect(screen.getByRole('heading', { level: 1, name: 'Der stille Tisch' })).toBeInTheDocument();
  });

  it('search failure: the story still renders without the grid', async () => {
    mocks.searchProducts.mockRejectedValue(new Error('boom'));
    renderWithProviders(await page('en-US'));
    expect(screen.getByRole('heading', { level: 1, name: 'The quiet table' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Shop the story' })).not.toBeInTheDocument();
  });
});
