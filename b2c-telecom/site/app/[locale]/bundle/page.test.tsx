import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { makeCart } from '@/test/fixtures/cart';

const state = vi.hoisted(() => ({ messages: {} as Record<string, unknown>, locale: 'en-US', setLocale: vi.fn(), session: {} as { customerId?: string }, cart: null as unknown, fail: false, view: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: (locale: string) => state.setLocale(locale),
  getTranslations: async (arg: string | { locale: string; namespace: string }) =>
    typeof arg === 'string'
      ? createTranslator({ locale: state.locale, messages: state.messages, namespace: arg as never })
      : createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/bundle', () => ({
  readBundle: async () => {
    if (state.fail) throw new Error('boom');
    return { cart: state.cart, cartId: undefined };
  },
}));
vi.mock('../_shell/loadNavItems', () => ({
  loadNavItems: async () => [
    { key: 'malva-cat-phone-plans', label: 'Phone plans', path: '/shop/phone-plans', matchSlugs: [] },
    { key: 'malva-cat-cable-internet', label: 'Cable internet', path: '/shop/cable-internet', matchSlugs: [] },
  ],
}));
vi.mock('@/components/bundle/BundleView', () => ({
  BundleView: (props: unknown) => {
    state.view(props);
    return <div data-testid="bundle-view" />;
  },
}));

import BundlePage, { generateMetadata } from './page';

async function renderPage(locale: 'en-US' | 'de-DE') {
  state.locale = locale;
  state.messages = locale === 'en-US' ? enMessages : deMessages;
  render(
    <NextIntlClientProvider locale={locale} messages={state.messages}>
      {await BundlePage({ params: Promise.resolve({ locale }) })}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.session = {};
  state.cart = null;
  state.fail = false;
});

describe('bundle page', () => {
  it('sets the locale, shows breadcrumb and H1 and passes the server cart as initialCart', async () => {
    const cart = makeCart();
    state.cart = cart;
    state.session = { customerId: 'c1' };
    await renderPage('en-US');
    expect(state.setLocale).toHaveBeenCalledWith('en-US');
    expect(screen.getByRole('heading', { level: 1, name: 'My bundle' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('Home');
    expect(crumbs).toHaveTextContent('My bundle');
    expect(state.view).toHaveBeenCalledWith({
      initialCart: cart,
      signedIn: true,
      links: [
        { key: 'phone', href: '/shop/phone-plans' },
        { key: 'cable', href: '/shop/cable-internet' },
      ],
    });
  });

  it('an anonymous visitor is not signed in; a cart outage renders the page with no initial cart', async () => {
    state.fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderPage('en-US');
    expect(state.view).toHaveBeenCalledWith(expect.objectContaining({ initialCart: null, signedIn: false }));
  });

  it('de-DE title', async () => {
    await renderPage('de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Mein Bundle' })).toBeInTheDocument();
  });

  it('an unsupported locale is a 404; the page is not indexable', async () => {
    await expect(BundlePage({ params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NOT_FOUND');
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) })).toEqual({ title: 'My bundle', robots: { index: false } });
  });
});
