import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recurringCart, recurringOrder, type Json } from '@/test/recurring';

const roGet = vi.fn();
const roQuery = vi.fn();
const roPost = vi.fn();
const cartPost = vi.fn();
const lineId = () => ((recurringCart().lineItems as Json[])[0] as { id: string }).id;

vi.mock('./client', () => ({
  getApiRoot: () => ({
    recurringOrders: () => ({
      get: (arg: unknown) => ({ execute: () => roQuery(arg) }),
      withId: ({ ID }: { ID: string }) => ({
        get: (arg: unknown) => ({ execute: () => roGet(ID, arg) }),
        post: (arg: unknown) => ({ execute: () => roPost(ID, arg) }),
      }),
    }),
    carts: () => ({ withId: ({ ID }: { ID: string }) => ({ post: (arg: unknown) => ({ execute: () => cartPost(ID, arg) }) }) }),
  }),
}));

import {
  RecurringOrderLineNotFoundError,
  RecurringOrderNotFoundError,
  RecurringOrderStateError,
  UnknownPolicyError,
  cancel,
  getRecurringOrder,
  getRecurringOrders,
  pause,
  resume,
  setCadence,
  setQuantity,
} from './recurring-orders';

const ok = (body: unknown) => Promise.resolve({ body });
const conflict = () => Promise.reject({ statusCode: 409 });
const missing = () => Promise.reject({ statusCode: 404 });
const actionsOf = () => roPost.mock.calls[0][1].body.actions;

beforeEach(() => {
  vi.clearAllMocks();
  roGet.mockImplementation(() => ok(recurringOrder()));
  roPost.mockImplementation(() => ok(recurringOrder()));
  cartPost.mockImplementation(() => ok({}));
});

describe('reading', () => {
  it('lists the customer\'s recurring orders (filtered by customer, newest first, cart expanded) and maps them', async () => {
    roQuery.mockResolvedValue({ body: { results: [recurringOrder(), recurringOrder({ id: 'ro-2', recurringOrderState: 'Expired' })] } });
    const list = await getRecurringOrders('cu-1', 'en-US');
    expect(list.map((r) => [r.id, r.state])).toEqual([['ro-1', 'Active'], ['ro-2', 'Other']]);
    const args = roQuery.mock.calls[0][0].queryArgs;
    expect(args.where).toBe('customer(id="cu-1")');
    expect(args.sort).toBe('createdAt desc');
    expect(args.expand).toEqual(expect.arrayContaining(['cart', 'originOrder']));
  });

  it('a quote in the customer id cannot break out of the predicate', async () => {
    roQuery.mockResolvedValue({ body: { results: [] } });
    await getRecurringOrders('x") or id is defined or ("', 'en-US');
    expect(roQuery.mock.calls[0][0].queryArgs.where).toBe('customer(id="x) or id is defined or (")');
  });

  it('Ownership: another customer\'s recurring order is null, like a missing one', async () => {
    expect(await getRecurringOrder('ro-1', 'someone-else', 'en-US')).toBeNull();
    roGet.mockImplementation(missing);
    expect(await getRecurringOrder('ro-9', 'cu-1', 'en-US')).toBeNull();
  });

  it('own recurring order: mapped', async () => {
    expect((await getRecurringOrder('ro-1', 'cu-1', 'en-US'))?.cadenceLabel).toBe('Every week');
  });
});

