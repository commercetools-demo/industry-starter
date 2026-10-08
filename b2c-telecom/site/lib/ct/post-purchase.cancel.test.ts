import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { orderA } from '@/test/fixtures/orders';

const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), listRecurring: vi.fn(), setState: vi.fn(), calls: [] as string[] }));

vi.mock('./client', () => ({
  getApiRoot: () => ({
    orders: () => ({
      withOrderNumber: () => ({ get: (args: unknown) => ({ execute: () => state.get(args) }) }),
      withId: ({ ID }: { ID: string }) => ({
        post: (args: unknown) => ({
          execute: () => {
            state.calls.push(`order:${ID}`);
            return state.post(args);
          },
        }),
      }),
    }),
  }),
}));
vi.mock('./recurring', () => ({
  getRecurringOrdersForOrder: (...args: unknown[]) => state.listRecurring(...args),
  setRecurringOrderState: (...args: unknown[]) => {
    state.calls.push(`recurring:${String(args[0])}`);
    return state.setState(...args);
  },
}));

import { cancelOrder, getOwnedOrder, NotCancellableError, OrderNotFoundError } from './post-purchase';

/** Order A starts its service on 2026-03-12; "today" is 2026-03-07. */
const withType = (order: CtOrder, key: string | null = 'malva-order', version = 1): CtOrder =>
  ({ ...order, version, custom: { ...order.custom, type: { typeId: 'type', id: 'ot', ...(key ? { obj: { key } } : {}) } } }) as unknown as CtOrder;

const input = { reason: 'other' as const, note: 'secret note text' };

beforeEach(() => {
  vi.clearAllMocks();
  state.calls.length = 0;
  vi.useFakeTimers().setSystemTime(new Date('2026-03-07T12:00:00Z'));
  state.get.mockResolvedValue({ body: withType(orderA()) });
  state.post.mockImplementation(async (args: { body: { actions: { action: string }[] } }) => ({ body: { ...withType(orderA()), version: 2, orderState: 'Cancelled', _actions: args.body.actions } }));
  state.listRecurring.mockResolvedValue([
    { id: 'ro-1', state: 'Active' },
    { id: 'ro-2', state: 'Canceled' },
    { id: 'ro-3', state: 'Paused' },
  ]);
  state.setState.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

describe('getOwnedOrder', () => {
  it('returns null for a foreign customer, a guest order and an unknown number', async () => {
    expect(await getOwnedOrder('QA-AAAA01', 'cust-other')).toBeNull();
    state.get.mockResolvedValue({ body: { ...orderA(), customerId: undefined } });
    expect(await getOwnedOrder('QA-AAAA01', 'cust-alex')).toBeNull();
    state.get.mockRejectedValue({ statusCode: 404 });
    expect(await getOwnedOrder('NOPE', 'cust-alex')).toBeNull();
  });
});

describe('cancelOrder', () => {
  it('cancels recurring orders before changing the order state', async () => {
    const order = await cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US');
    expect(state.listRecurring).toHaveBeenCalledWith('id-QA-AAAA01', expect.anything());
    expect(state.calls).toEqual(['recurring:ro-1', 'recurring:ro-3', 'order:id-QA-AAAA01']);
    expect(state.setState).toHaveBeenCalledWith('ro-1', 'canceled', 'customer-cancelled-order');
    expect(order.orderState).toBe('Cancelled');
  });

  it('stores the reason in the cancellation field', async () => {
    await cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US');
    const body = (state.post.mock.calls[0]?.[0] as { body: { version: number; actions: { action: string; name?: string; value?: string; orderState?: string }[] } }).body;
    expect(body.version).toBe(1);
    expect(body.actions[0]).toEqual({ action: 'changeOrderState', orderState: 'Cancelled' });
    expect(body.actions[1]).toMatchObject({ action: 'setCustomField', name: 'cancellation' });
    expect(JSON.parse(body.actions[1]?.value ?? '{}')).toMatchObject({ reason: 'other', note: 'secret note text', by: 'customer', cancelledAt: '2026-03-07T12:00:00.000Z' });
  });

  it('sets the custom type when the order has none', async () => {
    state.get.mockResolvedValue({ body: withType(orderA(), null) });
    await cancelOrder('QA-AAAA01', 'cust-alex', { reason: 'moving' }, 'en-US');
    const body = (state.post.mock.calls[0]?.[0] as { body: { actions: { action: string }[] } }).body;
    expect(body.actions[1]?.action).toBe('setCustomType');
  });

  it('a recurring failure stops before the order write and can be repeated', async () => {
    state.setState.mockRejectedValueOnce(new Error('boom'));
    await expect(cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US')).rejects.toThrow('boom');
    expect(state.post).not.toHaveBeenCalled();
    await expect(cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US')).resolves.toMatchObject({ orderState: 'Cancelled' });
    expect(state.post).toHaveBeenCalledTimes(1);
  });

  it('retries a version conflict once after re-reading and re-checking eligibility', async () => {
    state.post.mockRejectedValueOnce({ statusCode: 409 });
    state.get.mockResolvedValueOnce({ body: withType(orderA(), 'malva-order', 1) }).mockResolvedValueOnce({ body: withType(orderA(), 'malva-order', 5) });
    await cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US');
    expect(state.get).toHaveBeenCalledTimes(2);
    expect((state.post.mock.calls[1]?.[0] as { body: { version: number } }).body.version).toBe(5);
  });

  it('a conflict after the order shipped is refused by the re-check', async () => {
    state.post.mockRejectedValueOnce({ statusCode: 409 });
    state.get.mockResolvedValueOnce({ body: withType(orderA()) }).mockResolvedValueOnce({ body: { ...withType(orderA()), shipmentState: 'Shipped' } });
    await expect(cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US')).rejects.toMatchObject({ block: 'EQUIPMENT_SHIPPED' });
  });

  it('gives up after a second conflict', async () => {
    state.post.mockRejectedValue({ statusCode: 409 });
    await expect(cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US')).rejects.toMatchObject({ statusCode: 409 });
    expect(state.post).toHaveBeenCalledTimes(2);
  });

  it('repeat cancel is a no-op', async () => {
    state.get.mockResolvedValue({ body: { ...withType(orderA()), orderState: 'Cancelled' } });
    const order = await cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US');
    expect(order.orderState).toBe('Cancelled');
    expect(state.listRecurring).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
  });

  it('refuses once the service has started and writes nothing', async () => {
    vi.setSystemTime(new Date('2026-03-12T00:00:00Z'));
    const error = await cancelOrder('QA-AAAA01', 'cust-alex', input, 'en-US').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotCancellableError);
    expect((error as NotCancellableError).block).toBe('SERVICE_STARTED');
    expect(state.setState).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
  });

  it('a foreign customer gets not found and nothing is written', async () => {
    await expect(cancelOrder('QA-AAAA01', 'cust-other', input, 'en-US')).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(state.listRecurring).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
  });
});
