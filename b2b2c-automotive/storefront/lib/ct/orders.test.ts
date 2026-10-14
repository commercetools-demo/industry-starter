// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveOrderNumber, ORDER_NUMBER_FORMAT } from '@/lib/checkout/order-number';
import { ctCart } from '@/test/cart-fixtures';

const orderGet = vi.hoisted(() => vi.fn());
const orderQuery = vi.hoisted(() => vi.fn());
const orderPost = vi.hoisted(() => vi.fn());
const inStoreOrderPost = vi.hoisted(() => vi.fn());
const inStoreCartGet = vi.hoisted(() => vi.fn());
const roPost = vi.hoisted(() => vi.fn());
const postActions = vi.hoisted(() => vi.fn());
const paymentsPost = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    orders: () => ({
      get: (args: unknown) => ({ execute: () => orderQuery(args) }),
      withId: () => ({ get: () => ({ execute: orderGet }), post: (args: unknown) => ({ execute: () => orderPost(args) }) }),
    }),
    recurringOrders: () => ({ post: (args: unknown) => ({ execute: () => roPost(args) }) }),
    payments: () => ({ post: paymentsPost }),
  },
  projectKey: 'p',
}));
vi.mock('./in-store', () => ({
  inStore: () => ({
    orders: () => ({ post: (args: unknown) => ({ execute: () => inStoreOrderPost(args) }) }),
    carts: () => ({ withId: () => ({ get: () => ({ execute: inStoreCartGet }) }) }),
  }),
}));
vi.mock('./cart', () => ({ postActions }));

import { createDevOrderFromCart, ensureOrderNumber, getOrderById, getOrderByNumber, reconcilePickupBranch } from './orders';

const ID = '3f1c0c52-1111-4222-8333-944455556666';
const order = (extra: Record<string, unknown> = {}) => ({ id: ID, version: 3, ...extra }) as never;
const duplicate = { statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } };

beforeEach(() => {
  for (const m of [orderGet, orderQuery, orderPost, inStoreOrderPost, inStoreCartGet, roPost, postActions, paymentsPost]) m.mockReset();
});

describe('getOrderById and getOrderByNumber', () => {
  it('malformed id gets null without a call', async () => {
    expect(await getOrderById('not-a-uuid')).toBeNull();
    expect(await getOrderByNumber('MA-ILLEGAL!')).toBeNull();
    expect(orderGet).not.toHaveBeenCalled();
    expect(orderQuery).not.toHaveBeenCalled();
  });
  it('unknown order gets null', async () => {
    orderGet.mockRejectedValue({ statusCode: 404 });
    expect(await getOrderById(ID)).toBeNull();
  });
  it('by number queries the exact number', async () => {
    orderQuery.mockResolvedValue({ body: { results: [order({ orderNumber: 'MA-0123ABCD' })] } });
    expect((await getOrderByNumber('MA-0123ABCD'))?.id).toBe(ID);
    expect(orderQuery.mock.calls[0][0].queryArgs.where).toBe('orderNumber="MA-0123ABCD"');
  });
});

describe('ensureOrderNumber', () => {
  it('existing number is kept and nothing is written', async () => {
    expect(await ensureOrderNumber(order({ orderNumber: 'MA-EXISTING' }))).toBe('MA-EXISTING');
    expect(orderPost).not.toHaveBeenCalled();
  });
  it('missing number is set once with setOrderNumber', async () => {
    orderPost.mockImplementation(async ({ body }) => ({ body: { orderNumber: body.actions[0].orderNumber } }));
    const number = await ensureOrderNumber(order());
    expect(number).toMatch(ORDER_NUMBER_FORMAT);
    expect(number).toBe(deriveOrderNumber(ID, 0));
    expect(orderPost).toHaveBeenCalledTimes(1);
    expect(orderPost.mock.calls[0][0].body).toEqual({ version: 3, actions: [{ action: 'setOrderNumber', orderNumber: number }] });
  });
  it('duplicate number retries with the next salt', async () => {
    orderPost.mockRejectedValueOnce(duplicate).mockImplementation(async ({ body }) => ({ body: { orderNumber: body.actions[0].orderNumber } }));
    expect(await ensureOrderNumber(order())).toBe(deriveOrderNumber(ID, 1));
    expect(orderPost).toHaveBeenCalledTimes(2);
  });
  it('a version conflict reloads and keeps a number set meanwhile', async () => {
    orderPost.mockRejectedValueOnce({ statusCode: 409 });
    orderGet.mockResolvedValue({ body: order({ orderNumber: 'MA-BYCHECKO' }) });
    expect(await ensureOrderNumber(order())).toBe('MA-BYCHECKO');
  });
  it('gives up after three duplicates', async () => {
    orderPost.mockRejectedValue(duplicate);
    await expect(ensureOrderNumber(order())).rejects.toThrow(/unique order number/);
  });
});

