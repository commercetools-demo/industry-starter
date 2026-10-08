import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { orderDevice } from '@/test/fixtures/orders';

const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('./client', () => ({
  getApiRoot: () => ({
    orders: () => ({
      withOrderNumber: () => ({ get: () => ({ execute: () => state.get() }) }),
      withId: () => ({ post: (args: unknown) => ({ execute: () => state.post(args) }) }),
    }),
  }),
}));

import { requestReturn, ReturnInputError, ReturnNotAllowedError, OrderNotFoundError } from './post-purchase';

type Update = { body: { version: number; actions: { action: string; name?: string; value?: string; returnDate?: string; items?: Record<string, unknown>[]; fields?: Record<string, string> }[] } };

const order = (patch: Record<string, unknown> = {}, key: string | null = 'malva-order'): CtOrder =>
  ({ ...orderDevice(), version: 3, custom: { type: { typeId: 'type', id: 'ot', ...(key ? { obj: { key } } : {}) }, fields: { serviceStartDate: '2026-05-02' } }, ...patch }) as unknown as CtOrder;
const alreadyReturned = {
  returnInfo: [{ returnDate: '2026-05-03T00:00:00.000Z', items: [{ id: 'ri-1', type: 'LineItemReturnItem', lineItemId: 'd2', quantity: 1, shipmentState: 'Advised', paymentState: 'NonRefundable' }] }],
};
const request = { items: [{ lineItemId: 'd2', quantity: 1 }], reason: 'defective', note: 'screen is cracked' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers().setSystemTime(new Date('2026-05-10T09:30:00Z'));
  state.get.mockResolvedValue({ body: order() });
  state.post.mockResolvedValue({ body: { ...order(alreadyReturned), version: 4 } });
});
afterEach(() => vi.useRealTimers());

describe('requestReturn', () => {
  it('Return started: the return is recorded against those items with its own shipment and refund state', async () => {
    const result = await requestReturn('QA-DDDD04', 'cust-alex', request, 'en-US');
    expect(state.post).toHaveBeenCalledTimes(1);
    const { body } = state.post.mock.calls[0]?.[0] as Update;
    expect(body.version).toBe(3);
    expect(body.actions[0]).toEqual({
      action: 'addReturnInfo',
      returnDate: '2026-05-10T09:30:00.000Z',
      items: [{ key: 'ret-20260510093000-1', lineItemId: 'd2', quantity: 1, comment: 'defective: screen is cracked', shipmentState: 'Advised' }],
    });
    expect(body.actions[1]).toMatchObject({ action: 'setCustomField', name: 'returnRequest' });
    expect(JSON.parse(body.actions[1]?.value ?? '[]')).toEqual([{ requestedAt: '2026-05-10T09:30:00.000Z', reason: 'defective', note: 'screen is cracked', lineItemIds: ['d2'] }]);
    // the answer shows the goods and the refund as two separate states
    expect(result.returns[0]?.items[0]).toMatchObject({ lineItemId: 'd2', shipmentState: 'Advised', paymentState: 'NonRefundable' });
  });

  it('appends to the earlier requests and sets the type on an order without one', async () => {
    state.get.mockResolvedValue({ body: order({ custom: { type: { typeId: 'type', id: 'ot' }, fields: { returnRequest: JSON.stringify([{ requestedAt: 'x', reason: 'other', lineItemIds: ['d1'] }]) } } }, null) });
    await requestReturn('QA-DDDD04', 'cust-alex', request, 'en-US');
    const action = (state.post.mock.calls[0]?.[0] as Update).body.actions[1];
    expect(action?.action).toBe('setCustomType');
    expect(JSON.parse(action?.fields?.returnRequest ?? '[]')).toHaveLength(2);
  });

  it('refuses after the 30 days', async () => {
    vi.setSystemTime(new Date('2026-06-02T10:00:01Z'));
    await expect(requestReturn('QA-DDDD04', 'cust-alex', request, 'en-US')).rejects.toMatchObject({ code: 'WINDOW_CLOSED' });
    expect(state.post).not.toHaveBeenCalled();
  });

  it('refuses a cancelled order', async () => {
    state.get.mockResolvedValue({ body: order({ orderState: 'Cancelled' }) });
    await expect(requestReturn('QA-DDDD04', 'cust-alex', request, 'en-US')).rejects.toBeInstanceOf(ReturnNotAllowedError);
  });

  it('a second identical request fails with QUANTITY_TOO_HIGH and writes nothing', async () => {
    state.get.mockResolvedValue({ body: order(alreadyReturned) });
    const error = await requestReturn('QA-DDDD04', 'cust-alex', request, 'en-US').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ReturnInputError);
    expect((error as ReturnInputError).code).toBe('QUANTITY_TOO_HIGH');
    expect(state.post).not.toHaveBeenCalled();
  });

  it('rejects a line that is not a device', async () => {
    await expect(requestReturn('QA-DDDD04', 'cust-alex', { ...request, items: [{ lineItemId: 'd1', quantity: 1 }] }, 'en-US')).rejects.toMatchObject({ code: 'INVALID_ITEMS' });
    expect(state.post).not.toHaveBeenCalled();
  });

  it('an order without any device has nothing to return', async () => {
    const { lineItems, ...rest } = order();
    state.get.mockResolvedValue({ body: { ...rest, lineItems: lineItems.filter((line) => line.id === 'd1') } });
    await expect(requestReturn('QA-DDDD04', 'cust-alex', request, 'en-US')).rejects.toMatchObject({ code: 'NO_RETURNABLE_LINES' });
  });

  it('retries a version conflict once with a re-check, so a double submit never creates two returns', async () => {
    state.post.mockRejectedValueOnce({ statusCode: 409 });
    state.get.mockResolvedValueOnce({ body: order() }).mockResolvedValueOnce({ body: order(alreadyReturned) });
    await expect(requestReturn('QA-DDDD04', 'cust-alex', request, 'en-US')).rejects.toMatchObject({ code: 'QUANTITY_TOO_HIGH' });
    expect(state.post).toHaveBeenCalledTimes(1);
  });

  it('another customer gets not found', async () => {
    await expect(requestReturn('QA-DDDD04', 'cust-other', request, 'en-US')).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(state.post).not.toHaveBeenCalled();
  });
});
