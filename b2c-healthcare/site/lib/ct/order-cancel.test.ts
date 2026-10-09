import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

interface FakeOrder { id: string; version: number; customerId: string; orderNumber: string; stateKey: string; payment: FakePayment }
interface FakePayment { id: string; version: number; transactions: { type: string; state: string; amount: { centAmount: number; currencyCode: string } }[]; amountPlanned: { centAmount: number; currencyCode: string } }

let objects: FakeObjects;
let order: FakeOrder;
const calls: string[] = [];

const money = (centAmount: number) => ({ type: 'centPrecision', currencyCode: 'USD', centAmount, fractionDigits: 2 });
const sdkOrder = (o: FakeOrder) => ({
  id: o.id,
  version: o.version,
  customerId: o.customerId,
  orderNumber: o.orderNumber,
  createdAt: '2026-10-08T10:00:00Z',
  state: { obj: { key: o.stateKey } },
  totalPrice: money(1875),
  lineItems: [{ name: { 'en-US': 'Atorvastatin 20 mg' }, quantity: 1 }],
  paymentInfo: { payments: [{ obj: structuredClone(o.payment) }] },
});

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    customObjects: () => objects.customObjects(),
    orders: () => ({
      get: ({ queryArgs }: { queryArgs: { where: string } }) => ({
        execute: async () => {
          const m = /id="([^"]+)" and customerId="([^"]+)"/.exec(queryArgs.where);
          return { body: { results: m && order.id === m[1] && order.customerId === m[2] ? [sdkOrder(order)] : [] } };
        },
      }),
      withId: () => ({
        get: () => ({ execute: async () => ({ body: sdkOrder(order) }) }),
        post: ({ body }: { body: { actions: { action: string; state: { key: string } }[] } }) => ({
          execute: async () => {
            calls.push('transition');
            // The seeded State machine: packed-shipped and later cannot become cancelled.
            if (order.stateKey !== 'mlv-received' && order.stateKey !== 'mlv-pharmacist-review') throw Object.assign(new Error('InvalidOperation'), { statusCode: 400 });
            order.stateKey = body.actions[0]!.state.key;
            order.version += 1;
            return { body: sdkOrder(order) };
          },
        }),
      }),
    }),
    payments: () => ({
      withId: () => ({
        get: () => ({ execute: async () => ({ body: structuredClone(order.payment) }) }),
        post: ({ body }: { body: { actions: { transaction: FakePayment['transactions'][number] }[] } }) => ({
          execute: async () => {
            calls.push('markRefund');
            order.payment.transactions.push(body.actions[0]!.transaction);
            order.payment.version += 1;
            return { body: order.payment };
          },
        }),
      }),
    }),
  },
}));
vi.mock('@/lib/ct/fixtures', () => ({ loadCheckoutFixtures: async () => null, loadFundingFixtures: async () => null, loadDevRoot: async () => null }));

import type { Prescription } from '@/lib/clinical/types';
import { CONTAINERS } from '@/lib/ct/custom-objects';
import { consumeAuthorization } from '@/lib/ct/dispense-ledger';
import { cancelOrderForCustomer } from './order-cancel';
import * as hooks from './order-cancel-hooks';

const NOW = new Date('2026-10-08T12:00:00Z');
// Plays the connector: Checkout's Payment Intents API records the result on the Payment (CancelAuthorization / Refund).
const provider = () => ({
  kind: 'demo' as const,
  createSession: vi.fn(),
  release: vi.fn(async () => {
    order.payment.transactions.push({ type: 'CancelAuthorization', state: 'Success', amount: { centAmount: 1875, currencyCode: 'USD' } });
  }),
  refund: vi.fn(async (_id: string, amount: { centAmount: number; currencyCode: string }) => {
    order.payment.transactions.push({ type: 'Refund', state: 'Pending', amount });
  }),
  listStoredMethods: vi.fn(),
  setDefaultStoredMethod: vi.fn(),
  removeStoredMethod: vi.fn(),
});
const refills = () => (objects.objects.find((o) => o.container === CONTAINERS.rx && o.key === 'RX-77102')!.value as Prescription).refillsLeft;

