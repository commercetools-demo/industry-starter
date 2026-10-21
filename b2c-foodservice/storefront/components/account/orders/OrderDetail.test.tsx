import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import DeliveryList from '@/components/account/orders/DeliveryList';
import OrderDetail from '@/components/account/orders/OrderDetail';
import OrderStatusTracker from '@/components/account/orders/OrderStatusTracker';
import ReturnList from '@/components/account/orders/ReturnList';
import { trackingUrl } from '@/lib/account/tracking';
import { nav, renderShell, stubFetch } from '@/test/shell';
import type { OrderDetailView } from '@/lib/types';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const order = (over: Partial<OrderDetailView> = {}): OrderDetailView => ({
  id: 'o1', orderNumber: 'MC-1001', createdAt: '2026-10-01T10:00:00.000Z', currency: 'USD', status: 'shipped',
  stateKey: null, shipmentState: 'Shipped', paymentState: 'Paid', hasCollect: false, hasShip: true,
  lines: [
    { id: 'l1', sku: 'S1', name: 'Ember pods', imageUrl: null, quantity: 3, unitCents: 1000, totalCents: 3000, fulfilment: 'delivery', storeName: null },
    { id: 'l2', sku: 'S2', name: 'Casa pods', imageUrl: null, quantity: 1, unitCents: 1500, totalCents: 1500, fulfilment: 'delivery', storeName: null },
  ],
  subtotalCents: 4500, shippingCents: 695, taxCents: 360, totalCents: 5195, collect: null,
  shippingAddress: { name: 'Maya Okonkwo', line: '100 Example Street', city: 'New York', state: 'NY', postalCode: '10012', country: 'US' },
  deliveries: [], returns: [], canReturn: false, returnWindowEndsAt: null, returnable: { l1: 3, l2: 1 },
  ...over,
});

beforeEach(() => {
  nav.pathname = '/account/orders/MC-1001';
});
afterEach(() => vi.unstubAllGlobals());

const render = (o: OrderDetailView | null, routes: Record<string, () => unknown> = {}) => {
  stubFetch({ '/api/auth/me': () => ({ customer }), ...routes });
  return renderShell(<OrderDetail orderNumber="MC-1001" initial={o} />);
};

describe('Order detail', () => {
  it('shows items, totals and the delivery address', async () => {
    render(order());
    expect(screen.getByTestId('order-number')).toHaveTextContent('MC-1001');
    expect(screen.getAllByTestId('order-line')).toHaveLength(2);
    expect(screen.getByText('$51.95')).toBeInTheDocument();
    expect(screen.getByTestId('shipping-address')).toHaveTextContent('100 Example Street');
    expect(screen.queryByTestId('order-tracker')).toBeNull();
  });

  it('Shipment state visible: a delivery shows the carrier link and the tracking number', () => {
    render(order({
      deliveries: [{ id: 'd1', createdAt: '2026-10-02T00:00:00.000Z', carrier: 'UPS', trackingId: '1Z999', trackingUrl: trackingUrl('UPS', '1Z999'), items: [{ lineId: 'l1', name: 'Ember pods', quantity: 3 }] }],
    }));
    const link = screen.getByRole('link', { name: 'Track parcel' });
    expect(link).toHaveAttribute('href', 'https://www.ups.com/track?tracknum=1Z999');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Tracking number 1Z999')).toBeInTheDocument();
    expect(screen.getByTestId('order-pill')).toHaveTextContent('Shipped');
  });

  it('Partial shipment: one block per delivery with its own items', () => {
    render(order({
      deliveries: [
        { id: 'd1', createdAt: '2026-10-02T00:00:00.000Z', carrier: 'UPS', trackingId: '1Z1', trackingUrl: null, items: [{ lineId: 'l1', name: 'Ember pods', quantity: 2 }] },
        { id: 'd2', createdAt: '2026-10-03T00:00:00.000Z', carrier: null, trackingId: null, trackingUrl: null, items: [{ lineId: 'l1', name: 'Ember pods', quantity: 1 }, { lineId: 'l2', name: 'Casa pods', quantity: 1 }] },
      ],
    }));
    const blocks = screen.getAllByTestId('delivery');
    expect(blocks).toHaveLength(2);
    expect(within(blocks[0]).getByText('Parcel 1')).toBeInTheDocument();
    expect(within(blocks[0]).queryByText('Casa pods', { exact: false })).toBeNull();
    expect(within(blocks[1]).getByText('Parcel 2')).toBeInTheDocument();
    expect(within(blocks[1]).getByText('Casa pods', { exact: false })).toBeInTheDocument();
  });

  it('Shipped line with no tracking shows the placeholder, not a dead link', () => {
    render(order({ deliveries: [{ id: 'd1', createdAt: '2026-10-02T00:00:00.000Z', carrier: null, trackingId: null, trackingUrl: null, items: [] }] }));
    expect(screen.getByText('Tracking will appear here')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Track parcel' })).toBeNull();
  });

  it('a tracking number from an unknown carrier is shown without a link', () => {
    render(order({ deliveries: [{ id: 'd1', createdAt: '2026-10-02T00:00:00.000Z', carrier: 'Local Courier', trackingId: 'ABC', trackingUrl: null, items: [] }] }));
    expect(screen.getByText('Tracking number ABC')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Track parcel' })).toBeNull();
  });

  it('a collect order shows the tracker and the collection card', () => {
    render(order({
      hasCollect: true, hasShip: false, status: 'ready', stateKey: 'ready-for-collection', shipmentState: null, shippingAddress: null,
      collect: { storeName: 'Malva SoHo', hours: '07:00–18:00', lat: 1, lng: 2, addressLine: '100 Example Street, New York', phone: '+1 212 555 0100' },
    }));
    expect(screen.getByTestId('order-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('collection-card')).toHaveTextContent('Malva SoHo');
    expect(screen.getByTestId('collection-card')).toHaveTextContent('+1 212 555 0100');
  });

  it('Detail of an order not theirs: the not-found card, no order data', async () => {
    render(null, { '/api/orders/number/': () => Response.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 }) });
    const card = await screen.findByTestId('order-not-found');
    expect(card).toHaveTextContent("We couldn't find that order.");
    expect(screen.queryByTestId('order-number')).toBeNull();
    expect(screen.queryByTestId('panel-error')).toBeNull();
  });

  it('another failure is a panel error with Try again', async () => {
    render(null, { '/api/orders/number/': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }) });
    expect(await screen.findByTestId('panel-error')).toBeInTheDocument();
    expect(screen.queryByTestId('order-not-found')).toBeNull();
  });
});

