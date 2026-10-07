import { ApiError } from '@/lib/api-error';
import { RECURRENCE_POLICY_TTL_S } from '@/lib/config/cache';

const policyGet = vi.fn();
const withKey = vi.fn<(args: { key: string }) => object>(() => ({ get: () => ({ execute: policyGet }) }));
const roList = vi.fn();
const roGet = vi.fn();
const roPost = vi.fn();
const cartPost = vi.fn();
const orderGet = vi.fn();
const orderPost = vi.fn();
const unstableCache = vi.fn<(fn: () => Promise<unknown>, keys: string[], options: { revalidate?: number }) => () => Promise<unknown>>((fn) => fn);

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: { revalidate?: number }) => unstableCache(fn, keys, options) }));
vi.mock('./client', () => ({
  getApiRoot: () => ({
    recurrencePolicies: () => ({ withKey }),
    recurringOrders: () => ({
      get: (args: unknown) => ({ execute: () => roList(args) }),
      withId: () => ({ get: () => ({ execute: roGet }), post: (args: unknown) => ({ execute: () => roPost(args) }) }),
    }),
    carts: () => ({ withId: (args: { ID: string }) => ({ post: (body: unknown) => ({ execute: () => cartPost(args, body) }) }) }),
    orders: () => ({ withId: () => ({ get: () => ({ execute: orderGet }), post: (args: unknown) => ({ execute: () => orderPost(args) }) }) }),
  }),
}));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

import {
  assertRecurringPrice,
  cancelRecurringOrdersForOrder,
  ensureRecurringPaymentStrategy,
  getMonthlyPolicy,
  getRecurringOrdersForCustomer,
  recurrenceInfoDraft,
  setRecurringOrderState,
  stampOrderCustomFields,
} from './recurring';

const policy = { id: 'pol-1', key: 'malva-monthly', version: 3 };

beforeEach(() => {
  for (const fn of [roList, roGet, roPost, cartPost, orderGet, orderPost]) fn.mockReset();
  policyGet.mockReset();
  withKey.mockClear();
  unstableCache.mockClear();
});

describe('recurrence policy', () => {
  it('reads malva-monthly by key and caches it for the policy TTL', async () => {
    policyGet.mockResolvedValue({ body: { id: 'pol-1', key: 'malva-monthly', version: 3, schedule: { type: 'standard', value: 1, intervalUnit: 'Months' } } });
    await expect(getMonthlyPolicy()).resolves.toEqual(policy);
    expect(withKey).toHaveBeenCalledWith({ key: 'malva-monthly' });
    expect(unstableCache.mock.calls[0]?.[2].revalidate).toBe(RECURRENCE_POLICY_TTL_S);
    expect(RECURRENCE_POLICY_TTL_S).toBe(3600);
  });
  it('a 404 throws RECURRENCE_POLICY_MISSING', async () => {
    policyGet.mockRejectedValue({ statusCode: 404 });
    const err = await getMonthlyPolicy().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).details?.reason).toBe('RECURRENCE_POLICY_MISSING');
  });
  it('another upstream failure is rethrown unchanged', async () => {
    policyGet.mockRejectedValue({ statusCode: 503 });
    await expect(getMonthlyPolicy()).rejects.toEqual({ statusCode: 503 });
  });
});

describe('recurrenceInfoDraft and assertRecurringPrice', () => {
  it('the draft has the exact shape', () => {
    expect(recurrenceInfoDraft({ policyKey: 'malva-monthly', priceSelectionMode: 'Fixed' })).toEqual({
      recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-monthly' },
      priceSelectionMode: 'Fixed',
    });
  });
  it('throws RECURRING_PRICE_MISSING when the price has no policy', () => {
    try {
      assertRecurringPrice({ price: {} }, policy, 'MLV-CBL-500-24M');
      expect.unreachable();
    } catch (err) {
      expect((err as ApiError).details).toEqual({ reason: 'RECURRING_PRICE_MISSING', sku: 'MLV-CBL-500-24M' });
    }
    expect(() => assertRecurringPrice({}, policy, 'X')).toThrow(ApiError);
  });
  it('throws when the price is tied to another policy', () => {
    expect(() => assertRecurringPrice({ price: { recurrencePolicy: { id: 'other' } } }, policy, 'X')).toThrow(ApiError);
  });
  it('passes when the ids match', () => {
    expect(() => assertRecurringPrice({ price: { recurrencePolicy: { id: 'pol-1' } } }, policy, 'X')).not.toThrow();
  });
});

