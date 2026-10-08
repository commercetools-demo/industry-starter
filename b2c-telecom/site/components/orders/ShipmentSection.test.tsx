import { screen, within } from '@testing-library/react';
import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { mapOrder } from '@/lib/mappers/order';
import { orderA, orderDevice } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import { ShipmentSection } from './ShipmentSection';

const withShipping = (order: CtOrder, deliveries: unknown[], shipmentState?: string): CtOrder =>
  ({ ...order, ...(shipmentState ? { shipmentState } : {}), shippingInfo: { deliveries } }) as unknown as CtOrder;
const view = (order: CtOrder, locale: 'en-US' | 'de-DE' = 'en-US') => renderWithProviders(<ShipmentSection order={mapOrder(order, locale)} />, { locale });

// two shipments: one with two parcels (the second one has no items of its own), one with a single parcel
const TWO = [
  {
    id: 'del-1',
    createdAt: '2026-05-03T09:00:00.000Z',
    items: [{ id: 'd1', quantity: 1 }],
    parcels: [
      { id: 'p1', createdAt: '2026-05-03T09:00:00.000Z', trackingData: { trackingId: 'DP000111', carrier: 'DemoPost' }, items: [{ id: 'd1', quantity: 1 }] },
      { id: 'p2', createdAt: '2026-05-03T09:00:00.000Z', trackingData: { trackingId: 'DP000222', carrier: 'DemoPost' }, items: [{ id: 'd2', quantity: 1 }] },
    ],
  },
  { id: 'del-2', createdAt: '2026-05-04T09:00:00.000Z', items: [{ id: 'd2', quantity: 1 }], parcels: [{ id: 'p3', createdAt: '2026-05-04T09:00:00.000Z' }] },
];

describe('ShipmentSection', () => {
  it('Shipment state visible: the shipment and its tracking reference are shown against its items', () => {
    view(withShipping(orderDevice(), [TWO[0]], 'Delivered'));
    expect(screen.getByRole('heading', { level: 2, name: 'Shipments' })).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    const parcel = screen.getAllByTestId('parcel')[0] as HTMLElement;
    expect(within(parcel).getByText('DP000111')).toBeInTheDocument();
    expect(within(parcel).getByText(/Carrier/)).toBeInTheDocument();
    expect(within(parcel).getByText('1 × Unlimited')).toBeInTheDocument();
  });

  it('Partial shipment: each parcel and its items are distinguishable, not one aggregate status', () => {
    view(withShipping(orderDevice(), TWO, 'Partial'));
    expect(screen.getByText('Partly shipped')).toBeInTheDocument();
    expect(screen.getByText('Shipment 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Shipment 2 of 2')).toBeInTheDocument();
    const parcels = screen.getAllByTestId('parcel');
    expect(parcels).toHaveLength(3);
    expect(within(parcels[0] as HTMLElement).getByText('Parcel 1 of 2')).toBeInTheDocument();
    expect(within(parcels[0] as HTMLElement).getByText('1 × Unlimited')).toBeInTheDocument();
    expect(within(parcels[1] as HTMLElement).getByText('Parcel 2 of 2')).toBeInTheDocument();
    expect(within(parcels[1] as HTMLElement).getByText('DP000222')).toBeInTheDocument();
    expect(within(parcels[1] as HTMLElement).getByText('1 × Nova Pro')).toBeInTheDocument();
    expect(within(parcels[1] as HTMLElement).queryByText('1 × Unlimited')).not.toBeInTheDocument();
    // a parcel without items of its own: the items of its delivery are listed under the delivery
    expect(within(screen.getAllByTestId('delivery')[1] as HTMLElement).getByText('1 × Nova Pro')).toBeInTheDocument();
  });

  it('says so when nothing has shipped yet', () => {
    view(orderDevice());
    expect(screen.getByText('Nothing has shipped yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('delivery')).not.toBeInTheDocument();
  });

  it('is hidden for an order without anything that ships', () => {
    view(orderA());
    expect(screen.queryByRole('heading', { level: 2, name: 'Shipments' })).not.toBeInTheDocument();
  });

  it('shows a missing tracking reference as text', () => {
    view(withShipping(orderDevice(), [TWO[1]], 'Shipped'));
    expect(screen.getByText('Tracking reference not available yet')).toBeInTheDocument();
  });

  it('is translated to German', () => {
    view(withShipping(orderDevice(), TWO, 'Partial'), 'de-DE');
    expect(screen.getByRole('heading', { level: 2, name: 'Sendungen' })).toBeInTheDocument();
    expect(screen.getByText('Teilweise versendet')).toBeInTheDocument();
    expect(screen.getByText('Sendung 1 von 2')).toBeInTheDocument();
    expect(screen.getAllByText('Paket 1 von 2')).toHaveLength(1);
  });
});
