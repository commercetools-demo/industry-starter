// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rec = vi.hoisted(() => ({ listActiveRecurring: vi.fn(), skipNextRecurring: vi.fn(), pauseRecurring: vi.fn(), cancelRecurring: vi.fn() }));
vi.mock('@/lib/ct/recurring', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/recurring')>()), ...rec }));
const logs = vi.hoisted(() => ({ getRunLog: vi.fn(), writeRunLog: vi.fn() }));
vi.mock('@/lib/ct/refill-log', () => logs);
const patientMock = vi.hoisted(() => ({ getPatient: vi.fn() }));
vi.mock('@/lib/ct/patient', () => patientMock);
const rxMock = vi.hoisted(() => ({ findOwnPrescription: vi.fn() }));
vi.mock('@/lib/ct/prescriptions', () => rxMock);
const stored = vi.hoisted(() => ({ listStored: vi.fn() }));
vi.mock('@/lib/ct/stored-methods', () => stored);
const ceil = vi.hoisted(() => ({ getUsedBySku: vi.fn() }));
vi.mock('@/lib/ct/ceilings', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/ceilings')>()), ...ceil }));
const catalogMock = vi.hoisted(() => ({ getCatalogBySku: vi.fn() }));
vi.mock('@/lib/ct/rx-catalog', () => catalogMock);
const ledger = vi.hoisted(() => ({ consumeAuthorization: vi.fn() }));
vi.mock('@/lib/ct/dispense-ledger', async () => {
  class DispenseRefusedError extends Error {}
  return { ...ledger, DispenseRefusedError };
});
vi.mock('@/lib/ct/order-number', () => ({ nextOrderNumber: async () => 'MLV-000007' }));
const orders = vi.hoisted(() => ({ results: [] as unknown[], posts: [] as unknown[] }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    orders: () => ({
      get: () => ({ execute: async () => ({ body: { results: orders.results } }) }),
      withId: () => ({ post: (a: unknown) => ({ execute: async () => { orders.posts.push(a); return { body: {} }; } }) }),
    }),
  },
}));

import { checkRuns, reconcileGenerated, runAutoRefill } from './auto-refill-run';

const NOW = new Date('2026-11-07T05:00:00Z');
const RUN = '2026-11-08T10:00:00Z';
const roOf = (over: Record<string, unknown> = {}, withPayment = true) => ({
  id: 'ro1',
  customer: { typeId: 'customer', id: 'c1' },
  recurringOrderState: 'Active',
  nextOrderAt: RUN,
  cart: {
    typeId: 'cart',
    id: 'cart1',
    obj: {
      totalPrice: { currencyCode: 'USD' },
      country: 'US',
      ...(withPayment ? { recurringPaymentConfiguration: { paymentStrategy: 'Checkout', paymentAllocations: [{ paymentMethod: { id: 'pm1' } }] } } : {}),
      lineItems: [{ id: 'li1', quantity: 1, variant: { sku: 'MED-a' }, name: { 'en-US': 'A' }, custom: { fields: { rxNumber: 'RX-1', rxLineRef: 'RX-1-1', prescribedQty: 30 } } }],
    },
  },
  ...over,
});

beforeEach(() => {
  for (const m of [...Object.values(rec), ...Object.values(logs), ...Object.values(patientMock), ...Object.values(rxMock), ...Object.values(ceil), ...Object.values(catalogMock), ...Object.values(ledger)]) m.mockReset();
  rec.listActiveRecurring.mockResolvedValue([roOf()]);
  stored.listStored.mockReset().mockResolvedValue([{ id: 'pm1' }]);
  logs.getRunLog.mockResolvedValue(null);
  patientMock.getPatient.mockResolvedValue({ patientRef: 'pt', name: 'Sam' });
  rxMock.findOwnPrescription.mockResolvedValue({ refillsLeft: 2, expiresAt: '2027-01-01' });
  ceil.getUsedBySku.mockResolvedValue(new Map());
  catalogMock.getCatalogBySku.mockResolvedValue(new Map([['MED-a', { medication: { maxQtyPerOrder: null } }]]));
  ledger.consumeAuthorization.mockResolvedValue({ alreadyConsumed: false });
  orders.results = [];
  orders.posts = [];
});

