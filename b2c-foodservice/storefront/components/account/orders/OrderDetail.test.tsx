import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import DeliveryList from '@/components/account/orders/DeliveryList';
import OrderDetail from '@/components/account/orders/OrderDetail';
import ReturnList from '@/components/account/orders/ReturnList';
import { trackingUrl } from '@/lib/account/tracking';
import { orderView } from '@/test/checkout';
import { nav, renderShell, stubFetch } from '@/test/shell';
import type { OrderView } from '@/lib/types';

const customer = { id: 'c1', email: 'a@example.com', firstName: 'Maya', lastName: 'O', defaultShippingAddressId: null, addresses: [] };
const recipient = { name: 'Maya Okonkwo', line: '100 Example Street', city: 'New York', state: 'NY', postalCode: '10012', country: 'US' };
const order = (over: Partial<OrderView> = {}): OrderView =>
  orderView({
    id: 'o1', orderNumber: 'MC-1001', customerId: 'c1', createdAt: '2026-10-01T10:00:00.000Z', currency: 'USD', status: 'shipped',
    state: null, shipmentState: 'Shipped', paymentState: 'Paid', hasCollect: false, hasShip: true,
    lines: [
    { id: 'l1', sku: 'S1', name: 'Ember pods', variantSummary: '', imageUrl: null, quantity: 3, unitCents: 1000, priceCents: 3000, fulfilment: 'delivery', storeKey: null, storeName: null, recurrence: null },
    { id: 'l2', sku: 'S2', name: 'Casa pods', variantSummary: '', imageUrl: null, quantity: 1, unitCents: 1500, priceCents: 1500, fulfilment: 'delivery', storeKey: null, storeName: null, recurrence: null },
  ],
    ship: { methodName: 'Standard', estimate: null, address: '', recipient },
    totals: { subtotalCents: 4500, discountCents: 0, shippingCents: 695, taxCents: 360, totalCents: 5195 },
    returnable: { l1: 3, l2: 1 },
    ...over,
  });

beforeEach(() => {
  nav.pathname = '/account/orders/MC-1001';
});
afterEach(() => vi.unstubAllGlobals());

const render = (o: OrderView | null, routes: Record<string, () => unknown> = {}) => {
  stubFetch({ '/api/auth/me': () => ({ customer }), ...routes });
  return renderShell(<OrderDetail orderId="o1" orderNumber="MC-1001" initial={o} />);
};

describe('Order detail', () => {
  it('shows items, totals and the delivery address', async () => {
    render(order());
    expect(screen.getByTestId('order-number')).toHaveTextContent('MC-1001');
    expect(screen.getAllByTestId('order-line')).toHaveLength(2);
    expect(screen.getByText('$51.95')).toBeInTheDocument();
    expect(screen.getByTestId('shipping-address')).toHaveTextContent('100 Example Street');
    expect(screen.queryByTestId('order-track')).toBeNull();
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
      hasCollect: true, hasShip: false, status: 'ready', state: 'ready-for-collection', shipmentState: null, ship: null,
      collect: [{ storeKey: 'mcf-store-nyc-soho', storeName: 'Malva SoHo', hours: '07:00–18:00', lat: 1, lng: 2, address: '100 Example Street, New York', phone: '+1 212 555 0100', readyMinutes: null, pickupName: null }],
    }));
    expect(screen.getByTestId('order-track')).toHaveAttribute('data-state', 'ready-for-collection');
    expect(screen.getByTestId('collection-card')).toHaveTextContent('Malva SoHo');
    expect(screen.getByTestId('collection-card')).toHaveTextContent('+1 212 555 0100');
  });

  it('Detail of an order not theirs: the not-found card, no order data', async () => {
    render(null, { '/api/orders/o1': () => Response.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 }) });
    const card = await screen.findByTestId('order-not-found');
    expect(card).toHaveTextContent("We couldn't find that order.");
    expect(screen.queryByTestId('order-number')).toBeNull();
    expect(screen.queryByTestId('panel-error')).toBeNull();
  });

  it('another failure is a panel error with Try again', async () => {
    render(null, { '/api/orders/o1': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }) });
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

describe('Order tracker on the detail (the shared OrderStatusTrack)', () => {
  it('a collect order with no state yet counts as ordered', () => {
    render(order({ hasCollect: true, hasShip: false, status: 'ordered', state: null, ship: null }));
    expect(screen.getByTestId('order-track')).toHaveAttribute('data-state', 'ordered');
    expect(screen.getByTestId('order-track').querySelector('[data-node="ordered"]')).toHaveAttribute('data-status', 'current');
  });
  it('collected: all four nodes done', () => {
    render(order({ hasCollect: true, hasShip: false, status: 'completed', state: 'collected', ship: null }));
    const nodes = [...screen.getByTestId('order-track').querySelectorAll('li')].map((li) => li.getAttribute('data-status'));
    expect(nodes).toEqual(['done', 'done', 'done', 'done']);
  });
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
