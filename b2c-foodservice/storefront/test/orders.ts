import type { Channel, LineItem, Order } from '@commercetools/platform-sdk';

const money = (centAmount: number, currencyCode = 'USD') => ({ type: 'centPrecision' as const, currencyCode, centAmount, fractionDigits: 2 });

/** A seeded store channel as an expanded `supplyChannel.obj`. Open every day 07:00 to 18:00. */
export const storeChannel = (over: Partial<Channel> = {}): Channel =>
  ({
    id: 'ch-soho', version: 1, key: 'mcf-store-nyc-soho', roles: ['InventorySupply'],
    name: { 'en-US': 'Malva SoHo' },
    address: { country: 'US', streetNumber: '100', streetName: 'Example Street', city: 'New York', postalCode: '10012', phone: '+1 212 555 0100' },
    geoLocation: { type: 'Point', coordinates: [-74.0, 40.72] },
    custom: {
      type: { typeId: 'type', id: 't' },
      fields: {
        hours: JSON.stringify(Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { open: '07:00', close: '18:00' }]))),
        collectionMinutes: 15,
      },
    },
    createdAt: '2026-01-01T00:00:00.000Z', lastModifiedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as unknown as Channel;

export const ctLine = (id: string, over: Record<string, unknown> = {}): LineItem =>
  ({
    id, productId: `p-${id}`, name: { 'en-US': `Product ${id}` }, quantity: 2,
    variant: { id: 1, sku: `SKU-${id}`, images: [{ url: `https://img.example.com/${id}.jpg`, dimensions: { w: 1, h: 1 } }] },
    price: { id: 'pr', value: money(1000) }, totalPrice: money(2000),
    custom: { type: { typeId: 'type', id: 't' }, fields: { fulfilment: 'delivery' } },
    ...over,
  }) as unknown as LineItem;

export const collectLine = (id: string, over: Record<string, unknown> = {}): LineItem =>
  ctLine(id, {
    supplyChannel: { typeId: 'channel', id: 'ch-soho', obj: storeChannel() },
    custom: { type: { typeId: 'type', id: 't' }, fields: { fulfilment: 'collect' } },
    ...over,
  });

/** A commercetools-shaped order. `stateKey` is the short key (`ready-for-collection`) of the expanded state. */
export function ctOrder(over: Record<string, unknown> & { stateKey?: string } = {}): Order {
  const { stateKey, ...rest } = over;
  return {
    id: 'o1', version: 3, orderNumber: 'MC-1001', customerId: 'c1', createdAt: '2026-10-01T10:00:00.000Z', lastModifiedAt: '2026-10-02T10:00:00.000Z',
    orderState: 'Open', lineItems: [ctLine('l1')], customLineItems: [],
    totalPrice: money(2000), taxedPrice: { totalNet: money(1850), totalGross: money(2000), totalTax: money(150), taxPortions: [] },
    shippingMode: 'Single', shipping: [],
    ...(stateKey ? { state: { typeId: 'state', id: `st-${String(stateKey)}`, obj: { id: `st-${String(stateKey)}`, key: `mcf-order-${String(stateKey)}` } } } : {}),
    ...rest,
  } as unknown as Order;
}
