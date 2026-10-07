import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { serializeSchedules } from '@/lib/pricing/schedule';
import type { BroadbandLabelData, LabelSnapshot, PriceSchedule } from '@/lib/types';

// SDK-shaped orders for the mapper, dashboard and order tests. `customerId` is "cust-alex" unless overridden.

export const usd = (centAmount: number) => ({ type: 'centPrecision' as const, centAmount, currencyCode: 'USD', fractionDigits: 2 });

export interface LineFixture {
  id: string;
  productKey: string;
  sku: string;
  name: string;
  total: number;
  quantity?: number;
  recurring?: 'Fixed' | 'Dynamic' | null;
  attributes?: { name: string; value: unknown }[];
  fields?: Record<string, unknown>;
}

export function ctLine(line: LineFixture) {
  return {
    id: line.id,
    productKey: line.productKey,
    name: { 'en-US': line.name, 'de-DE': line.name },
    quantity: line.quantity ?? 1,
    totalPrice: usd(line.total),
    variant: { id: 1, sku: line.sku, attributes: line.attributes ?? [] },
    ...(line.recurring ? { recurrenceInfo: { priceSelectionMode: line.recurring, recurrencePolicy: { typeId: 'recurrence-policy', id: 'p1' } } } : {}),
    custom: { type: { typeId: 'type', id: 't' }, fields: { offerKey: line.productKey, ...(line.fields ?? {}) } },
  };
}

export interface OrderFixture {
  id?: string;
  orderNumber: string;
  createdAt?: string;
  orderState?: string;
  shipmentState?: string;
  customerId?: string | null;
  total: number;
  lines: ReturnType<typeof ctLine>[];
  fields?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
}

export function ctOrder(order: OrderFixture): CtOrder {
  return {
    id: order.id ?? `id-${order.orderNumber}`,
    version: 1,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt ?? '2026-03-07T10:00:00.000Z',
    orderState: order.orderState ?? 'Open',
    ...(order.shipmentState ? { shipmentState: order.shipmentState } : {}),
    ...(order.customerId === null ? {} : { customerId: order.customerId ?? 'cust-alex' }),
    origin: 'Customer',
    totalPrice: usd(order.total),
    lineItems: order.lines,
    customLineItems: [],
    shippingAddress: order.shippingAddress ?? { id: 'addr-1', firstName: 'Alex', lastName: 'Rivera', streetNumber: '1', streetName: 'Main St', postalCode: '10001', city: 'New York', state: 'NY', country: 'US' },
    custom: { type: { typeId: 'type', id: 'ot' }, fields: order.fields ?? {} },
  } as unknown as CtOrder;
}

export const kindAttrs = (offerKind: string, offerFamily: string) => [
  { name: 'offer-kind', value: { key: offerKind, label: offerKind } },
  { name: 'offer-family', value: { key: offerFamily, label: offerFamily } },
];

export function label(id: string, planName: string): BroadbandLabelData {
  return { id, planName, kind: 'Cable internet', price: '$59.99', priceNote: 'per month', monthlyFees: [{ k: 'Modem', v: '$0.00' }], oneTime: [{ k: 'Activation fee', v: '$25.00' }], etf: 'None', discounts: 'None', speeds: [{ k: 'Typical download', v: '500 Mbps' }], data: 'Unlimited' };
}

export function snapshot(entries: { sku: string; offerKey: string; label: BroadbandLabelData }[]): string {
  const value: LabelSnapshot = { v: 1, takenAt: '2026-03-07T10:00:00.000Z', locale: 'en-US', currencyCode: 'USD', labels: entries };
  return JSON.stringify(value);
}

export function schedule(opts: { sku: string; offerKey: string; term: 0 | 12 | 24; orderDate: string; amounts: [number, 'intro' | 'standing' | 'step', number][]; status?: PriceSchedule['status'] }): PriceSchedule {
  let from = 1;
  const periods = opts.amounts.map(([cents, kind, months], i) => {
    const period = {
      index: i + 1,
      fromMonth: from,
      toMonth: months === 0 ? 0 : from + months - 1,
      months,
      startsOn: addMonthsIso(opts.orderDate, from - 1),
      endsOn: months === 0 ? '9999-12-31' : addDaysIso(addMonthsIso(opts.orderDate, from - 1 + months), -1),
      monthlyAmount: { centAmount: cents, currencyCode: 'USD' },
      kind,
    };
    from += months;
    return period;
  });
  return {
    v: 1,
    offerKey: opts.offerKey,
    sku: opts.sku,
    termMonths: opts.term,
    quantity: 1,
    currencyCode: 'USD',
    priceMode: opts.term === 0 ? 'Dynamic' : 'Fixed',
    orderDate: opts.orderDate,
    periods,
    openEnded: opts.term === 0,
    totalContractValue: opts.term === 0 ? null : { centAmount: periods.reduce((sum, p) => sum + p.months * p.monthlyAmount.centAmount, 0), currencyCode: 'USD' },
    dueAtOrder: periods[0]!.monthlyAmount,
    afterTerm: opts.term === 0 ? null : { startsOn: addMonthsIso(opts.orderDate, opts.term), monthlyAmount: { centAmount: 6999, currencyCode: 'USD' }, basis: 'month-to-month-price' },
    introEndsOn: null,
    status: opts.status ?? 'active',
  };
}