beforeEach(async () => {
  calls.length = 0;
  objects = createFakeObjects();
  const rx: Prescription = { number: 'RX-77102', patientRef: 'pt_sam', prescriber: 'Dr. Test', issuedAt: '2026-09-24', refillsLeft: 3, lines: [{ lineRef: 'RX-77102-1', sku: 'MED-a', name: 'A', sig: 'sig', qty: 30 }] };
  objects.objects.push({ id: 'seed', container: CONTAINERS.rx, key: 'RX-77102', version: 1, value: rx, createdAt: '', lastModifiedAt: '' });
  await consumeAuthorization('ord-1', [{ patientRef: 'pt_sam', rxNumber: 'RX-77102', lineRef: 'RX-77102-1', sku: 'MED-a', qty: 30, packs: 1, periodCeiling: 3, perOrderMax: 3 }], NOW);
  order = {
    id: 'ord-1',
    version: 1,
    customerId: 'c-sam',
    orderNumber: 'MLV-000001',
    stateKey: 'mlv-received',
    payment: { id: 'pay-1', version: 1, amountPlanned: { centAmount: 1875, currencyCode: 'USD' }, transactions: [{ type: 'Authorization', state: 'Success', amount: { centAmount: 1875, currencyCode: 'USD' } }] },
  };
  vi.restoreAllMocks();
});

