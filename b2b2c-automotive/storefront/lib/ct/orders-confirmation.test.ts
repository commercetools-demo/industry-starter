// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const byNumberGet = vi.hoisted(() => vi.fn());
const withOrderNumber = vi.hoisted(() => vi.fn());
const orderGet = vi.hoisted(() => vi.fn());
const orderPost = vi.hoisted(() => vi.fn());
const recurringGet = vi.hoisted(() => vi.fn());
const storeKeys = vi.hoisted(() => [] as string[]);
vi.mock('./client', () => ({
  apiRoot: { recurringOrders: () => ({ get: (args: unknown) => ({ execute: () => recurringGet(args) }) }) },
  projectKey: 'p',
}));
vi.mock('./in-store', () => ({
  inStore: (storeKey: string) => {
    storeKeys.push(storeKey);
    return {
      orders: () => ({
        withOrderNumber: (args: unknown) => {
          withOrderNumber(args);
          return { get: (a: unknown) => ({ execute: () => byNumberGet(a) }) };
        },
        withId: () => ({ get: () => ({ execute: orderGet }), post: (args: unknown) => ({ execute: () => orderPost(args) }) }),
      }),
    };
  },
}));

import { claimOrder, getOrderForConfirmation, getRecurringOrderForOrder } from './orders';

const ID = '3f1c0c52-1111-4222-8333-944455556666';
const order = (extra: Record<string, unknown> = {}) => ({ id: ID, version: 4, ...extra }) as never;

beforeEach(() => {
  for (const m of [byNumberGet, withOrderNumber, orderGet, orderPost, recurringGet]) m.mockReset();
  storeKeys.length = 0;
});

describe('getOrderForConfirmation', () => {
  it('returns null for unknown number', async () => {
    byNumberGet.mockRejectedValue({ statusCode: 404 });
    expect(await getOrderForConfirmation('mau-reseller-north', 'MA-0123ABCD')).toBeNull();
  });
  it('returns null for a malformed number without a call', async () => {
    expect(await getOrderForConfirmation('mau-reseller-north', 'AL-48213"; drop')).toBeNull();
    expect(withOrderNumber).not.toHaveBeenCalled();
  });
  it('uses the in-store endpoint', async () => {
    byNumberGet.mockResolvedValue({ body: order() });
    expect((await getOrderForConfirmation('mau-reseller-north', 'MA-0123ABCD'))?.id).toBe(ID);
    expect(storeKeys).toEqual(['mau-reseller-north']);
    expect(withOrderNumber).toHaveBeenCalledWith({ orderNumber: 'MA-0123ABCD' });
  });
  it('expands shipping method and state', async () => {
    byNumberGet.mockResolvedValue({ body: order() });
    await getOrderForConfirmation('mau-reseller-north', 'MA-0123ABCD');
    const { expand } = byNumberGet.mock.calls[0][0].queryArgs;
    expect(expand).toEqual(expect.arrayContaining(['shippingInfo.shippingMethod', 'state', 'lineItems[*].recurrenceInfo.recurrencePolicy']));
  });
  it('an outage is not hidden as unknown', async () => {
    byNumberGet.mockRejectedValue({ statusCode: 503 });
    await expect(getOrderForConfirmation('mau-reseller-north', 'MA-0123ABCD')).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('getRecurringOrderForOrder', () => {
  it('recurring order lookup is by origin order', async () => {
    recurringGet.mockResolvedValue({ body: { results: [{ id: 'ro-1' }] } });
    expect(await getRecurringOrderForOrder(ID)).toMatchObject({ id: 'ro-1' });
    expect(recurringGet.mock.calls[0][0].queryArgs.where).toBe(`originOrder(id="${ID}")`);
  });
  it('none yet gives null', async () => {
    recurringGet.mockResolvedValue({ body: { results: [] } });
    expect(await getRecurringOrderForOrder(ID)).toBeNull();
  });
  it('a failure gives null: the order stands without the date', async () => {
    recurringGet.mockRejectedValue({ statusCode: 500 });
    expect(await getRecurringOrderForOrder(ID)).toBeNull();
  });
  it('a malformed id is never sent', async () => {
    expect(await getRecurringOrderForOrder('x" or 1=1')).toBeNull();
    expect(recurringGet).not.toHaveBeenCalled();
  });
});

describe('claimOrder', () => {
  it('sets the customer on the order of the store', async () => {
    orderGet.mockResolvedValue({ body: order() });
    orderPost.mockResolvedValue({ body: order({ customerId: 'c-1' }) });
    await claimOrder('mau-reseller-north', ID, 'c-1');
    expect(orderPost).toHaveBeenCalledWith({ body: { version: 4, actions: [{ action: 'setCustomerId', customerId: 'c-1' }] } });
    expect(storeKeys.every((k) => k === 'mau-reseller-north')).toBe(true);
  });
  it('reloads and retries on a version conflict', async () => {
    orderGet.mockResolvedValueOnce({ body: order() }).mockResolvedValueOnce({ body: order({ version: 5 }) });
    orderPost.mockRejectedValueOnce({ statusCode: 409 }).mockResolvedValueOnce({ body: order() });
    await claimOrder('mau-reseller-north', ID, 'c-1');
    expect(orderPost.mock.calls[1][0].body.version).toBe(5);
  });
  it('refuses an order that already has a customer', async () => {
    orderGet.mockResolvedValue({ body: order({ customerId: 'c-9' }) });
    await expect(claimOrder('mau-reseller-north', ID, 'c-1')).rejects.toThrow('already has a customer');
    expect(orderPost).not.toHaveBeenCalled();
  });
  it('gives up after three conflicts', async () => {
    orderGet.mockResolvedValue({ body: order() });
    orderPost.mockRejectedValue({ statusCode: 409 });
    await expect(claimOrder('mau-reseller-north', ID, 'c-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(orderPost).toHaveBeenCalledTimes(3);
  });
});
