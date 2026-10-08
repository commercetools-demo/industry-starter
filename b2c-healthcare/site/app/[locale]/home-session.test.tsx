import type { ReactNode } from 'react';
import { createTranslator } from 'next-intl';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY_ACCOUNT, KEY_CART } from '@/lib/cache-keys';
import messages from '@/messages/en-US.json';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen, within } from '@/test/utils';

vi.mock('next/navigation', async (importOriginal) =>
  (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()),
);
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'home' }),
}));
// The home body must never read the session; the layout does, through getHeaderUser.
const getSession = vi.fn();
const getCustomerByIdCached = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('@/lib/ct/customers', () => ({ getCustomerByIdCached: (id: string) => getCustomerByIdCached(id) }));
vi.mock('@/lib/ct/home', () => ({ getHomeSnapshot: async () => null, hasSameDayMethod: async () => false }));
vi.mock('@/lib/routes', () => ({ showJournal: () => false }));
vi.mock('@/lib/content', () => ({ getPublishedArticles: () => [] }));

import { Header } from '@/components/layout/Header';
import { getHeaderUser } from '@/lib/header-user';
import LocaleHome from './page';

const params = Promise.resolve({ locale: 'en-US' });
const cart = { id: 'k', version: 1, itemCount: 3, lineCount: 2, currencyCode: 'USD' };

/** The locale layout in miniature: fallback from the session (getHeaderUser), the home header and the page body. */
async function renderLayout(state: { cart?: unknown } = {}) {
  setPathname('/en-US');
  const user = await getHeaderUser();
  const fallback = { [KEY_ACCOUNT]: user, ...(state.cart ? { [KEY_CART]: state.cart } : {}) };
  const body = await LocaleHome({ params });
  const Wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
  return renderWithProviders(
    <Wrapper>
      <Header />
      <main>{body}</main>
    </Wrapper>,
  );
}

beforeEach(() => {
  getSession.mockReset();
  getCustomerByIdCached.mockReset();
});

describe('home-landing-page › Landing page with session-resolved buyer context', () => {
  it('Anonymous visitor: the shared merchandising renders in full and no account-dependent slot is rendered', async () => {
    getSession.mockResolvedValue({});
    const { container } = await renderLayout();
    const main = container.querySelector('main') as HTMLElement;
    for (const name of [messages.home.services.title, messages.home.steps.title, messages.home.cta.title]) {
      expect(within(main).getByRole('region', { name })).toBeInTheDocument();
    }
    expect(within(main).getByRole('heading', { level: 1 })).toBeInTheDocument();
    // Nothing buyer-specific in the body or the header: no cart, no identity, a sign-in path.
    expect(main.querySelector('[data-cart-count], [data-account-link]')).toBeNull();
    expect(screen.queryByRole('link', { name: /^Cart/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your account' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/en-US/login');
  });

  it('Expired session: rendered as for an anonymous visitor with a sign-in path and no stale count or name', async () => {
    // An expired token yields an empty session (lib/session-core.test.ts): no customer is read at all.
    getSession.mockResolvedValue({});
    const { container } = await renderLayout();
    expect(getCustomerByIdCached).not.toHaveBeenCalled();
    expect(container.querySelector('[data-cart-count]')).toBeNull();
    expect(container.querySelector('[data-account-link]')).toBeNull();
    expect(screen.queryByText(/^[A-Z]{2}$/)).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0);
  });

  it('a signed-in patient sees the cart with its line count and the account link in the home header, and no "Sign in"', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    getCustomerByIdCached.mockResolvedValue({ id: 'c1', firstName: 'Sam', lastName: 'Rivera' });
    const { container } = await renderLayout({ cart });
    expect(container.querySelector('[data-cart-count]')).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveTextContent('SR');
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('the header search entry (D-017) links to the search page and is keyboard reachable', async () => {
    getSession.mockResolvedValue({});
    await renderLayout();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: messages.search.label })).toHaveAttribute('href', '/en-US/search');
  });

  it('the page body never reads the session (shared markup: nothing buyer-specific can be cached into it)', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    await LocaleHome({ params });
    expect(getSession).not.toHaveBeenCalled();
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(import.meta.dirname, 'page.tsx'), 'utf8');
    expect(source).not.toMatch(/lib\/session|getHeaderUser|cookies\(|headers\(/);
  });
});