describe('post-purchase-order-management: cancel before packing', () => {
  it('authorized, never captured: sets the state to cancelled, restores the refill and asks Checkout to cancel the authorization ("Payment released")', async () => {
    expect(refills()).toBe(2);
    const p = provider();
    const outcome = await cancelOrderForCustomer('ord-1', 'c-sam', p, 'en-US');
    expect(outcome).toMatchObject({ kind: 'cancelled', alreadyCancelled: false, order: { status: 'cancelled', refund: 'released', cancellable: false } });
    expect(order.stateKey).toBe('mlv-cancelled');
    expect(refills()).toBe(3);
    expect(p.release).toHaveBeenCalledWith('pay-1');
    expect(p.refund).not.toHaveBeenCalled();
    // The storefront writes no Refund transaction of its own on a card payment: Checkout owns it.
    expect(order.payment.transactions.filter((t) => t.type === 'Refund')).toHaveLength(0);
  });

  it('captured: asks Checkout for a refund of the charged amount ("Refund requested"), and never cancels an authorization', async () => {
    order.payment.transactions.push({ type: 'Charge', state: 'Success', amount: { centAmount: 1875, currencyCode: 'USD' } });
    const p = provider();
    const outcome = await cancelOrderForCustomer('ord-1', 'c-sam', p, 'en-US');
    expect(outcome).toMatchObject({ kind: 'cancelled', order: { refund: 'requested' } });
    expect(p.refund).toHaveBeenCalledWith('pay-1', { centAmount: 1875, currencyCode: 'USD' });
    expect(p.release).not.toHaveBeenCalled();
  });

  it('a refund that the connector finished reads "Refunded"', async () => {
    order.payment.transactions.push({ type: 'Charge', state: 'Success', amount: { centAmount: 1875, currencyCode: 'USD' } }, { type: 'Refund', state: 'Success', amount: { centAmount: 1875, currencyCode: 'USD' } });
    order.stateKey = 'mlv-cancelled';
    const p = provider();
    expect(await cancelOrderForCustomer('ord-1', 'c-sam', p, 'en-US')).toMatchObject({ kind: 'cancelled', order: { refund: 'refunded' } });
    expect(p.refund).not.toHaveBeenCalled();
  });

  it('also allowed during pharmacist review, calls the allowance and restricted hooks', async () => {
    order.stateKey = 'mlv-pharmacist-review';
    const allowance = vi.spyOn(hooks, 'restoreAllowance');
    const restricted = vi.spyOn(hooks, 'restoreRestricted');
    expect((await cancelOrderForCustomer('ord-1', 'c-sam', provider(), 'en-US')).kind).toBe('cancelled');
    expect(allowance).toHaveBeenCalledWith('ord-1');
    expect(restricted).toHaveBeenCalledWith('ord-1');
  });

  it('refill restored once and not twice: cancelling again changes nothing (no second refill, no second request to Checkout)', async () => {
    await cancelOrderForCustomer('ord-1', 'c-sam', provider(), 'en-US');
    const again = provider();
    const second = await cancelOrderForCustomer('ord-1', 'c-sam', again, 'en-US');
    expect(second).toMatchObject({ kind: 'cancelled', alreadyCancelled: true });
    expect(refills()).toBe(3);
    expect(order.payment.transactions.filter((t) => t.type === 'CancelAuthorization')).toHaveLength(1);
    expect(again.release).not.toHaveBeenCalled();
    expect(calls.filter((c) => c === 'transition')).toHaveLength(1);
  });

  it('a cancel that stopped after the state change is completed by the retry', async () => {
    const failing = provider();
    failing.release.mockRejectedValue(new Error('psp down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await cancelOrderForCustomer('ord-1', 'c-sam', failing, 'en-US')).kind).toBe('cancelled');
    const ok = provider();
    await cancelOrderForCustomer('ord-1', 'c-sam', ok, 'en-US');
    expect(ok.release).toHaveBeenCalledWith('pay-1');
    expect(refills()).toBe(3);
  });

  it('works without a payment service (not configured): the order is cancelled and the refill restored; the release waits for the retry', async () => {
    expect((await cancelOrderForCustomer('ord-1', 'c-sam', null, 'en-US')).kind).toBe('cancelled');
    expect(refills()).toBe(3);
    expect(order.payment.transactions.some((t) => t.type === 'Refund' || t.type === 'CancelAuthorization')).toBe(false);
  });
});

describe('post-purchase-order-management: cancel is refused when too late', () => {
  it.each(['mlv-packed-shipped', 'mlv-delivered'])('%s: too late, nothing restored, nothing released', async (stateKey) => {
    order.stateKey = stateKey;
    const p = provider();
    expect(await cancelOrderForCustomer('ord-1', 'c-sam', p, 'en-US')).toEqual({ kind: 'too-late' });
    expect(refills()).toBe(2);
    expect(p.release).not.toHaveBeenCalled();
    expect(order.stateKey).toBe(stateKey);
  });

  it('the platform refusing the transition (packed in the meantime) is too late, and restores nothing', async () => {
    // The page read said "received"; by the time the transition runs the order is packed.
    const p = provider();
    const read = order;
    Object.defineProperty(read, 'stateKey', {
      get: (() => {
        let n = 0;
        return () => (n++ === 0 ? 'mlv-received' : 'mlv-packed-shipped');
      })(),
      set: () => undefined,
      configurable: true,
    });
    expect(await cancelOrderForCustomer('ord-1', 'c-sam', p, 'en-US')).toEqual({ kind: 'too-late' });
    expect(refills()).toBe(2);
  });
});

describe('order-history: Detail of an order not theirs (cancel)', () => {
  it('a foreign order and an unknown id are the same not-found, and nothing is touched', async () => {
    const p = provider();
    expect(await cancelOrderForCustomer('ord-1', 'c-alex', p, 'en-US')).toEqual({ kind: 'not-found' });
    expect(await cancelOrderForCustomer('nope', 'c-sam', p, 'en-US')).toEqual({ kind: 'not-found' });
    expect(refills()).toBe(2);
    expect(order.stateKey).toBe('mlv-received');
    expect(p.release).not.toHaveBeenCalled();
  });
});

describe('benefit-allowance-drawdown: Return restores the balance (cancel hook, workstream U)', () => {
  it('cancelling an order that drew from the allowance gives the amount back once, even when the cancel is repeated', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      const { drawdown, getBalance, grantCycle } = await import('./allowance');
      await grantCycle('pt_sam', '2026-10', 5000);
      await drawdown('pt_sam', 'ord-1', 3000, NOW);
      expect(await getBalance('pt_sam', NOW)).toBe(2000);
      await cancelOrderForCustomer('ord-1', 'c-sam', provider(), 'en-US');
      expect(await getBalance('pt_sam', NOW)).toBe(5000);
      await cancelOrderForCustomer('ord-1', 'c-sam', provider(), 'en-US');
      expect(await getBalance('pt_sam', NOW)).toBe(5000);
    } finally {
      vi.useRealTimers();
    }
  });
});
