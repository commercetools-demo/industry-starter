import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { renderWithCart } from '@/test/cart';
import { makeProduct, makeVariant } from '@/test/product';
import type { Category } from '@/lib/types';
import ProductPage, { generateMetadata } from './page';

const mocks = vi.hoisted(() => ({
  getProductBySlug: vi.fn(),
  searchProducts: vi.fn(),
  getCategoryTree: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('@/lib/ct/search', () => ({ getProductBySlug: mocks.getProductBySlug, searchProducts: mocks.searchProducts }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: mocks.getCategoryTree }));
vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
vi.mock('next/navigation', async (orig) => ({ ...(await orig<typeof import('next/navigation')>()), notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace } as never),
}));
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/p/bananas',
}));

const tree: Category[] = [{ id: 'c-fruit', key: 'fruit', name: 'Fruit', slug: 'fruit' }];

const variant = (sku: string, centAmount: number, stock: boolean, label: string, value: number) =>
  makeVariant({
    sku,
    price: { centAmount, currencyCode: 'USD' },
    attributes: { packLabel: label, incrementValue: value },
    increment: { value, unit: 'g', label },
    availability: { isOnStock: stock, availableQuantity: stock ? 5 : 0 },
  });

const bananas = () =>
  makeProduct({
    id: 'p-bananas',
    name: 'Bananas',
    description: 'x'.repeat(200),
    categoryIds: ['c-fruit'],
    variants: [variant('B-500G', 149, false, '500 g', 500), variant('B-1KG', 249, true, '1 kg', 1000), variant('B-2KG', 449, true, '2 kg', 2000)],
  });

const render = async (searchParams: { sku?: string } = {}, slug = 'bananas', locale: 'en-US' | 'de-DE' = 'en-US') => {
  const ui = await ProductPage({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve(searchParams) });
  return renderWithCart(ui, { locale });
};

const buyBox = () => screen.getByRole('heading', { level: 1 }).closest('.desktop\\:sticky') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ cart: null }), { status: 200 })));
  mocks.getProductBySlug.mockResolvedValue(bananas());
  mocks.getCategoryTree.mockResolvedValue(tree);
  mocks.searchProducts.mockResolvedValue({
    products: [bananas(), ...['Apples', 'Pears', 'Plums', 'Kiwis', 'Limes'].map((name) => makeProduct({ id: name, name, slug: name.toLowerCase() }))],
    total: 6,
    page: 1,
    pageSize: 5,
    facets: { categories: [], priceBands: [], availability: { inStock: 0, outOfStock: 0 } },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('ProductPage', () => {
  it('unknown slug: calls notFound', async () => {
    mocks.getProductBySlug.mockResolvedValue(null);
    await expect(render({}, 'nope')).rejects.toThrow('NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalled();
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });

  it('looks the product up with the URL locale market', async () => {
    mocks.getProductBySlug.mockResolvedValue({ ...bananas(), slug: 'bananas-de' });
    await render({}, 'bananas-de', 'de-DE');
    expect(mocks.getProductBySlug).toHaveBeenCalledWith('bananas-de', { locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });

  it("a slug from another locale redirects to this locale's canonical slug, keeping ?sku", async () => {
    mocks.getProductBySlug.mockResolvedValue({ ...bananas(), slug: 'bananas-de' });
    await expect(render({ sku: 'BANANAS-1KG' }, 'bananas', 'de-DE')).rejects.toThrow('NEXT_REDIRECT');
  });

  it('default variant is the first in stock', async () => {
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Bananas' })).toBeInTheDocument();
    expect(screen.getByText('B-1KG')).toBeInTheDocument();
    expect(within(buyBox()).getByText('$2.49')).toBeInTheDocument();
    expect(screen.getByLabelText('1 kg')).toBeChecked();
  });

  it('sku param selects that variant', async () => {
    await render({ sku: 'B-2KG' });
    expect(screen.getByText('B-2KG')).toBeInTheDocument();
    expect(within(buyBox()).getByText('$4.49')).toBeInTheDocument();
    expect(screen.getByLabelText('2 kg')).toBeChecked();
  });

  it('an unknown sku falls back to the default variant', async () => {
    await render({ sku: 'nope' });
    expect(screen.getByText('B-1KG')).toBeInTheDocument();
  });

  it('Out of stock variant: availability says so and add to bag is disabled', async () => {
    await render({ sku: 'B-500G' });
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add to bag' })).toBeDisabled();
  });

  it('Breadcrumbs: Home / Shop / Category / Product, the product is the current page', async () => {
    await render();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const items = within(nav).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.replace('/', ''))).toEqual(['Home', 'Shop', 'Fruit', 'Bananas']);
    expect(within(nav).getByRole('link', { name: 'Fruit' }).getAttribute('href')).toMatch(/\/shop\?category=fruit$/);
    expect(within(nav).getByText('Bananas')).toHaveAttribute('aria-current', 'page');
  });

  it('Scroll on desktop (sticky): the buy box is sticky at desktop, in a 1.15fr/1fr grid', async () => {
    await render();
    const buyBox = screen.getByRole('heading', { level: 1 }).closest('.desktop\\:sticky');
    expect(buyBox).not.toBeNull();
    expect(buyBox).toHaveClass('desktop:top-[110px]');
    expect(buyBox?.parentElement?.className).toContain('desktop:grid-cols-[1.15fr_1fr]');
    expect(buyBox?.parentElement?.className).toContain('desktop:gap-[49px]');
  });

  it('Related: "Pairs with" shows four products and never the current one', async () => {
    await render();
    const section = screen.getByRole('region', { name: 'Pairs with' });
    const names = within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Apples', 'Pears', 'Plums', 'Kiwis']);
    expect(mocks.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'c-fruit', pageSize: 5, currency: 'USD' }));
  });

  it('a failing related search leaves the section out; the page still renders', async () => {
    mocks.searchProducts.mockRejectedValue(new Error('boom'));
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Bananas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Pairs with' })).toBeNull();
  });

  it('No reviews (omitted): no reviews heading', async () => {
    await render();
    expect(screen.queryByRole('heading', { name: 'Reviews' })).toBeNull();
  });

  it('Related click (qty reset): another product renders with quantity 1', async () => {
    const first = await render();
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(within(screen.getByRole('group', { name: 'Quantity' })).getByRole('status')).toHaveTextContent('2');
    first.unmount();
    mocks.getProductBySlug.mockResolvedValue(makeProduct({ id: 'p-milk', name: 'Milk', slug: 'milk', variants: [variant('MILK', 199, true, '1 L', 1)] }));
    await render({}, 'milk');
    expect(within(screen.getByRole('group', { name: 'Quantity' })).getByRole('status')).toHaveTextContent('1');
  });

  it('German page', async () => {
    await render({}, 'bananas', 'de-DE');
    expect(screen.getByRole('button', { name: 'In den Warenkorb' })).toBeInTheDocument();
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
