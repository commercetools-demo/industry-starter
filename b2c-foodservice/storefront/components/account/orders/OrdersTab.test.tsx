import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
const search = vi.hoisted(() => ({ value: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

import AccountShell from '@/components/account/AccountShell';
import OrderStatusPill from '@/components/account/orders/OrderStatusPill';
import OrdersTab, { parseOrdersQuery } from '@/components/account/orders/OrdersTab';
import { directionsUrl } from '@/components/account/orders/OrderCard';
import { orderView } from '@/test/checkout';
import { nav, renderShell, stubFetch } from '@/test/shell';
import type { OrderView } from '@/lib/types';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const item = (over: Partial<OrderView> = {}): OrderView =>
  orderView({
    id: 'o1', orderNumber: 'MC-1001', createdAt: '2026-10-01T10:00:00.000Z', currency: 'USD', customerId: 'c1',
    status: 'ordered', hasCollect: true, hasShip: false, ship: null,
    lines: [{ id: 'l1', sku: 'S1', name: 'Ember pods', variantSummary: '', imageUrl: null, quantity: 2, unitCents: 2125, priceCents: 4250, fulfilment: 'collect', storeKey: 'mcf-store-nyc-soho', storeName: 'Malva SoHo', recurrence: null }],
    collect: [{ storeKey: 'mcf-store-nyc-soho', storeName: 'Malva SoHo', address: '', hours: '07:00–18:00', phone: null, readyMinutes: null, pickupName: null, lat: 40.72, lng: -74 }],
    totals: { subtotalCents: 4250, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: 4250 },
    ...over,
  });
const page = (orders: OrderView[], total = orders.length) => ({ orders, total, limit: 10, offset: 0 });
const base = { '/api/auth/me': () => ({ customer }), '/api/account/summary': () => ({ openOrders: 1, readyForCollection: 1, savedItems: 0 }) };

beforeEach(() => {
  search.value = '';
  nav.pathname = '/account/orders';
  nav.replace.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Orders tab', () => {
  it('Ready for collection: the card shows the store, its hours and Get directions', async () => {
    stubFetch({ ...base, '/api/orders': () => page([item({ status: 'ready' })]) });
    renderShell(<OrdersTab />);
    const block = await screen.findByTestId('ready-block');
    expect(block).toHaveTextContent('Ready at Malva SoHo · 07:00–18:00. Bring your ID and this order number.');
    expect(screen.getByTestId('order-pill')).toHaveTextContent('Ready for collection');
    expect(screen.getByRole('link', { name: 'Get directions' })).toBeInTheDocument();
  });

  it('Directions link opens a new tab safely', async () => {
    stubFetch({ ...base, '/api/orders': () => page([item({ status: 'ready' })]) });
    renderShell(<OrdersTab />);
    const link = await screen.findByRole('link', { name: 'Get directions' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=40.72,-74');
    expect(directionsUrl(null, null)).toBeNull();
  });

  it('a collected order offers no directions and no ready block; Buy again only when a handler exists', async () => {
    stubFetch({ ...base, '/api/orders': () => page([item({ status: 'completed' })]) });
    const onReorder = vi.fn();
    renderShell(<OrdersTab onReorder={onReorder} />);
    expect(await screen.findByTestId('order-pill')).toHaveTextContent('Collected');
    expect(screen.queryByTestId('ready-block')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Get directions' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Buy again' }));
    expect(onReorder).toHaveBeenCalledWith('o1');
  });

  it('No orders: an explicit empty state with Shop coffee', async () => {
    stubFetch({ ...base, '/api/orders': () => page([]) });
    renderShell(<OrdersTab />);
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop coffee' })).toHaveAttribute('href', '/shop');
  });

  it('Filter and page survive reload via the query string', async () => {
    search.value = 'filter=completed&page=2';
    const { calls } = stubFetch({ ...base, '/api/orders': () => page([item()], 25) });
    renderShell(<OrdersTab />);
    await screen.findByTestId('order-card');
    expect(calls.some((c) => c.url === '/api/orders?filter=completed&limit=10&offset=10')).toBe(true);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(nav.replace).toHaveBeenCalledWith('/account/orders?filter=completed&page=3');
  });

  it('choosing a filter resets the page and writes the query', async () => {
    stubFetch({ ...base, '/api/orders': () => page([item()]) });
    renderShell(<OrdersTab />);
    await screen.findByTestId('order-card');
    await userEvent.click(screen.getByRole('button', { name: 'Ready for collection' }));
    expect(nav.replace).toHaveBeenCalledWith('/account/orders?filter=ready');
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(nav.replace).toHaveBeenLastCalledWith('/account/orders');
  });

  it('Previous and Next are disabled at the ends', async () => {
    stubFetch({ ...base, '/api/orders': () => page([item()], 25) });
    renderShell(<OrdersTab />);
    await screen.findByTestId('order-card');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('Orders panel error does not hide the header', async () => {
    stubFetch({
      ...base,
      '/api/orders': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }),
    });
    renderShell(
      <AccountShell firstName="Maya" collection>
        <OrdersTab />
      </AccountShell>,
    );
    expect(await screen.findByTestId('panel-error')).toHaveTextContent('Orders is unavailable right now.');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hi, Maya');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('account-status')).toHaveTextContent('1 open order'));
  });
});

describe('Pill colours per status', () => {
  it.each([
    ['ready', 'text-teal-text'],
    ['completed', 'text-ink-2'],
    ['ordered', 'text-accent-press'],
    ['shipped', 'text-accent-press'],
    ['preparing', 'text-accent-press'],
  ] as const)('%s uses %s', (status, cls) => {
    renderShell(<OrderStatusPill status={status} hasCollect hasShip={false} />);
    expect(screen.getByTestId('order-pill').className).toContain(cls);
  });

  it('labels delivery orders Delivered and mixed orders Completed', () => {
    renderShell(
      <>
        <OrderStatusPill status="completed" hasCollect={false} hasShip />
        <OrderStatusPill status="completed" hasCollect hasShip />
      </>,
    );
    const pills = screen.getAllByTestId('order-pill');
    expect(pills[0]).toHaveTextContent('Delivered');
    expect(pills[1]).toHaveTextContent('Completed');
  });
});

describe('parseOrdersQuery', () => {
  it('falls back for anything unknown', () => {
    expect(parseOrdersQuery(new URLSearchParams('filter=evil&page=-4'))).toEqual({ filter: 'all', page: 1 });
    expect(parseOrdersQuery(new URLSearchParams('filter=ready&page=3'))).toEqual({ filter: 'ready', page: 3 });
  });
});

describe('Order card thumbnails', () => {
  it('shows five thumbnails at most and counts the rest', async () => {
    const line = (id: string) => ({ ...item().lines[0]!, id, name: `Pod ${id}`, quantity: 1 });
    const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(line);
    stubFetch({ ...base, '/api/orders': () => page([item({ lines, status: 'ordered' })]) });
    renderShell(<OrdersTab />);
    const card = await screen.findByTestId('order-card');
    expect(card.querySelectorAll('ul li')).toHaveLength(6);
    expect(card).toHaveTextContent('+2');
  });
});
