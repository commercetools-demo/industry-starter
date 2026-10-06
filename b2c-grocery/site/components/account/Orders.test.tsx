import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrderListItem, OrderStatus } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { OrderStatusTag } from './OrderStatusTag';
import { OrdersList } from './OrdersList';
import { OrdersTable } from './OrdersTable';

const item = (n: number, over: Partial<OrderListItem> = {}): OrderListItem => ({
  id: `order-${n}`,
  orderNumber: `MLV-100${n}`,
  createdAt: '2026-10-05T10:30:00.000Z',
  status: 'processing',
  total: { centAmount: 1047, currencyCode: 'USD' },
  itemSummary: 'Whole milk, Bananas +2',
  ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const stubOrders = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => json(body, status)));

afterEach(() => vi.unstubAllGlobals());

describe('OrderStatusTag', () => {
  it.each([
    ['processing', 'tag-accent', 'Processing'],
    ['packing', 'tag-accent-2', 'Packing'],
    ['on-its-way', 'tag-accent-2', 'On its way'],
    ['delivered', 'tag-neutral', 'Delivered'],
    ['cancelled', 'tag-neutral', 'Cancelled'],
    ['unknown', 'tag-neutral', 'Status unknown'],
  ] as [OrderStatus, string, string][])('Status mapping: %s uses %s', (status, cls, label) => {
    renderWithProviders(<OrderStatusTag status={status} />);
    const tag = screen.getByText(label);
    expect(tag).toHaveClass(cls);
    // Accent and accent-2 are never mixed up with the neutral fallback.
    for (const other of ['tag-accent', 'tag-accent-2', 'tag-neutral'].filter((c) => c !== cls)) expect(tag).not.toHaveClass(other);
  });
});

describe('OrdersTable', () => {
  it('columns, cells and a link per row to the order detail', () => {
    renderWithProviders(<OrdersTable orders={[item(1), item(2, { id: 'abcdef1234567', orderNumber: undefined, status: 'delivered' })]} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Items', 'Order number', 'Placed', 'Total', 'Status']);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const first = within(rows[0]);
    expect(first.getByRole('link', { name: 'Whole milk, Bananas +2' })).toHaveAttribute('href', '/en-US/account/orders/order-1');
    expect(first.getByText('MLV-1001')).toBeInTheDocument();
    expect(first.getByText('Oct 5, 2026')).toBeInTheDocument();
    expect(first.getByText('$10.47')).toBeInTheDocument();
    expect(first.getByText('Processing')).toBeInTheDocument();
    expect(within(rows[1]).getByText('#abcdef12')).toBeInTheDocument();
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/en-US/account/orders/abcdef1234567');
  });

  it('German locale formats date and money', () => {
    renderWithProviders(<OrdersTable orders={[item(1, { total: { centAmount: 1047, currencyCode: 'EUR' } })]} />, { locale: 'de-DE' });
    expect(screen.getByText('05.10.2026')).toBeInTheDocument();
    expect(screen.getByText(/10,47/)).toBeInTheDocument();
    expect(screen.getByText('In Bearbeitung')).toBeInTheDocument();
  });
});

describe('OrdersList', () => {
  it('No orders: "No orders yet" and a browse button', async () => {
    stubOrders({ orders: [], total: 0, page: 1, pageSize: 10 });
    renderWithProviders(<OrdersList />);
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a loading note first, then the rows', async () => {
    stubOrders({ orders: [item(1)], total: 1, page: 1, pageSize: 10 });
    renderWithProviders(<OrdersList />);
    expect(screen.getByText('Loading your orders…')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Orders pages' })).not.toBeInTheDocument();
  });

  it('load failure: message with retry, not the empty state', async () => {
    stubOrders({ error: 'ORDERS_ERROR' }, 500);
    renderWithProviders(<OrdersList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('No orders yet')).not.toBeInTheDocument();
  });

  it('preview: limits the rows and links to all orders when there are more', async () => {
    stubOrders({ orders: [item(1), item(2), item(3), item(4)], total: 12, page: 1, pageSize: 10 });
    renderWithProviders(<OrdersList preview={2} />);
    await screen.findByRole('table');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/en-US/account/orders');
  });

  it('pagination: page 2 of 3 links to previous (first page) and next', async () => {
    stubOrders({ orders: [item(11)], total: 25, page: 2, pageSize: 10 });
    renderWithProviders(<OrdersList page={2} />);
    await screen.findByRole('table');
    const nav = screen.getByRole('navigation', { name: 'Orders pages' });
    expect(within(nav).getByText('Page 2 of 3')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/account/orders');
    expect(within(nav).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en-US/account/orders?page=3');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/account/orders?page=2');
  });

  it('page beyond the end: a link back to the first page, not "No orders yet"', async () => {
    stubOrders({ orders: [], total: 25, page: 9, pageSize: 10 });
    renderWithProviders(<OrdersList page={9} />);
    expect(await screen.findByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/en-US/account/orders');
    expect(screen.queryByText('No orders yet')).not.toBeInTheDocument();
  });
});
