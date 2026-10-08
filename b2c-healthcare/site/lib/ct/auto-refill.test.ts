// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rec = vi.hoisted(() => ({ createRecurringFromLines: vi.fn(), listRecurring: vi.fn() }));
vi.mock('@/lib/ct/recurring', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/recurring')>()), ...rec }));
const rx = vi.hoisted(() => ({ validateRxSelection: vi.fn() }));
vi.mock('@/lib/ct/prescriptions', async () => {
  class RxNotFoundError extends Error {}
  return { ...rx, RxNotFoundError };
});
const orderRead = vi.hoisted(() => ({ getRawOrderForCustomer: vi.fn() }));
vi.mock('@/lib/ct/orders-read', () => orderRead);
vi.mock('@/lib/ct/refill-log', () => ({ lastRunsOf: async () => new Map() }));
vi.mock('@/lib/ct/cart', () => ({ addRxLines: vi.fn() }));

import { RxNotFoundError } from '@/lib/ct/prescriptions';
import { AutoRefillError, enableAutoRefill, listRefills } from './auto-refill';

const NOW = new Date('2026-10-08T10:00:00Z');
const patient = { patientRef: 'pt', name: 'Sam' };
const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const method = (over = {}) => ({ id: 'pm1', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2030, isDefault: true, ...over });
const provider = (methods: unknown[] = [method()]) => ({ listStoredMethods: vi.fn(async () => methods) }) as never;
const accepted = (lineRef: string) => ({ lineRef, sku: `SKU-${lineRef}`, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });
const refused = (lineRef: string, status: string, name = '') => ({ lineRef, name, sig: '', qty: 0, price: null, status, selectable: false, minShelfLifeMonths: null });
const roStub = { id: 'ro1', recurringOrderState: 'Active', schedule: { type: 'standard', intervalUnit: 'Months', value: 1 }, nextOrderAt: '2026-11-08T10:00:00Z', cart: { id: 'c', obj: { lineItems: [{ name: { 'en-US': 'Atorvastatin' }, quantity: 1 }] } } };
const orderLine = (name: string, rxNumber: string, lineRef: string) => ({ name: { 'en-US': name }, variant: { sku: `SKU-${lineRef}` }, quantity: 1, custom: { fields: { rxNumber, rxLineRef: lineRef, prescribedQty: 30 } } });

beforeEach(() => {
  rec.createRecurringFromLines.mockReset().mockResolvedValue(roStub);
  rec.listRecurring.mockReset().mockResolvedValue([]);
  rx.validateRxSelection.mockReset().mockImplementation(async (_p: unknown, number: string, refs: string[]) => ({ rxNumber: number, accepted: refs.map(accepted), refused: [] }));
  orderRead.getRawOrderForCustomer.mockReset();
});

describe('subscriptions-and-recurring-orders › Recurring order created (service)', () => {
  it('from prescription lines: re-validates, creates the standing order with the chosen cadence, the first refill one cadence from now and the default saved method', async () => {
    const r = await enableAutoRefill({ customerId: 'c1', patient, ctx, source: { rxNumber: 'RX-1', lineRefs: ['a'] }, cadence: 'monthly', provider: provider([method({ id: 'pm0', isDefault: false }), method()]), now: NOW });
    expect(rx.validateRxSelection).toHaveBeenCalledWith(patient, 'RX-1', ['a'], ctx);
    expect(rec.createRecurringFromLines).toHaveBeenCalledWith({
      customerId: 'c1',
      currency: 'USD',
      country: 'US',
      shippingMethodKey: 'mlv-standard',
      lines: [{ sku: 'SKU-a', rxNumber: 'RX-1', rxLineRef: 'a', prescribedQty: 30 }],
      cadence: 'monthly',
      startsAt: new Date('2026-11-08T10:00:00Z'),
      paymentMethodId: 'pm1',
    });
    expect(r.refill).toMatchObject({ id: 'ro1', state: 'Active', cadence: 'monthly', nextOrderAt: '2026-11-08T10:00:00Z', priceMode: 'Dynamic' });
    expect(r.notIncluded).toEqual([]);
  });

  it('quarterly starts three months out', async () => {
    await enableAutoRefill({ customerId: 'c1', patient, ctx, source: { rxNumber: 'RX-1', lineRefs: ['a'] }, cadence: 'quarterly', provider: provider(), now: NOW });
    expect(rec.createRecurringFromLines.mock.calls[0]?.[0]).toMatchObject({ cadence: 'quarterly', startsAt: new Date('2027-01-08T10:00:00Z') });
  });

  it('needs a saved payment method: nothing is created without one', async () => {
    await expect(enableAutoRefill({ customerId: 'c1', patient, ctx, source: { rxNumber: 'RX-1', lineRefs: ['a'] }, cadence: 'monthly', provider: provider([]) })).rejects.toMatchObject({ code: 'NO_PAYMENT_METHOD' });
    expect(rec.createRecurringFromLines).not.toHaveBeenCalled();
  });

  it('from a past order: its own prescription lines are re-validated now; another customer\'s or an unknown order is NOT_FOUND', async () => {
    orderRead.getRawOrderForCustomer.mockResolvedValue({ lineItems: [orderLine('Atorvastatin', 'RX-1', 'a'), orderLine('Lisinopril', 'RX-1', 'b'), { name: { 'en-US': 'No rx' }, custom: undefined }] });
    await enableAutoRefill({ customerId: 'c1', patient, ctx, source: { orderId: 'o1' }, cadence: 'monthly', provider: provider(), now: NOW });
    expect(orderRead.getRawOrderForCustomer).toHaveBeenCalledWith('o1', 'c1');
    expect(rx.validateRxSelection).toHaveBeenCalledWith(patient, 'RX-1', ['a', 'b'], ctx);
    orderRead.getRawOrderForCustomer.mockResolvedValue(null);
    await expect(enableAutoRefill({ customerId: 'c1', patient, ctx, source: { orderId: 'x' }, cadence: 'monthly', provider: provider() })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('an order with no prescription lines has nothing to refill', async () => {
    orderRead.getRawOrderForCustomer.mockResolvedValue({ lineItems: [{ name: { 'en-US': 'x' }, custom: undefined }] });
    await expect(enableAutoRefill({ customerId: 'c1', patient, ctx, source: { orderId: 'o1' }, cadence: 'monthly', provider: provider() })).rejects.toMatchObject({ code: 'NOTHING_REFILLABLE' });
  });

  it('only dispensable lines enter the standing order; the others are named with the reason', async () => {
    orderRead.getRawOrderForCustomer.mockResolvedValue({ lineItems: [orderLine('Atorvastatin', 'RX-1', 'a'), orderLine('Lisinopril', 'RX-1', 'b'), orderLine('Metformin', 'RX-1', 'c')] });
    rx.validateRxSelection.mockResolvedValue({ rxNumber: 'RX-1', accepted: [accepted('a')], refused: [refused('b', 'NO_REFILLS'), refused('c', 'CEILING')] });
    const r = await enableAutoRefill({ customerId: 'c1', patient, ctx, source: { orderId: 'o1' }, cadence: 'monthly', provider: provider(), now: NOW });
    expect(rec.createRecurringFromLines.mock.calls[0]?.[0].lines).toHaveLength(1);
    expect(r.notIncluded).toEqual([{ name: 'Lisinopril', reason: 'NO_REFILLS' }, { name: 'Metformin', reason: 'UNAVAILABLE' }]);
  });

  it('nothing dispensable: refused with the named reasons, no standing order', async () => {
    rx.validateRxSelection.mockResolvedValue({ rxNumber: 'RX-1', accepted: [], refused: [refused('a', 'EXPIRED', 'Atorvastatin')] });
    const error = await enableAutoRefill({ customerId: 'c1', patient, ctx, source: { rxNumber: 'RX-1', lineRefs: ['a'] }, cadence: 'monthly', provider: provider() }).catch((e) => e);
    expect(error).toBeInstanceOf(AutoRefillError);
    expect(error).toMatchObject({ code: 'NOT_DISPENSABLE', notIncluded: [{ name: 'Atorvastatin', reason: 'EXPIRED' }] });
    expect(rec.createRecurringFromLines).not.toHaveBeenCalled();
  });

  it('a foreign or unknown prescription number is NOT_FOUND (the same as an unknown one)', async () => {
    rx.validateRxSelection.mockRejectedValue(new RxNotFoundError());
    await expect(enableAutoRefill({ customerId: 'c1', patient, ctx, source: { rxNumber: 'RX-9', lineRefs: ['a'] }, cadence: 'monthly', provider: provider() })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('not twice: lines already in an Active or Paused auto-refill are left out, a canceled one does not count', async () => {
    const existing = (state: string) => ({ recurringOrderState: state, cart: { obj: { lineItems: [orderLine('A', 'RX-1', 'a')] } } });
    rec.listRecurring.mockResolvedValue([existing('Canceled')]);
    await enableAutoRefill({ customerId: 'c1', patient, ctx, source: { rxNumber: 'RX-1', lineRefs: ['a'] }, cadence: 'monthly', provider: provider(), now: NOW });
    expect(rec.createRecurringFromLines).toHaveBeenCalledTimes(1);
    rec.listRecurring.mockResolvedValue([existing('Paused')]);
    await expect(enableAutoRefill({ customerId: 'c1', patient, ctx, source: { rxNumber: 'RX-1', lineRefs: ['a'] }, cadence: 'monthly', provider: provider() })).rejects.toMatchObject({ code: 'ALREADY_ENABLED' });
    expect(rec.createRecurringFromLines).toHaveBeenCalledTimes(1);
  });
});

describe('subscriptions-and-recurring-orders: the list', () => {
  it('maps each recurring order with its last scheduled check', async () => {
    rec.listRecurring.mockResolvedValue([roStub]);
    const [refill] = await listRefills('c1', 'en-US');
    expect(refill).toMatchObject({ id: 'ro1', lastRun: null, lines: [{ name: 'Atorvastatin', quantity: 1 }] });
  });
});
