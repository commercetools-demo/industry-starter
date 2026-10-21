import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

import OrdersTab from '@/components/account/orders/OrdersTab';
import { nav, renderShell, stubFetch } from '@/test/shell';
import type { OrderListItem } from '@/lib/types';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const done: OrderListItem = {
  id: 'o1', orderNumber: 'MC-1001', createdAt: '2026-10-01T10:00:00.000Z', totalCents: 4250, currency: 'USD',
  status: 'completed', hasCollect: true, hasShip: false, thumbs: [], itemCount: 2, collect: null,
};

beforeEach(() => {
  nav.pathname = '/account/orders';
});
afterEach(() => vi.unstubAllGlobals());

describe('Buy again', () => {
  it('toasts how many were added and lists the skipped lines with their reasons', async () => {
    const { calls } = stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/orders?': () => ({ orders: [done], total: 1, limit: 10, offset: 0 }),
      '/api/orders/o1/reorder': () => ({
        added: [{ sku: 'A', name: 'Ember pods', quantity: 2, fulfilment: 'delivery' }],
        skipped: [{ sku: 'B', name: 'Casa pods', reason: 'out_of_stock' }, { sku: 'C', name: 'Old blend', reason: 'not_found' }],
        cart: { id: 'cart', version: 1, count: 2, lines: [] },
      }),
      '/api/cart': () => ({ cart: null }),
      '/api/cart/count': () => ({ count: 2 }),
    });
    renderShell(<OrdersTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Buy again' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/orders/o1/reorder' && c.init?.method === 'POST')).toBe(true));
    expect(await screen.findByText('2 items added to your bag.')).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog', { name: 'These items could not be added' });
    const list = within(dialog).getByTestId('skipped-lines');
    expect(list).toHaveTextContent('Casa pods');
    expect(list).toHaveTextContent('Out of stock');
    expect(list).toHaveTextContent('Old blend');
    expect(list).toHaveTextContent('No longer in our range');
    expect(within(dialog).getByRole('link', { name: 'View bag' })).toHaveAttribute('href', '/cart');
  });

  it('shows no dialog when nothing was skipped', async () => {
    stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/orders?': () => ({ orders: [done], total: 1, limit: 10, offset: 0 }),
      '/api/orders/o1/reorder': () => ({ added: [{ sku: 'A', name: 'Ember', quantity: 1, fulfilment: 'delivery' }], skipped: [], cart: { id: 'c', version: 1, count: 1, lines: [] } }),
      '/api/cart': () => ({ cart: null }),
      '/api/cart/count': () => ({ count: 1 }),
    });
    renderShell(<OrdersTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Buy again' }));
    expect(await screen.findByText('1 item added to your bag.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
  });

  it('a failed call says so and keeps the page', async () => {
    stubFetch({
      '/api/auth/me': () => ({ customer }),
      '/api/orders?': () => ({ orders: [done], total: 1, limit: 10, offset: 0 }),
      '/api/orders/o1/reorder': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }),
    });
    renderShell(<OrdersTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Buy again' }));
    expect(await screen.findByText('We could not add these items. Try again.')).toBeInTheDocument();
  });
});