describe('subscriptions-and-recurring-orders: scheduled check ahead of each run', () => {
  it('a valid authorization lets the run go ahead and records that it was checked', async () => {
    const s = await checkRuns(NOW);
    expect(s).toMatchObject({ seen: 1, allowed: 1, skipped: 0, paused: 0, stopped: 0 });
    expect(logs.writeRunLog).toHaveBeenCalledWith({ recurringOrderId: 'ro1', runAt: NOW.toISOString(), runFor: RUN, outcome: 'allowed' });
    expect(rec.pauseRecurring).not.toHaveBeenCalled();
    expect(rec.cancelRecurring).not.toHaveBeenCalled();
  });

  it('the authorization lapses between the check and the run: the run does not happen, the reason is recorded (the run day decides)', async () => {
    rxMock.findOwnPrescription.mockResolvedValue({ refillsLeft: 2, expiresAt: '2026-11-07' });
    const s = await checkRuns(NOW);
    expect(s.paused).toBe(1);
    expect(rec.pauseRecurring).toHaveBeenCalledWith('ro1');
    expect(logs.writeRunLog).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'skipped', reason: 'authorization-expired' }));
  });

  it('an exhausted authorization stops the series: the recurring order is canceled and the reason recorded', async () => {
    rxMock.findOwnPrescription.mockResolvedValue({ refillsLeft: 0 });
    const s = await checkRuns(NOW);
    expect(s.stopped).toBe(1);
    expect(rec.cancelRecurring).toHaveBeenCalledWith('ro1', 'authorization-exhausted');
    expect(logs.writeRunLog).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'stopped', reason: 'authorization-exhausted' }));
  });

  it('a monthly ceiling reached this month skips only that run (skip next, series continues)', async () => {
    catalogMock.getCatalogBySku.mockResolvedValue(new Map([['MED-a', { medication: { maxQtyPerOrder: 1 } }]]));
    ceil.getUsedBySku.mockResolvedValue(new Map([['MED-a', 1]]));
    const s = await checkRuns(NOW);
    expect(s.skipped).toBe(1);
    expect(rec.skipNextRecurring).toHaveBeenCalledWith('ro1');
    expect(rec.pauseRecurring).not.toHaveBeenCalled();
    expect(ceil.getUsedBySku).toHaveBeenCalledWith('pt', '2026-11');
    expect(logs.writeRunLog).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'skipped', reason: 'ceiling' }));
  });

  it('no payment method on the recurring cart, or one that was removed since, pauses it; a prescription that is not found pauses it', async () => {
    rec.listActiveRecurring.mockResolvedValue([roOf({}, false)]);
    await checkRuns(NOW);
    expect(logs.writeRunLog).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'payment-method-missing' }));
    rec.listActiveRecurring.mockResolvedValue([roOf()]);
    stored.listStored.mockResolvedValue([{ id: 'other-method' }]);
    await checkRuns(NOW);
    expect(logs.writeRunLog).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'payment-method-missing' }));
    stored.listStored.mockResolvedValue([{ id: 'pm1' }]);
    rxMock.findOwnPrescription.mockResolvedValue(null);
    await checkRuns(NOW);
    expect(logs.writeRunLog).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'prescription-missing' }));
  });

  it('a run that is not due within the window is left alone; so is one that was already checked or already set to skip', async () => {
    rec.listActiveRecurring.mockResolvedValue([roOf({ nextOrderAt: '2026-12-08T10:00:00Z' })]);
    expect(await checkRuns(NOW)).toMatchObject({ notDue: 1, allowed: 0 });
    rec.listActiveRecurring.mockResolvedValue([roOf()]);
    logs.getRunLog.mockResolvedValue({ outcome: 'allowed' });
    expect(await checkRuns(NOW)).toMatchObject({ alreadyChecked: 1, allowed: 0 });
    logs.getRunLog.mockResolvedValue(null);
    rec.listActiveRecurring.mockResolvedValue([roOf({ skipConfiguration: { type: 'Counter', totalToSkip: 1, skipped: 0 } })]);
    expect(await checkRuns(NOW)).toMatchObject({ alreadyChecked: 1 });
    expect(rec.skipNextRecurring).not.toHaveBeenCalled();
    expect(logs.writeRunLog).not.toHaveBeenCalled();
  });

  it('a failure on one recurring order is counted and does not stop the others', async () => {
    rec.listActiveRecurring.mockResolvedValue([roOf({ id: 'bad' }), roOf({ id: 'good' })]);
    logs.getRunLog.mockImplementationOnce(async () => { throw new Error('boom'); });
    const s = await checkRuns(NOW);
    expect(s).toMatchObject({ errors: 1, allowed: 1 });
    expect(logs.writeRunLog).toHaveBeenCalledWith(expect.objectContaining({ recurringOrderId: 'good' }));
  });

  it('nothing the logs or the summary carries names a medication or an RX number', async () => {
    rxMock.findOwnPrescription.mockResolvedValue({ refillsLeft: 0 });
    const s = await checkRuns(NOW);
    expect(JSON.stringify([s, logs.writeRunLog.mock.calls])).not.toMatch(/RX-1|Atorvastatin|MED-a/);
  });
});