function addMonthsIso(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const CABLE_SKU = 'MLV-CBL-500-24M';
export const PHONE_SKU = 'MLV-PHN-UNL-M2M';

/** Order A of the design demo: Cable 500 (24 months, three price periods) + Apple TV+, service start 2026-03-12. */
export function orderA(overrides: Partial<OrderFixture> = {}): CtOrder {
  return ctOrder({
    orderNumber: 'QA-AAAA01',
    createdAt: '2026-03-07T10:00:00.000Z',
    total: 6998,
    lines: [
      ctLine({ id: 'a1', productKey: 'malva-offer-cable-500', sku: CABLE_SKU, name: 'Cable 500', total: 5999, recurring: 'Fixed', attributes: kindAttrs('base-package', 'cable') }),
      ctLine({ id: 'a2', productKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', total: 999, recurring: 'Dynamic', attributes: kindAttrs('addon', 'addon'), fields: { parentLineItemId: 'a1' } }),
    ],
    fields: {
      serviceStartDate: '2026-03-12',
      priceSchedule: serializeSchedules([schedule({ sku: CABLE_SKU, offerKey: 'malva-offer-cable-500', term: 24, orderDate: '2026-03-07', amounts: [[0, 'intro', 1], [5999, 'standing', 23]] })]),
      labelSnapshot: snapshot([{ sku: CABLE_SKU, offerKey: 'malva-offer-cable-500', label: label('MLV-CA-101', 'Cable 500') }]),
    },
    ...overrides,
  });
}

/** Order B of the design demo: Unlimited (month-to-month) + Spotify, service start 2025-06-03. */
export function orderB(overrides: Partial<OrderFixture> = {}): CtOrder {
  return ctOrder({
    orderNumber: 'QA-BBBB02',
    createdAt: '2025-06-03T10:00:00.000Z',
    total: 6000,
    lines: [
      ctLine({ id: 'b1', productKey: 'malva-offer-phone-unlimited', sku: PHONE_SKU, name: 'Unlimited', total: 5000, recurring: 'Dynamic', attributes: kindAttrs('base-package', 'phone') }),
      ctLine({ id: 'b2', productKey: 'malva-offer-spotify', sku: 'MLV-ADD-SPOTIFY-MTH', name: 'Spotify', total: 1000, recurring: 'Dynamic', attributes: kindAttrs('addon', 'addon'), fields: { parentLineItemId: 'b1' } }),
    ],
    fields: {
      serviceStartDate: '2025-06-03',
      priceSchedule: serializeSchedules([schedule({ sku: PHONE_SKU, offerKey: 'malva-offer-phone-unlimited', term: 0, orderDate: '2025-06-03', amounts: [[5000, 'standing', 0]] })]),
      labelSnapshot: snapshot([{ sku: PHONE_SKU, offerKey: 'malva-offer-phone-unlimited', label: label('MLV-PH-301', 'Unlimited') }]),
    },
    ...overrides,
  });
}

export const NOVA_SKU = 'MLV-DEV-NOVAPRO-BLK-256';

/** A handset on 24 installments plus a phone plan. */
export function orderDevice(overrides: Partial<OrderFixture> = {}): CtOrder {
  return ctOrder({
    orderNumber: 'QA-DDDD04',
    createdAt: '2026-05-02T10:00:00.000Z',
    total: 9200,
    lines: [
      ctLine({ id: 'd1', productKey: 'malva-offer-phone-unlimited', sku: PHONE_SKU, name: 'Unlimited', total: 5000, recurring: 'Dynamic', attributes: kindAttrs('base-package', 'phone') }),
      ctLine({ id: 'd2', productKey: 'malva-offer-phone-nova-pro', sku: NOVA_SKU, name: 'Nova Pro', total: 4200, recurring: 'Fixed', attributes: kindAttrs('device', 'phone'), fields: { acquisitionMode: 'installments', acquisitionTermMonths: 24 } }),
    ],
    fields: { serviceStartDate: '2026-05-02' },
    ...overrides,
  });
}