describe('reconcilePickupBranch', () => {
  const pickupOrder = (fields: Record<string, unknown> | null, method = 'mau-ship-pickup') =>
    order({ shippingInfo: { shippingMethod: { obj: { key: method } } }, ...(fields ? { custom: { type: { id: 't' }, fields } } : {}) });
  it('pickup order keeps its branch', async () => {
    await reconcilePickupBranch(pickupOrder({ pickupBranchKey: 'b1' }), 'b1');
    expect(orderPost).not.toHaveBeenCalled();
  });
  it('pickup order without the field receives the session branch', async () => {
    await reconcilePickupBranch(pickupOrder({ isTest: true }), 'b2');
    expect(orderPost.mock.calls[0][0].body.actions).toEqual([{ action: 'setCustomField', name: 'pickupBranchKey', value: 'b2' }]);
  });
  it('a shipped order clears the branch', async () => {
    await reconcilePickupBranch(pickupOrder({ pickupBranchKey: 'b1' }, 'mau-ship-standard'), 'b1');
    expect(orderPost.mock.calls[0][0].body.actions).toEqual([{ action: 'setCustomField', name: 'pickupBranchKey' }]);
  });
  it('a shipped order without the field is untouched', async () => {
    await reconcilePickupBranch(pickupOrder(null, 'mau-ship-standard'), 'b1');
    expect(orderPost).not.toHaveBeenCalled();
  });
  it('a conflict is swallowed', async () => {
    orderPost.mockRejectedValue({ statusCode: 409 });
    await expect(reconcilePickupBranch(pickupOrder({ pickupBranchKey: 'b1' }, 'mau-ship-standard'), undefined)).resolves.toBeUndefined();
  });
});

describe('createDevOrderFromCart (no payment)', () => {
  const input = { storeKey: 'mau-reseller-north', cartId: 'cart-1', customerEmail: 'qa-1@example.com' };
  beforeEach(() => {
    inStoreCartGet.mockResolvedValue({ body: { ...ctCart(), custom: undefined, customerEmail: undefined, shippingAddress: undefined } });
    postActions.mockResolvedValue(ctCart({ customerEmail: 'qa-1@example.com', shippingAddress: { country: 'DE' } }));
    inStoreOrderPost.mockResolvedValue({ body: { id: ID, orderNumber: deriveOrderNumber('cart-1') } });
  });
  it('creates one open order with the number from the cart id and no payment object', async () => {
    const created = await createDevOrderFromCart(input);
    expect(created.orderNumber).toBe(deriveOrderNumber('cart-1'));
    expect(inStoreOrderPost).toHaveBeenCalledTimes(1);
    expect(inStoreOrderPost.mock.calls[0][0].body).toMatchObject({ cart: { typeId: 'cart', id: 'cart-1' }, orderState: 'Open', paymentState: 'Pending', orderNumber: deriveOrderNumber('cart-1') });
    expect(paymentsPost).not.toHaveBeenCalled();
    expect(JSON.stringify(inStoreOrderPost.mock.calls[0][0])).not.toMatch(/payment"?:\s*\{|paymentInfo/);
  });
  it('sets email and a country-only address when missing', async () => {
    await createDevOrderFromCart(input);
    expect(postActions.mock.calls[0][2]).toEqual([
      { action: 'setCustomerEmail', email: 'qa-1@example.com' },
      { action: 'setShippingAddress', address: { country: 'DE' } },
    ]);
  });
  it('a subscription cart also gets a recurring order, and a failure there keeps the order', async () => {
    const recurring = ctCart({ lineItems: [{ ...ctCart().lineItems![0], recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp' } } }] });
    postActions.mockResolvedValue(recurring);
    inStoreCartGet.mockResolvedValue({ body: { ...recurring, version: 9 } });
    roPost.mockRejectedValue({ statusCode: 400 });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(createDevOrderFromCart(input)).resolves.toMatchObject({ id: ID });
    expect(roPost.mock.calls[0][0].body).toMatchObject({ cart: { id: 'cart-1' }, cartVersion: 9 });
    spy.mockRestore();
  });
});