describe('subscriptions-and-recurring-orders: orders the platform generated', () => {
  const generated = (over: Record<string, unknown> = {}) => ({
    id: 'o1',
    version: 3,
    customerId: 'c1',
    country: 'US',
    totalPrice: { currencyCode: 'USD' },
    lineItems: [{ id: 'li', quantity: 1, variant: { sku: 'MED-a' }, custom: { fields: { rxNumber: 'RX-1', rxLineRef: 'RX-1-1', prescribedQty: 30 } } }],
    ...over,
  });

  it('consumes the prescription once per generated order, gives it an MLV number and the received state', async () => {
    orders.results = [generated()];
    const s = await reconcileGenerated(NOW);
    expect(s).toMatchObject({ seen: 1, consumed: 1, numbered: 1 });
    expect(ledger.consumeAuthorization).toHaveBeenCalledWith('o1', [expect.objectContaining({ patientRef: 'pt', rxNumber: 'RX-1', lineRef: 'RX-1-1', qty: 30, packs: 1 })], NOW);
    expect(orders.posts).toEqual([{ body: { version: 3, actions: [{ action: 'setOrderNumber', orderNumber: 'MLV-000007' }, { action: 'transitionState', state: { typeId: 'state', key: 'mlv-received' }, force: true }] } }]);
  });

  it('an order already consumed and numbered is left alone (a rerun changes nothing)', async () => {
    orders.results = [generated({ orderNumber: 'MLV-000001' })];
    ledger.consumeAuthorization.mockResolvedValue({ alreadyConsumed: true });
    expect(await reconcileGenerated(NOW)).toMatchObject({ consumed: 0, numbered: 0 });
    expect(orders.posts).toEqual([]);
  });

  it('runAutoRefill runs both phases and reports their counts', async () => {
    orders.results = [generated({ orderNumber: 'MLV-000001' })];
    const r = await runAutoRefill(NOW);
    expect(r.checked.allowed).toBe(1);
    expect(r.reconciled.consumed).toBe(1);
  });

  it('a failure in the check does not skip the reconcile, and is rethrown afterwards', async () => {
    rec.listActiveRecurring.mockRejectedValue(new Error('down'));
    orders.results = [generated({ orderNumber: 'MLV-000001' })];
    await expect(runAutoRefill(NOW)).rejects.toThrow('down');
    expect(ledger.consumeAuthorization).toHaveBeenCalled();
  });
});
