import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { ToastProvider } from '@/components/ui/Toast';
import { CartProvider } from '@/context/CartProvider';
import { SWRProvider } from '@/context/SWRProvider';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { COUNTRY_CONFIG } from '@/lib/utils';
import LocaleLayout, { generateMetadata, generateStaticParams } from './layout';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('@/components/layout/MarketSync', () => ({ MarketSync: () => null }));
vi.mock('next/navigation', async (orig) => ({ ...(await orig<typeof import('next/navigation')>()), notFound: () => notFound() }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getMessages: vi.fn(async () => (globalThis as { __msgs?: unknown }).__msgs),
  getTranslations: vi.fn(async () => (key: string) => `nav.${key}`),
}));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession(), getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
const getMappedCart = vi.fn();
vi.mock('@/lib/ct/cart', () => ({ getMappedCart: (...args: unknown[]) => getMappedCart(...args) }));
vi.mock('@/lib/ct/locale-validation', () => ({ getValidMarkets: vi.fn(async () => Object.values((await import('@/lib/utils')).COUNTRY_CONFIG)) }));
vi.mock('@/components/layout/BagButton', () => ({ BagButton: () => <span data-slot="bag">nav.bag</span> }));
// Chrome pieces are tested on their own; here we only check the composition and order.
vi.mock('@/components/layout/AnnouncementBar', () => ({ AnnouncementBar: () => <div data-slot="announcement" /> }));
vi.mock('@/components/layout/Header', () => ({
  Header: ({ markets, bag, account }: { markets: unknown[]; bag: React.ReactNode; account: React.ReactNode }) => (
    <header data-slot="header" data-markets={markets.length}>
      {bag}
      {account}
    </header>
  ),
}));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => <footer data-slot="footer" /> }));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({});
  getMappedCart.mockResolvedValue(null);
});

const render = async (locale: string) =>
  LocaleLayout({ children: <span>child</span>, params: Promise.resolve({ locale }) });

describe('LocaleLayout', () => {
  it('provides the German catalog for de-DE', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = de;
    const el = await render('de-DE');
    expect(el.type).toBe(NextIntlClientProvider);
    expect(el.props.locale).toBe('de-DE');
    expect(el.props.messages.nav.new).toBe('Neu');
    expect(renderToStaticMarkup(el)).toContain('child');
  });

  it('provider order: intl > SWR > Toast > Cart > chrome', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    const el = await render('en-US');
    const swr = el.props.children;
    expect(swr.type).toBe(SWRProvider);
    expect(swr.props.children.type).toBe(ToastProvider);
    expect(swr.props.children.props.children.type).toBe(CartProvider);
  });

  it('Returning customer hydration: the server cart seeds the SWR fallback (first paint, no spinner)', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    getSession.mockResolvedValue({ cartId: 'cart-1' });
    const cart = { id: 'cart-1', itemCount: 2 };
    getMappedCart.mockResolvedValue(cart);
    const el = await render('en-US');
    expect(el.props.children.props.fallback).toEqual({ cart, account: null });
    expect(getMappedCart).toHaveBeenCalledWith('cart-1', { country: 'US', currency: 'USD', locale: 'en-US' });
  });

  it('no cart id in the session: fallback cart is null and commercetools is not called', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    const el = await render('en-US');
    expect(el.props.children.props.fallback).toEqual({ cart: null, account: null });
    expect(getMappedCart).not.toHaveBeenCalled();
  });

  it('Signed-in session: the account fallback is seeded from the session fields (no commercetools call)', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    getSession.mockResolvedValue({ customerId: 'c-1', customerEmail: 'a@b.co', customerFirstName: 'Ada', customerLastName: 'L' });
    const el = await render('en-US');
    expect(el.props.children.props.fallback.account).toEqual({ id: 'c-1', email: 'a@b.co', firstName: 'Ada', lastName: 'L' });
    expect(renderToStaticMarkup(el)).toContain('aria-label="Account, Ada"');
  });

  it('a failing cart read does not break the page', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    getSession.mockResolvedValue({ cartId: 'cart-1' });
    getMappedCart.mockRejectedValue(new Error('down'));
    const el = await render('en-US');
    expect(el.props.children.props.fallback).toEqual({ cart: null, account: null });
  });

  it('renders announcement, header, main (page-enter) and footer in that order', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    const el = await render('en-US');
    const html = renderToStaticMarkup(el);
    const order = ['data-slot="announcement"', 'data-slot="header"', '<main class="page-enter"><span>child</span></main>', 'data-slot="footer"'];
    const positions = order.map((s) => html.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('passes every configured market to the header and fills the bag and account slots', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    const el = await render('en-US');
    const html = renderToStaticMarkup(el);
    expect(html).toContain(`data-markets="${Object.keys(COUNTRY_CONFIG).length}"`);
    expect(html).toContain('data-slot="bag"');
    expect(html).toContain('aria-label="Sign in"');
  });

  it('Unsupported locale: invalid locale calls notFound', async () => {
    (globalThis as { __msgs?: unknown }).__msgs = en;
    await expect(render('xx-YY')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('generates static params for both locales', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'en-US' }, { locale: 'de-DE' }]);
  });

  it('provides a default title and description (Lighthouse: every page needs both)', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) });
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'xx-YY' }) })).toEqual({});
  });
});
