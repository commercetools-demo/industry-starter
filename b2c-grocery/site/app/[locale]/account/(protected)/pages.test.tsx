import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import AccountPage from './page';
import OrdersPage from './orders/page';

vi.mock('next-intl/server', async () => {
  const messages = (await import('@/messages/en-US.json')).default as Record<string, unknown>;
  const lookup = (namespace: string) => (key: string) => {
    const value = `${namespace}.${key}`.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
    return typeof value === 'string' ? value : `${namespace}.${key}`;
  };
  return { setRequestLocale: vi.fn(), getTranslations: async ({ namespace }: { namespace: string }) => lookup(namespace) };
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const params = Promise.resolve({ locale: 'en-US' });

afterEach(() => vi.unstubAllGlobals());

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/auth/me') return json({ user: { id: 'c1', email: 'a@example.com', firstName: 'Ada', lastName: 'Lovelace' } });
      if (url === '/api/account/profile') return json({ createdAt: '2023-04-01T00:00:00.000Z', firstName: 'Ada', lastName: 'Lovelace', email: 'a@example.com' });
      if (url.startsWith('/api/account/orders')) {
        return json({
          orders: [{ id: 'o1', orderNumber: 'MLV-1', createdAt: '2026-10-05T10:00:00.000Z', status: 'packing', total: { centAmount: 500, currencyCode: 'USD' }, itemSummary: 'Bananas' }],
          total: 1,
          page: 1,
          pageSize: 10,
        });
      }
      throw new Error(`unexpected ${url}`);
    }),
  );
}

describe('/account dashboard', () => {
  it('Signed-in customer: name, orders table and both cards render', async () => {
    stubApi();
    renderWithProviders(await AccountPage({ params }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Bananas' })).toHaveAttribute('href', '/en-US/account/orders/o1');
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(await screen.findByText('No default address yet')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Account sections' })).toBeInTheDocument();
  });
});

describe('/account/orders', () => {
  it('reads ?page= and passes it on to the list', async () => {
    stubApi();
    renderWithProviders(await OrdersPage({ params, searchParams: Promise.resolve({ page: '2' }) }));
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    await screen.findByRole('table');
    expect(vi.mocked(fetch).mock.calls.map((c) => c[0])).toContain('/api/account/orders?page=2');
    expect(screen.getByRole('link', { name: /Orders/, current: 'page' })).toBeInTheDocument();
  });

  it('a bad ?page= falls back to page 1', async () => {
    stubApi();
    renderWithProviders(await OrdersPage({ params, searchParams: Promise.resolve({ page: 'abc' }) }));
    await screen.findByRole('table');
    expect(vi.mocked(fetch).mock.calls.map((c) => c[0])).toContain('/api/account/orders?page=1');
  });
});
