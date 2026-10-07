import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { ContactStrip } from '@/components/home/ContactStrip';
import { makeProduct } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import type { Category, SearchResult } from '@/lib/types';
import HomePage from './page';

const mocks = vi.hoisted(() => ({
  getCategoryTree: vi.fn(),
  searchProducts: vi.fn(),
  getMarket: vi.fn(),
  getSession: vi.fn(),
  getCart: vi.fn(),
  getMappedCart: vi.fn(),
  getCustomer: vi.fn(),
}));

vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: mocks.getCategoryTree }));
vi.mock('@/lib/ct/search', () => ({ searchProducts: mocks.searchProducts, DEFAULT_PAGE_SIZE: 24 }));
vi.mock('@/lib/ct/cart', () => ({ getCart: mocks.getCart, getMappedCart: mocks.getMappedCart }));
vi.mock('@/lib/ct/auth', () => ({ getCustomer: mocks.getCustomer }));
vi.mock('@/lib/session', () => ({ getMarket: mocks.getMarket, getSession: mocks.getSession }));
vi.mock('@/hooks/useSaved', () => ({ useSaved: () => ({ isSaved: () => false, toggle: async () => {} }) }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: 'en-US' | 'de-DE'; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'de-DE' ? deMessages : enMessages, namespace } as never),
}));

const keys = ['fresh-produce', 'dairy-eggs', 'bakery', 'pantry', 'drinks', 'household'];
const tree: Category[] = keys.map((key, i) => ({ id: `c${i}`, key, name: key.toUpperCase(), slug: key }));

function result(): SearchResult {
  const products = ['A', 'B', 'C', 'D'].map((n) => makeProduct({ id: `p${n}`, name: `Product ${n}`, slug: `product-${n}` }));
  return { products, total: 36, page: 1, pageSize: 4, facets: { categories: [{ id: 'c0', count: 12 }], priceBands: [], availability: { inStock: 0, outOfStock: 0 } } };
}

const render = async (locale: 'en-US' | 'de-DE' = 'en-US') => {
  const ui = await HomePage({ params: Promise.resolve({ locale }) });
  return renderWithProviders(ui, { locale });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.getCategoryTree.mockResolvedValue(tree);
  mocks.searchProducts.mockResolvedValue(result());
  mocks.getMarket.mockResolvedValue({ country: 'US', currency: 'USD', locale: 'en-US' });
});

describe('HomePage', () => {
  it('Editorial hero default: every section renders with real data', async () => {
    const { container } = await render();
    expect(container.querySelector('[data-hero="editorial"]')).not.toBeNull();
    expect(container.querySelector('[data-hero="grid"]')).toBeNull();
    expect(within(container.querySelector('[data-section="categories"]') as HTMLElement).getByRole('list')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-category]')).toHaveLength(6);
    expect(screen.getByText('12 items')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(container.querySelector('[data-section="editorial"]')).not.toBeNull();
    expect(container.querySelector('[data-section="contact"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en-US/contact');
  });

  it('Magazine grid: HOME_LAYOUT=grid swaps only the hero', async () => {
    vi.stubEnv('HOME_LAYOUT', 'grid');
    const { container } = await render();
    expect(container.querySelector('[data-hero="grid"]')).not.toBeNull();
    expect(container.querySelector('[data-hero="editorial"]')).toBeNull();
    expect(container.querySelector('[data-section="categories"]')).not.toBeNull();
    expect(container.querySelector('[data-section="new-in"]')).not.toBeNull();
  });

  it('Contact strip off: absent from the DOM', async () => {
    vi.stubEnv('HOME_CONTACT_STRIP', 'false');
    const { container } = await render();
    expect(container.querySelector('[data-section="contact"]')).toBeNull();
    expect(screen.queryByText('Questions? Contact us')).toBeNull();
  });

  it('starts the category tree and the newest search together, with the locale market and newest sort', async () => {
    let release!: (tree: Category[]) => void;
    mocks.getCategoryTree.mockReturnValue(new Promise<Category[]>((resolve) => (release = resolve)));
    const pending = HomePage({ params: Promise.resolve({ locale: 'de-DE' }) });
    await vi.waitFor(() => expect(mocks.searchProducts).toHaveBeenCalled());
    expect(mocks.getCategoryTree).toHaveBeenCalledWith('de-DE');
    expect(mocks.searchProducts).toHaveBeenCalledWith({ country: 'DE', currency: 'EUR', locale: 'de-DE', sort: 'newest', pageSize: 4 });
    release(tree);
    await pending;
  });

  it('Anonymous visitor: shared content only, no cart, session or customer reads', async () => {
    await render('de-DE');
    expect(mocks.getCart).not.toHaveBeenCalled();
    expect(mocks.getMappedCart).not.toHaveBeenCalled();
    expect(mocks.getCustomer).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.getMarket).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Bag/)).toBeNull();
  });

  it('an unknown locale falls back to getMarket()', async () => {
    await HomePage({ params: Promise.resolve({ locale: 'fr-FR' }) });
    expect(mocks.getMarket).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('German: German copy and links', async () => {
    await render('de-DE');
    expect(screen.getByRole('link', { name: 'Zur Kollektion' })).toHaveAttribute('href', '/de-DE/shop');
    expect(screen.getByRole('link', { name: 'Kontakt aufnehmen' })).toHaveAttribute('href', '/de-DE/contact');
  });
});

describe('ContactStrip', () => {
  it('heading, copy and a primary button to the contact page', () => {
    renderWithProviders(<ContactStrip />);
    expect(screen.getByRole('heading', { level: 3, name: 'Questions? Contact us' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en-US/contact');
  });
});