describe('ReturnList', () => {
  const item = (shipmentState: 'Advised' | 'Returned', paymentState: 'Initial' | 'Refunded') => ({
    id: 'ri1', lineId: 'l1', name: 'Ember pods', quantity: 1, reason: 'Damaged', shipmentState, paymentState,
  });

  it('Refund state visible: goods received and refund are separate chips', () => {
    renderShell(<ReturnList returns={[{ id: 'r1', createdAt: '2026-10-05T00:00:00.000Z', trackingId: null, items: [item('Returned', 'Refunded')] }]} />);
    expect(screen.getByTestId('return-goods-chip')).toHaveTextContent('Goods received');
    expect(screen.getByTestId('return-refund-chip')).toHaveTextContent('Refunded');
  });

  it('Two state machines are never merged: the chips change independently', () => {
    const { unmount } = renderShell(<ReturnList returns={[{ id: 'r1', createdAt: '', trackingId: null, items: [item('Returned', 'Initial')] }]} />);
    expect(screen.getByTestId('return-goods-chip')).toHaveTextContent('Goods received');
    expect(screen.getByTestId('return-refund-chip')).toHaveTextContent('Refund pending');
    unmount();
    renderShell(<ReturnList returns={[{ id: 'r1', createdAt: '', trackingId: null, items: [item('Advised', 'Initial')] }]} />);
    expect(screen.getByTestId('return-goods-chip')).toHaveTextContent('Return announced');
    expect(screen.getByTestId('return-refund-chip')).toHaveTextContent('Refund pending');
  });
});

describe('OrderStatusTracker', () => {
  const states = (state: Parameters<typeof OrderStatusTracker>[0]['state']) => {
    renderShell(<OrderStatusTracker state={state} />);
    return [...screen.getByTestId('order-tracker').querySelectorAll('li')].map((li) => li.getAttribute('data-state'));
  };
  it('ordered: first step active', () => expect(states('ordered')).toEqual(['active', 'todo', 'todo', 'todo']));
  it('a missing state counts as ordered', () => expect(states(null)).toEqual(['active', 'todo', 'todo', 'todo']));
  it('preparing', () => expect(states('preparing')).toEqual(['done', 'active', 'todo', 'todo']));
  it('ready', () => expect(states('ready-for-collection')).toEqual(['done', 'done', 'active', 'todo']));
  it('collected: all four done', () => expect(states('collected')).toEqual(['done', 'done', 'done', 'done']));
});

describe('DeliveryList', () => {
  it('renders nothing without deliveries', () => {
    const { container } = renderShell(<DeliveryList deliveries={[]} />);
    expect(container.querySelector('[data-testid="delivery"]')).toBeNull();
  });
});

describe('trackingUrl', () => {
  it('knows the shop carriers, encodes the id and returns null for the rest', () => {
    expect(trackingUrl('USPS', '94001')).toContain('tools.usps.com');
    expect(trackingUrl('FedEx', '12/34')).toContain('12%2F34');
    expect(trackingUrl('Canada Post', '7')).toContain('canadapost');
    expect(trackingUrl('Mystery', '1')).toBeNull();
    expect(trackingUrl('UPS', null)).toBeNull();
  });
});
