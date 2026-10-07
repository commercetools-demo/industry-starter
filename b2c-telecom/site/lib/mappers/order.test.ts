import { ctLine, ctOrder, kindAttrs, orderA, orderB, orderDevice, CABLE_SKU, NOVA_SKU } from '@/test/fixtures/orders';
import { classifyLine, deviceVariantOf, mapAddress, mapOrder, mapOrderListItem, parseLabelSnapshot, parseSchedule, statusOf, termFromSku } from './order';

describe('statusOf', () => {
  it.each([
    [{ orderState: 'Cancelled', shipmentState: 'Delivered' }, 'cancelled'],
    [{ orderState: 'Complete', shipmentState: 'Delivered' }, 'delivered'],
    [{ orderState: 'Confirmed', shipmentState: 'Shipped' }, 'shipped'],
    [{ orderState: 'Complete' }, 'completed'],
    [{ orderState: 'Confirmed' }, 'processing'],
    [{ orderState: 'Open' }, 'placed'],
    [{ orderState: 'Archived' }, 'unknown'],
  ])('maps %j to %s', (input, expected) => {
    expect(statusOf(input)).toBe(expected);
  });
});

describe('classifyLine', () => {
  it('uses the saved offer-kind and offer-family attributes first', () => {
    expect(classifyLine({ productKey: 'whatever', offerKind: 'base-package', offerFamily: 'fixed-wireless' })).toEqual({ kind: 'internet-plan', family: 'wireless' });
    expect(classifyLine({ offerKind: 'base-package', offerFamily: 'phone' })).toEqual({ kind: 'phone-plan', family: 'phone' });
    expect(classifyLine({ offerKind: 'addon' })).toEqual({ kind: 'addon', family: 'addon' });
    expect(classifyLine({ offerKind: 'equipment' })).toEqual({ kind: 'equipment', family: 'equipment' });
    expect(classifyLine({ offerKind: 'device' })).toEqual({ kind: 'device', family: 'outright' });
  });

  it.each([
    ['malva-offer-cable-500', 'internet-plan', 'cable'],
    ['malva-offer-wireless-5g', 'internet-plan', 'wireless'],
    ['malva-offer-phone-unlimited', 'phone-plan', 'phone'],
    ['malva-offer-phone-nova-pro', 'device', 'outright'],
    ['malva-offer-router-ax3000', 'equipment', 'equipment'],
    ['malva-offer-mesh-be9300', 'equipment', 'equipment'],
    ['malva-offer-modem-docsis31', 'equipment', 'equipment'],
    ['malva-offer-5g-gateway', 'equipment', 'equipment'],
    ['malva-offer-spotify', 'addon', 'addon'],
    ['malva-offer-device-protect', 'addon', 'addon'],
    ['malva-offer-cloud-200', 'addon', 'addon'],
    ['malva-qa-something', 'other', 'other'],
  ])('classifies %s by its product key prefix', (productKey, kind, family) => {
    expect(classifyLine({ productKey })).toEqual({ kind, family });
  });
});

describe('sku helpers', () => {
  it('reads the term from the sku suffix', () => {
    expect(termFromSku('MLV-CBL-500-24M')).toBe(24);
    expect(termFromSku('MLV-AIR-5G-12M')).toBe(12);
    expect(termFromSku('MLV-PHN-UNL-M2M')).toBe(0);
    expect(termFromSku('MLV-ADD-SPOTIFY-MTH')).toBe(0);
    expect(termFromSku('MLV-DEV-NOVAPRO-BLK-256')).toBeNull();
  });
  it('reads memory and colour of a handset sku', () => {
    expect(deviceVariantOf('MLV-DEV-NOVAPRO-VLT-512')).toEqual({ memoryGb: '512', color: 'violet' });
    expect(deviceVariantOf('MLV-DEV-NOVA5G-SLV-128-BASE')).toEqual({ memoryGb: '128', color: 'silver' });
    expect(deviceVariantOf('MLV-CBL-500-24M')).toBeNull();
  });
});