describe('updates', () => {
  it('Change cadence: setSchedule with the policy key on the same recurring order, returns the refreshed summary', async () => {
    const s = await setCadence('ro-1', 'cu-1', 'monthly', 'en-US');
    expect(roPost.mock.calls[0][0]).toBe('ro-1');
    expect(roPost.mock.calls[0][1].body).toEqual({ version: 3, actions: [{ action: 'setSchedule', recurrencePolicy: { typeId: 'recurrence-policy', key: 'monthly' } }] });
    expect(s.id).toBe('ro-1');
  });

  it('Change cadence: an unknown key is refused before any call', async () => {
    await expect(setCadence('ro-1', 'cu-1', 'daily', 'en-US')).rejects.toBeInstanceOf(UnknownPolicyError);
    expect(roGet).not.toHaveBeenCalled();
    expect(roPost).not.toHaveBeenCalled();
  });

  it('Change quantity: changeLineItemQuantity on the recurring cart with its version', async () => {
    await setQuantity('ro-1', 'cu-1', lineId(), 4, 'en-US');
    expect(cartPost).toHaveBeenCalledWith('rc-1', { body: { version: 7, actions: [{ action: 'changeLineItemQuantity', lineItemId: lineId(), quantity: 4 }] } });
    expect(roPost).not.toHaveBeenCalled();
  });

  it('Change quantity: a line of another cart is refused; so is a bad quantity', async () => {
    await expect(setQuantity('ro-1', 'cu-1', 'nope', 2, 'en-US')).rejects.toBeInstanceOf(RecurringOrderLineNotFoundError);
    await expect(setQuantity('ro-1', 'cu-1', lineId(), 0, 'en-US')).rejects.toBeInstanceOf(RangeError);
    await expect(setQuantity('ro-1', 'cu-1', lineId(), 1.5, 'en-US')).rejects.toBeInstanceOf(RangeError);
    expect(cartPost).not.toHaveBeenCalled();
  });

  it('Pause: setRecurringOrderState paused', async () => {
    await pause('ro-1', 'cu-1', 'en-US');
    expect(actionsOf()).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } }]);
  });

  it('Resume: active with resumesAt = the next scheduled date after now (a plain resume would order at once)', async () => {
    roGet.mockImplementation(() => ok(recurringOrder({ recurringOrderState: 'Paused', nextOrderAt: undefined })));
    await resume('ro-1', 'cu-1', 'en-US', new Date('2026-10-15T00:00:00Z'));
    expect(actionsOf()).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'active', resumesAt: '2026-10-20T22:20:26.306Z' } }]);
  });

  it('Cancel: setRecurringOrderState canceled; the summary carries the last order date', async () => {
    roGet
      .mockImplementationOnce(() => ok(recurringOrder()))
      .mockImplementationOnce(() => ok(recurringOrder({ recurringOrderState: 'Canceled', nextOrderAt: undefined, lastOrderAt: '2026-10-13T22:21:00.000Z' })));
    const s = await cancel('ro-1', 'cu-1', 'en-US');
    expect(actionsOf()).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled' } }]);
    expect(s.state).toBe('Canceled');
    expect(s.lastOrderAt).toBe('2026-10-13T22:21:00.000Z');
  });

  it('Cancel before any scheduled order: the last order date is the first order', async () => {
    roGet
      .mockImplementationOnce(() => ok(recurringOrder()))
      .mockImplementationOnce(() => ok(recurringOrder({ recurringOrderState: 'Canceled', nextOrderAt: undefined })));
    expect((await cancel('ro-1', 'cu-1', 'en-US')).lastOrderAt).toBe('2026-10-06T22:20:26.000Z');
  });

  it('Ownership: every update of a stranger\'s recurring order is "not found" and nothing is written', async () => {
    for (const run of [
      () => setCadence('ro-1', 'other', 'weekly', 'en-US'),
      () => setQuantity('ro-1', 'other', lineId(), 2, 'en-US'),
      () => pause('ro-1', 'other', 'en-US'),
      () => resume('ro-1', 'other', 'en-US'),
      () => cancel('ro-1', 'other', 'en-US'),
    ]) {
      await expect(run()).rejects.toBeInstanceOf(RecurringOrderNotFoundError);
    }
    expect(roPost).not.toHaveBeenCalled();
    expect(cartPost).not.toHaveBeenCalled();
  });

  it('State rules: pause needs Active, resume needs Paused, nothing changes a Canceled one', async () => {
    roGet.mockImplementation(() => ok(recurringOrder({ recurringOrderState: 'Paused' })));
    await expect(pause('ro-1', 'cu-1', 'en-US')).rejects.toBeInstanceOf(RecurringOrderStateError);
    roGet.mockImplementation(() => ok(recurringOrder()));
    await expect(resume('ro-1', 'cu-1', 'en-US')).rejects.toBeInstanceOf(RecurringOrderStateError);
    roGet.mockImplementation(() => ok(recurringOrder({ recurringOrderState: 'Canceled' })));
    await expect(cancel('ro-1', 'cu-1', 'en-US')).rejects.toBeInstanceOf(RecurringOrderStateError);
    await expect(setCadence('ro-1', 'cu-1', 'weekly', 'en-US')).rejects.toBeInstanceOf(RecurringOrderStateError);
    await expect(setQuantity('ro-1', 'cu-1', lineId(), 2, 'en-US')).rejects.toBeInstanceOf(RecurringOrderStateError);
    expect(roPost).not.toHaveBeenCalled();
  });

  it('a version conflict is retried once with the fresh version; a second one propagates', async () => {
    roPost.mockImplementationOnce(conflict).mockImplementationOnce(() => ok(recurringOrder()));
    roGet.mockImplementationOnce(() => ok(recurringOrder({ version: 3 }))).mockImplementationOnce(() => ok(recurringOrder({ version: 4 })));
    await pause('ro-1', 'cu-1', 'en-US');
    expect(roPost.mock.calls.map((c) => c[1].body.version)).toEqual([3, 4]);

    vi.clearAllMocks();
    roGet.mockImplementation(() => ok(recurringOrder()));
    roPost.mockImplementation(conflict);
    await expect(pause('ro-1', 'cu-1', 'en-US')).rejects.toMatchObject({ statusCode: 409 });
    expect(roPost).toHaveBeenCalledTimes(2);
  });
});
