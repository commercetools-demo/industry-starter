import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import AccountShell from '@/components/account/AccountShell';
import { visibleTabs } from '@/components/account/AccountTabs';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { keyAccountSummary } from '@/lib/cache-keys';
import { nav, renderShell, stubFetch } from '@/test/shell';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const me = () => ({ customer });

beforeEach(() => {
  nav.pathname = '/account/orders';
  nav.replace.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const shell = (collection = true) =>
  renderShell(
    <AccountShell firstName="Maya" collection={collection}>
      <p>panel</p>
    </AccountShell>,
  );

describe('Account shell', () => {
  it('the frame is a screen tall so the footer starts below the fold while a panel is still loading', () => {
    shell();
    expect(screen.getByTestId('account-frame').className).toContain('min-h-[calc(100svh-7rem)]');
  });

  it('Loyalty not offered', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/summary': () => ({ openOrders: 0, readyForCollection: 0, savedItems: 0 }) });
    const { container } = shell();
    await screen.findByText('No open orders');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hi, Maya');
    expect(container.textContent).not.toMatch(/points|loyalty|member|since/i);
  });

  it('Nothing yet on the account', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/summary': () => ({ openOrders: 0, readyForCollection: 0, savedItems: 0 }) });
    shell();
    expect(await screen.findByTestId('account-status')).toHaveTextContent('No open orders');
    expect(screen.getByText('panel')).toBeInTheDocument();
  });

  it('One backing service down', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/summary': () => ({ openOrders: null, readyForCollection: 2, savedItems: 4 }) });
    shell();
    expect(await screen.findByTestId('account-status')).toHaveTextContent('Orders unavailable');
    expect(screen.getByRole('link', { name: 'Saved' })).toBeInTheDocument();
  });

  it('shows ready for collection beside the open count', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/summary': () => ({ openOrders: 3, readyForCollection: 1, savedItems: 0 }) });
    shell();
    expect(await screen.findByTestId('account-status')).toHaveTextContent('3 open orders · 1 ready for collection');
  });

  it('Tab strip has aria-current on the active tab', async () => {
    stubFetch({ '/api/auth/me': me, '/api/account/summary': () => ({ openOrders: 0, readyForCollection: 0, savedItems: 0 }) });
    nav.pathname = '/account/addresses';
    shell();
    const nav_ = screen.getByRole('navigation', { name: 'Account' });
    const current = nav_.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Addresses');
  });

  it('lists the tabs in design order with Sign out last', () => {
    stubFetch({ '/api/auth/me': me, '/api/account/summary': () => ({}) });
    shell();
    const labels = within_(screen.getByRole('navigation', { name: 'Account' }));
    expect(labels).toEqual([
      'Orders', 'Collection', 'Subscriptions', 'Saved', 'Addresses', 'Payment methods', 'Reviews', 'Profile', 'Settings', 'Sign out',
    ]);
  });

  it('Collection tab and nav entry are hidden in the Canada market', () => {
    stubFetch({ '/api/auth/me': me, '/api/account/summary': () => ({}) });
    shell(false);
    expect(screen.queryByRole('link', { name: 'Collection' })).toBeNull();
    expect(visibleTabs(false).map((t) => t.id)).not.toContain('collection');
    expect(visibleTabs(true).map((t) => t.id)).toContain('collection');
  });

  it('Sign out calls the logout route', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': me, '/api/account/summary': () => ({}), '/api/auth/logout': () => ({ ok: true }),
    });
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/auth/logout')).toBe(true));
  });
});

function within_(navEl: HTMLElement): string[] {
  return [...navEl.querySelectorAll('a, button')].map((e) => e.textContent?.trim() ?? '');
}

function Probe() {
  const { error } = useAccountSwr(['probe', 'c1'], '/api/probe');
  return <p>{error ? `error ${error.status}` : 'ok'}</p>;
}

describe('Session no longer valid', () => {
  it('a 401 from a panel hook sends the shopper to sign-in with the path', async () => {
    nav.pathname = '/account/saved';
    stubFetch({ '/api/probe': () => Response.json({ error: { code: 'unauthorized', message: 'x' } }, { status: 401 }) });
    renderShell(<Probe />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/account/sign-in?redirect=%2Faccount%2Fsaved'));
  });

  it('another failure stays in the panel and does not navigate', async () => {
    stubFetch({ '/api/probe': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }) });
    renderShell(<Probe />);
    await screen.findByText('error 503');
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe('summary keys', () => {
  it('Two customers never share an account summary key', () => {
    expect(keyAccountSummary('c1')).not.toEqual(keyAccountSummary('c2'));
    expect(keyAccountSummary('c1')[1]).toBe('c1');
  });
});
