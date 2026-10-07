import { mapOrder } from '@/lib/mappers/order';
import { ctLine, ctOrder, kindAttrs, orderA, orderB, orderDevice, schedule, CABLE_SKU } from '@/test/fixtures/orders';
import { serializeSchedules } from '@/lib/pricing/schedule';
import type { Order, RecurringSummary } from '@/lib/types';
import { deriveActivePlans, deriveContractRows, deriveMonthlyBill, isActiveOrder, nextBillDate } from './contract';

const TODAY = '2026-10-07';
const map = (...orders: Parameters<typeof mapOrder>[0][]): Order[] => orders.map((order) => mapOrder(order, 'en-US'));
const summary = (originOrderId: string, state: RecurringSummary['state'], nextOrderAt?: string): RecurringSummary => ({ id: `r-${originOrderId}`, originOrderId, state, ...(nextOrderAt ? { nextOrderAt } : {}) });

describe('deriveContractRows', () => {
  it('the design demo orders give the design rows, newest start first, plans before add-ons', () => {
    const rows = deriveContractRows(map(orderB(), orderA()), null, TODAY);
    expect(rows.map((row) => [row.name, row.family, row.startedOn, row.termMonths, row.endsOn, row.monthly.centAmount])).toEqual([
      ['Cable 500', 'cable', '2026-03-12', 24, '2028-03-12', 5999],
      ['Apple TV+', 'addon', '2026-03-12', 0, null, 999],
      ['Unlimited', 'phone', '2025-06-03', 0, null, 5000],
      ['Spotify', 'addon', '2025-06-03', 0, null, 1000],
    ]);
  });

  it('a cancelled order is not part of the contract', () => {
    expect(deriveContractRows(map(orderA({ orderState: 'Cancelled' }), orderB()), null, TODAY).map((row) => row.orderNumber)).toEqual(['QA-BBBB02', 'QA-BBBB02']);
  });

  it('an order whose recurring orders are all Expired or Canceled is excluded, one with an Active one stays', () => {
    const [a, b] = map(orderA(), orderB());
    const recurring = [summary(a!.id, 'Expired'), summary(a!.id, 'Canceled'), summary(b!.id, 'Canceled'), summary(b!.id, 'Active')];
    expect(deriveContractRows([a!, b!], recurring, TODAY).map((row) => row.orderNumber)).toEqual(['QA-BBBB02', 'QA-BBBB02']);
    expect(isActiveOrder(a!, recurring)).toBe(false);
    expect(isActiveOrder(b!, recurring)).toBe(true);
  });

  it('device installments: the term and end date come from the line, the row price is the monthly installment', () => {
    const rows = deriveContractRows(map(orderDevice()), null, TODAY);
    const device = rows.find((row) => row.family === 'installments');
    expect(device).toMatchObject({ name: 'Nova Pro', termMonths: 24, endsOn: '2028-04-02', monthly: { centAmount: 4200 }, deviceVariant: { memoryGb: '256', color: 'black' } });
  });

  it('paid-off installments and an outright device are not rows; neither is a purchased router', () => {
    const outright = ctOrder({
      orderNumber: 'QA-OUT',
      total: 90000,
      lines: [
        ctLine({ id: 'o1', productKey: 'malva-offer-phone-nova-5g', sku: 'MLV-DEV-NOVA5G-BLK-128', name: 'Nova 5G', total: 79900, attributes: kindAttrs('device', 'phone'), fields: { acquisitionMode: 'outright' } }),
        ctLine({ id: 'o2', productKey: 'malva-offer-router-ax3000', sku: 'MLV-EQP-AX3000', name: 'Router AX3000', total: 10000, attributes: kindAttrs('equipment', 'equipment') }),
      ],
    });
    expect(deriveContractRows(map(outright), null, TODAY)).toEqual([]);
    expect(deriveContractRows(map(orderDevice()), null, '2028-05-01').map((row) => row.family)).toEqual(['phone']);
  });

  it('the price of a row is the schedule amount on the date, with the after-term price once the term is over', () => {
    const [order] = map(orderA());
    expect(deriveContractRows([order!], null, '2026-03-20')[0]?.monthly.centAmount).toBe(0); // intro month
    expect(deriveContractRows([order!], null, '2026-10-07')[0]?.monthly.centAmount).toBe(5999);
    expect(deriveContractRows([order!], null, '2028-06-01')[0]?.monthly.centAmount).toBe(6999); // after-term month-to-month price
  });

  it('falls back to the line total when the schedule does not cover the date, or is not active', () => {
    const early = deriveContractRows(map(orderA()), null, '2026-01-01')[0];
    expect(early?.monthly.centAmount).toBe(5999);
    const amended = ctOrder({
      orderNumber: 'QA-AM',
      total: 1,
      lines: [ctLine({ id: 'x', productKey: 'malva-offer-cable-500', sku: CABLE_SKU, name: 'Cable 500', total: 4000, recurring: 'Fixed', attributes: kindAttrs('base-package', 'cable') })],
      fields: { priceSchedule: serializeSchedules([schedule({ sku: CABLE_SKU, offerKey: 'malva-offer-cable-500', term: 24, orderDate: '2026-03-07', amounts: [[9999, 'standing', 24]], status: 'amended' })]) },
    });
    expect(deriveContractRows(map(amended), null, TODAY)[0]?.monthly.centAmount).toBe(4000);
  });
});

describe('deriveMonthlyBill', () => {
  it('is the sum of the current row prices and the currency of the rows', () => {
    const rows = deriveContractRows(map(orderA(), orderB()), null, TODAY);
    expect(deriveMonthlyBill(rows, 'USD')).toEqual({ centAmount: 5999 + 999 + 5000 + 1000, currencyCode: 'USD' });
  });
  it('is zero in the given currency without rows', () => {
    expect(deriveMonthlyBill([], 'EUR')).toEqual({ centAmount: 0, currencyCode: 'EUR' });
  });
});

describe('nextBillDate', () => {
  it('is the earliest nextOrderAt among Active recurring orders', () => {
    const list = [summary('1', 'Active', '2026-12-07T00:00:00Z'), summary('2', 'Active', '2026-11-07T00:00:00Z'), summary('3', 'Paused', '2026-10-08T00:00:00Z'), summary('4', 'Canceled', '2026-10-09T00:00:00Z')];
    expect(nextBillDate(list)).toBe('2026-11-07T00:00:00Z');
  });
  it('is null when nothing is Active', () => {
    expect(nextBillDate([summary('1', 'Failed', '2026-11-07T00:00:00Z')])).toBeNull();
    expect(nextBillDate([])).toBeNull();
  });
});

describe('deriveActivePlans', () => {
  it('lists plan lines with the label stored on their order, never add-ons', () => {
    const plans = deriveActivePlans(map(orderB(), orderA()), null, TODAY);
    expect(plans.map((plan) => [plan.name, plan.label?.id])).toEqual([
      ['Cable 500', 'MLV-CA-101'],
      ['Unlimited', 'MLV-PH-301'],
    ]);
  });
  it('a plan of an order without a snapshot has a null label', () => {
    const plans = deriveActivePlans(map(orderDevice()), null, TODAY);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.label).toBeNull();
  });
});