describe('mapOrder', () => {
  it('maps number, status, dates, totals and the standing monthly amount (not the intro price)', () => {
    const order = mapOrder(orderA(), 'en-US');
    expect(order.orderNumber).toBe('QA-AAAA01');
    expect(order.status).toBe('placed');
    expect(order.serviceStartDate).toBe('2026-03-12');
    expect(order.total).toEqual({ centAmount: 6998, currencyCode: 'USD' });
    expect(order.monthly).toEqual({ centAmount: 5999 + 999, currencyCode: 'USD' });
    expect(order.lines.map((line) => [line.name, line.kind, line.family, line.termMonths, line.recurring, line.priceMode])).toEqual([
      ['Cable 500', 'internet-plan', 'cable', 24, true, 'Fixed'],
      ['Apple TV+', 'addon', 'addon', 0, true, 'Dynamic'],
    ]);
    expect(order.lines[1]?.parentLineId).toBe('a1');
  });

  it('falls back to the order date when the service start field is missing or not a date', () => {
    expect(mapOrder(ctOrder({ orderNumber: 'X1', total: 0, lines: [], fields: {} }), 'en-US').serviceStartDate).toBe('2026-03-07');
    expect(mapOrder(ctOrder({ orderNumber: 'X2', total: 0, lines: [], fields: { serviceStartDate: '2026-02-31' } }), 'en-US').serviceStartDate).toBe('2026-03-07');
  });

  it('reads the acquisition of a device line from its custom fields and computes the end date', () => {
    const order = mapOrder(orderDevice(), 'en-US');
    const device = order.lines.find((line) => line.kind === 'device');
    expect(device?.family).toBe('installments');
    expect(device?.acquisition).toEqual({ mode: 'installments', termMonths: 24, endDate: '2028-04-02' });
    expect(device?.deviceVariant).toEqual({ memoryGb: '256', color: 'black' });
    expect(device?.termMonths).toBe(24);
    expect(device?.sku).toBe(NOVA_SKU);
  });

  it('uses the line own acquisitionEndDate field when it is a date, and never infers a mode from a price', () => {
    const own = mapOrder(
      ctOrder({
        orderNumber: 'X3',
        total: 1,
        lines: [ctLine({ id: 'l', productKey: 'malva-offer-phone-nova-5g', sku: 'MLV-DEV-NOVA5G-BLK-128', name: 'Nova 5G', total: 1, fields: { acquisitionMode: 'lease', acquisitionTermMonths: 24, acquisitionEndDate: '2028-05-01' } })],
      }),
      'en-US',
    );
    expect(own.lines[0]?.acquisition).toEqual({ mode: 'lease', termMonths: 24, endDate: '2028-05-01' });
    expect(own.lines[0]?.family).toBe('lease');
    const none = mapOrder(ctOrder({ orderNumber: 'X4', total: 1, lines: [ctLine({ id: 'l', productKey: 'malva-offer-phone-nova-5g', sku: 'MLV-DEV-NOVA5G-BLK-128', name: 'Nova 5G', total: 79900 })] }), 'en-US');
    expect(none.lines[0]?.acquisition).toBeNull();
    expect(none.lines[0]?.family).toBe('outright');
  });

  it('keeps the stored label snapshot and schedules, and has no label for add-ons', () => {
    const order = mapOrder(orderA(), 'en-US');
    expect(order.labels?.map((entry) => entry.label.id)).toEqual(['MLV-CA-101']);
    expect(order.labels?.some((entry) => entry.sku === 'MLV-ADD-APPLETV-MTH')).toBe(false);
    expect(order.schedules.map((schedule) => schedule.sku)).toEqual([CABLE_SKU]);
  });

  it('bad JSON in the custom fields gives null labels and no schedules, never throws', () => {
    const order = mapOrder(ctOrder({ orderNumber: 'X5', total: 0, lines: [], fields: { labelSnapshot: '{not json', priceSchedule: '[1,2' } }), 'en-US');
    expect(order.labels).toBeNull();
    expect(order.schedules).toEqual([]);
  });

  it('a guest-style order without shipping address maps to null', () => {
    const order = ctOrder({ orderNumber: 'X6', total: 0, lines: [] });
    delete (order as unknown as { shippingAddress?: unknown }).shippingAddress;
    expect(mapOrder(order, 'en-US').shippingAddress).toBeNull();
  });
});

describe('parse helpers', () => {
  it('parseLabelSnapshot returns null for anything that is not a v1 snapshot', () => {
    expect(parseLabelSnapshot(undefined)).toBeNull();
    expect(parseLabelSnapshot('')).toBeNull();
    expect(parseLabelSnapshot('{"v":2}')).toBeNull();
    expect(parseLabelSnapshot('{"v":1,"takenAt":"x","locale":"en-US","currencyCode":"USD","labels":[{"sku":"a"}]}')).toBeNull();
  });
  it('parseSchedule returns an empty list for anything that is not a v1 schedule list', () => {
    expect(parseSchedule(undefined)).toEqual([]);
    expect(parseSchedule('nope')).toEqual([]);
    expect(parseSchedule('{"v":1,"schedules":[{"v":1}]}')).toEqual([]);
  });
});

describe('mapOrderListItem', () => {
  it('names the first two lines and counts the rest', () => {
    const item = mapOrderListItem(
      mapOrder(
        ctOrder({
          orderNumber: 'X7',
          total: 100,
          lines: [1, 2, 3, 4].map((n) => ctLine({ id: `l${n}`, productKey: 'malva-offer-spotify', sku: 'MLV-ADD-SPOTIFY-MTH', name: `Item ${n}`, total: 100, attributes: kindAttrs('addon', 'addon') })),
        }),
        'en-US',
      ),
    );
    expect(item.itemNames).toEqual(['Item 1', 'Item 2']);
    expect(item.more).toBe(2);
    expect(mapOrderListItem(mapOrder(orderB(), 'en-US')).more).toBe(0);
  });
});

describe('mapAddress', () => {
  it('puts the number first in the US and last in Germany', () => {
    expect(mapAddress({ id: 'a', streetNumber: '10', streetName: 'Unter den Linden', city: 'Berlin', postalCode: '10115', country: 'DE' }).line1).toBe('Unter den Linden 10');
    expect(mapAddress({ id: 'a', streetNumber: '245', streetName: 'Peachtree St NE', city: 'Atlanta', postalCode: '30309', country: 'US' }, 'a')).toMatchObject({ line1: '245 Peachtree St NE', isDefaultShipping: true });
  });
});
