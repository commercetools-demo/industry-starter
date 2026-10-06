import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { makeProduct, makeVariant } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import ProductPage, { generateMetadata } from './page';

const mocks = vi.hoisted(() => ({
  getProductBySlug: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('@/lib/ct/search', () => ({ getProductBySlug: mocks.getProductBySlug }));
vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
vi.mock('next/navigation', async (orig) => ({ ...(await orig<typeof import('next/navigation')>()), notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace } as never),
}));

const variant = (sku: string, centAmount: number, stock: boolean) =>
  makeVariant({ sku, price: { centAmount, currencyCode: 'USD' }, availability: { isOnStock: stock, availableQuantity: stock ? 5 : 0 } });

const bananas = () =>
  makeProduct({
    name: 'Bananas',
    description: 'x'.repeat(200),
    variants: [variant('B-500G', 149, false), variant('B-1KG', 249, true), variant('B-2KG', 449, true)],
  });

const render = async (searchParams: { sku?: string } = {}, slug = 'bananas', locale: 'en-US' | 'de-DE' = 'en-US') => {
  const ui = await ProductPage({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve(searchParams) });
  return renderWithProviders(ui, { locale });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProductBySlug.mockResolvedValue(bananas());
});

describe('ProductPage', () => {
  it('unknown slug: calls notFound', async () => {
    mocks.getProductBySlug.mockResolvedValue(null);
    await expect(render({}, 'nope')).rejects.toThrow('NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it('looks the product up with the URL locale market', async () => {
    await render({}, 'bananas-de', 'de-DE');
    expect(mocks.getProductBySlug).toHaveBeenCalledWith('bananas-de', { locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });

  it('default variant is the first in stock', async () => {
    await render();
    expect(screen.getByText('B-1KG')).toBeInTheDocument();
    expect(screen.getByText('$2.49')).toBeInTheDocument();
  });

  it('sku param selects that variant', async () => {
    await render({ sku: 'B-2KG' });
    expect(screen.getByText('B-2KG')).toBeInTheDocument();
    expect(screen.getByText('$4.49')).toBeInTheDocument();
  });

  it('an unknown sku falls back to the default variant', async () => {
    await render({ sku: 'nope' });
    expect(screen.getByText('B-1KG')).toBeInTheDocument();
  });

  it('Related click: another slug renders the other product', async () => {
    await render();
    mocks.getProductBySlug.mockResolvedValue(makeProduct({ name: 'Milk', variants: [variant('MILK', 199, true)] }));
    await render({}, 'milk');
    expect(screen.getByRole('heading', { name: 'Milk' })).toBeInTheDocument();
  });
});

describe('generateMetadata', () => {
  it('title is the product name and the brand; description is cut at 160 characters; image is the first one', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'bananas' }) });
    expect(metadata.title).toBe('Bananas · MALVA');
    expect(metadata.description).toHaveLength(160);
    expect(metadata.openGraph?.images).toEqual(['https://images.example.com/bananas.jpg']);
  });

  it('unknown product: no metadata (the page calls notFound)', async () => {
    mocks.getProductBySlug.mockResolvedValue(null);
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US', slug: 'nope' }) })).toEqual({});
  });
});