// ---- part 2 ----
const cart = (extra: object = {}) => ({
  id: 'cart-1',
  version: 4,
  totalPrice: { centAmount: 6500, currencyCode: 'USD' },
  lineItems: [{ name: { 'en-US': 'Cable 500' }, variant: { sku: 'MLV-CBL-500-24M' }, quantity: 1, recurrenceInfo: { priceSelectionMode: 'Fixed' } }],
  ...extra,
});
const ro = (over: object = {}) => ({
  id: 'ro-1',
  version: 2,
  cart: { typeId: 'cart', id: 'cart-1', obj: cart() },
  originOrder: { typeId: 'order', id: 'order-1' },
  startsAt: '2026-10-07T10:00:00.000Z',
  recurringOrderState: 'Active',
  schedule: { type: 'standard', value: 1, intervalUnit: 'Months' },
  ...over,
});

describe('recurring orders', () => {
  it('Recurring order created: reads by customer expand the cart', async () => {
    roList.mockResolvedValue({ body: { results: [ro({ nextOrderAt: '2026-11-07T10:00:00.000Z' })] } });
    const list = await getRecurringOrdersForCustomer('cus"1', { locale: 'en-US', currency: 'USD' });
    const query = (roList.mock.calls[0]?.[0] as { queryArgs: Record<string, unknown> }).queryArgs;
    expect(query.expand).toEqual(['cart']);
    expect(query.where).toBe('customer(id="cus\\"1")');
    expect(query.sort).toEqual(['createdAt desc']);
    expect(list[0]).toMatchObject({ id: 'ro-1', nextOrderAt: '2026-11-07T10:00:00.000Z', monthly: { centAmount: 6500 } });
  });

  it('setRecurringOrderState sends the canceled state with a reason and returns the summary', async () => {
    roGet.mockResolvedValue({ body: { version: 2 } });
    roPost.mockResolvedValue({ body: ro({ recurringOrderState: 'Canceled', version: 3 }) });
    const result = await setRecurringOrderState('ro-1', 'canceled', 'moved away');
    const sent = roPost.mock.calls[0]?.[0] as { body: { version: number; actions: object[] } };
    expect(sent.body).toEqual({ version: 2, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'moved away' } }] });
    expect(result.state).toBe('Canceled');
    roGet.mockResolvedValue({ body: { version: 3 } });
    roPost.mockResolvedValue({ body: ro({ recurringOrderState: 'Paused' }) });
    await setRecurringOrderState('ro-1', 'paused');
    expect((roPost.mock.calls[1]?.[0] as { body: { actions: object[] } }).body.actions).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } }]);
  });

  it('setRecurringOrderState retries once on InvalidOperation and then throws RECURRING_ORDER_BUSY', async () => {
    vi.useFakeTimers();
    try {
      roGet.mockResolvedValue({ body: { version: 2 } });
      roPost.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } });
      const pending = setRecurringOrderState('ro-1', 'paused').catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(1500);
      const err = await pending;
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).details?.reason).toBe('RECURRING_ORDER_BUSY');
      expect(roPost).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('setRecurringOrderState retries once with a fresh version on a conflict', async () => {
    roGet.mockResolvedValueOnce({ body: { version: 2 } }).mockResolvedValueOnce({ body: { version: 3 } });
    roPost.mockRejectedValueOnce({ statusCode: 409 }).mockResolvedValueOnce({ body: ro() });
    await setRecurringOrderState('ro-1', 'active');
    expect((roPost.mock.calls[1]?.[0] as { body: { version: number } }).body.version).toBe(3);
  });

  it('Paused or canceled: cancel returns the last order date and no further state change is attempted on expired orders', async () => {
    roList.mockResolvedValue({
      body: {
        results: [
          ro({ id: 'ro-a', lastOrderAt: '2026-12-07T10:00:00.000Z' }),
          ro({ id: 'ro-b', recurringOrderState: 'Expired', lastOrderAt: '2027-01-07T10:00:00.000Z' }),
          ro({ id: 'ro-c', recurringOrderState: 'Failed' }),
        ],
      },
    });
    roGet.mockResolvedValue({ body: { version: 2 } });
    roPost.mockResolvedValue({ body: ro({ recurringOrderState: 'Canceled' }) });
    const result = await cancelRecurringOrdersForOrder('order-1', 'customer cancelled');
    expect(result).toEqual({ canceledIds: ['ro-a', 'ro-c'], lastOrderAt: '2027-01-07T10:00:00.000Z' });
    expect(roPost).toHaveBeenCalledTimes(2);
  });

  it('cancel without any generated order returns no lastOrderAt', async () => {
    roList.mockResolvedValue({ body: { results: [ro()] } });
    roGet.mockResolvedValue({ body: { version: 2 } });
    roPost.mockResolvedValue({ body: ro({ recurringOrderState: 'Canceled' }) });
    const result = await cancelRecurringOrdersForOrder('order-1', 'x');
    expect(result).toEqual({ canceledIds: ['ro-1'] });
  });

  it('ensureRecurringPaymentStrategy updates only carts without Checkout', async () => {
    const withStrategy = cart({ id: 'cart-ok', recurringPaymentConfiguration: { paymentStrategy: 'Checkout', paymentAllocations: [] } });
    roList.mockResolvedValue({ body: { results: [ro({ cart: { obj: withStrategy } }), ro({ id: 'ro-2', cart: { obj: cart({ id: 'cart-2' }) } })] } });
    cartPost.mockResolvedValue({ body: {} });
    await expect(ensureRecurringPaymentStrategy('order-1')).resolves.toEqual({ checked: 2, updated: 1 });
    expect(cartPost).toHaveBeenCalledTimes(1);
    expect(cartPost.mock.calls[0]?.[0]).toEqual({ ID: 'cart-2' });
    expect(cartPost.mock.calls[0]?.[1]).toEqual({ body: { version: 4, actions: [{ action: 'setRecurringPaymentStrategy', paymentStrategy: 'Checkout' }] } });
    cartPost.mockClear();
    roList.mockResolvedValue({ body: { results: [ro({ cart: { obj: withStrategy } })] } });
    await expect(ensureRecurringPaymentStrategy('order-1')).resolves.toEqual({ checked: 1, updated: 0 });
    expect(cartPost).not.toHaveBeenCalled();
  });

  it('stampOrderCustomFields uses setCustomType when no custom type exists and setCustomField otherwise', async () => {
    orderPost.mockResolvedValue({ body: {} });
    orderGet.mockResolvedValue({ body: { version: 5 } });
    await stampOrderCustomFields('order-1', { serviceStartDate: '2026-10-12', n: 3 });
    expect((orderPost.mock.calls[0]?.[0] as { body: object }).body).toEqual({
      version: 5,
      actions: [{ action: 'setCustomType', type: { typeId: 'type', key: 'malva-order' }, fields: { serviceStartDate: '2026-10-12', n: 3 } }],
    });
    orderGet.mockResolvedValue({ body: { version: 6, custom: { type: { id: 't' }, fields: {} } } });
    await stampOrderCustomFields('order-1', { serviceStartDate: '2026-10-12', priceSchedule: '{}' });
    expect((orderPost.mock.calls[1]?.[0] as { body: object }).body).toEqual({
      version: 6,
      actions: [
        { action: 'setCustomField', name: 'serviceStartDate', value: '2026-10-12' },
        { action: 'setCustomField', name: 'priceSchedule', value: '{}' },
      ],
    });
  });

  it('stampOrderCustomFields retries once on a version conflict', async () => {
    orderGet.mockResolvedValueOnce({ body: { version: 5 } }).mockResolvedValueOnce({ body: { version: 6 } });
    orderPost.mockRejectedValueOnce({ statusCode: 409 }).mockResolvedValueOnce({ body: {} });
    await stampOrderCustomFields('order-1', { a: 'b' });
    expect(orderPost).toHaveBeenCalledTimes(2);
    orderPost.mockReset();
    orderGet.mockResolvedValue({ body: { version: 6 } });
    orderPost.mockRejectedValue({ statusCode: 409 });
    await expect(stampOrderCustomFields('order-1', { a: 'b' })).rejects.toEqual({ statusCode: 409 });
  });
});
