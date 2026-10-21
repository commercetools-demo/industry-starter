import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import { CLOSED_ALL_WEEK } from '@/lib/hours';
import type { Category, Store } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { nav, renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import Header from '@/components/layout/Header';

const store = (key: string, name: string): Store => ({
  id: key, key, name, addressLine: '1 Main St', city: 'New York', postalCode: '10001', country: 'US',
  hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 15,
});
const STORES = [store('mcf-store-nyc-soho', 'Malva SoHo'), store('mcf-store-nyc-brooklyn', 'Malva Brooklyn')];

const cat = (key: string, slug: string): Category => ({ id: key, key, name: slug, slug, children: [] });
const TREE: Category[] = [cat('mcf-cat-pods', 'pods'), cat('mcf-cat-coffee', 'coffee')];

const fallbackFor = (selectedKey: string | null, stores = STORES, country = 'US') => ({
  [unstable_serialize(keyChannels(country))]: { stores, selectedKey },
});

function guestFetch(count = 0) {
  return stubFetch({
    '/api/cart/count': () => ({ count }),
    '/api/auth/me': () => ({ customer: null }),
  });
}

beforeEach(() => {
  nav.pathname = '/';
  nav.push.mockReset();
  nav.refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('Header', () => {
  it('Cart count shows 3 for 3 units across 2 lines', async () => {
    guestFetch(3); // the route sums quantities: 3 units on 2 lines is 3
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    expect(await screen.findByTestId('cart-badge')).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Cart, 3 items' })).toBeInTheDocument();
  });

  it('badge hidden at 0', async () => {
    const { calls } = guestFetch(0);
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    await waitFor(() => expect(calls.some((c) => c.url === '/api/cart/count')).toBe(true));
    expect(screen.queryByTestId('cart-badge')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cart, 0 items' })).toBeInTheDocument();
  });

  it('cart button goes to /cart until a drawer is mounted', async () => {
    guestFetch(1);
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    await userEvent.click(screen.getByRole('button', { name: /^Cart/ }));
    expect(nav.push).toHaveBeenCalledWith('/cart');
  });

  it('guest sees the plain icon leading to sign in', async () => {
    guestFetch();
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    const link = await screen.findByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/account/sign-in');
    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull();
  });

  it('Signed in shows initials avatar and dropdown with name email dashboard sign out', async () => {
    const { calls } = stubFetch({
      '/api/cart/count': () => ({ count: 0 }),
      '/api/auth/me': () => ({ customer: { firstName: 'Maya', lastName: 'Okonkwo', email: 'maya.okonkwo@example.com' } }),
      '/api/auth/logout': () => ({ ok: true }),
    });
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    const trigger = await screen.findByRole('button', { name: 'Account menu' });
    expect(trigger).toHaveTextContent('MO');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByText('Maya Okonkwo')).toBeInTheDocument();
    expect(within(menu).getByText('maya.okonkwo@example.com')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/account');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(calls.find((c) => c.url === '/api/auth/logout')?.init?.method).toBe('POST');
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('account menu closes on Escape and returns focus to the avatar', async () => {
    stubFetch({
      '/api/cart/count': () => ({ count: 0 }),
      '/api/auth/me': () => ({ customer: { firstName: 'A', lastName: 'B', email: 'a@example.com' } }),
    });
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    const trigger = await screen.findByRole('button', { name: 'Account menu' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('store pill reads Collect at store', () => {
    guestFetch();
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor('mcf-store-nyc-brooklyn') });
    expect(screen.getByRole('button', { name: /Collection store: Malva Brooklyn/ })).toHaveTextContent('Collect at Malva Brooklyn');
  });

  it('store pill reads Choose a store without a store', () => {
    guestFetch();
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    expect(screen.getByRole('button', { name: /Collection store/ })).toHaveTextContent('Choose a store');
  });

  it('Store pill is hidden in the Canada market', () => {
    guestFetch();
    renderShell(<Header categories={TREE} />, { locale: 'en-CA', fallback: fallbackFor(null, [], 'CA') });
    expect(screen.queryByRole('button', { name: /Collection store/ })).toBeNull();
    expect(screen.getByRole('button', { name: /CA \(CAD\) \| EN: change country and language/ })).toHaveTextContent('CA (CAD) | EN');
  });

  it('locale pill shows country currency and language', () => {
    guestFetch();
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    expect(screen.getByRole('button', { name: /US \(USD\) \| EN: change country and language/ })).toHaveTextContent('US (USD) | EN');
  });

  it('active link has aria-current', () => {
    guestFetch();
    nav.pathname = '/category/coffee';
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    expect(screen.getByRole('link', { name: 'Coffee' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Pods' })).not.toHaveAttribute('aria-current');
  });

  it('an empty category tree still renders the five links to the home page', () => {
    guestFetch();
    renderShell(<Header categories={[]} />, { fallback: fallbackFor(null) });
    const nav5 = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav5).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Pods', 'Coffee', 'Machines', 'Accessories', 'Gifts']);
    expect(links.every((l) => l.getAttribute('href') === '/')).toBe(true);
  });

  it('search submits to /search?q=', async () => {
    guestFetch();
    renderShell(<Header categories={TREE} />, { fallback: fallbackFor(null) });
    await userEvent.click(screen.getByRole('button', { name: 'Open search' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'oat milk{Enter}');
    expect(nav.push).toHaveBeenCalledWith('/search?q=oat%20milk');
  });

  it('no axe violations', async () => {
    guestFetch();
    const { container } = renderShell(<Header categories={TREE} />, { fallback: fallbackFor('mcf-store-nyc-soho') });
    await act(async () => {});
    await expectNoAxeViolations(container);
  });
});
