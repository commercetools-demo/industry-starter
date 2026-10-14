// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOrderById = vi.hoisted(() => vi.fn());
const getOrderByNumber = vi.hoisted(() => vi.fn());
const ensureOrderNumber = vi.hoisted(() => vi.fn());
const reconcilePickupBranch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/orders', () => ({ getOrderById, getOrderByNumber, ensureOrderNumber, reconcilePickupBranch }));

import { resolveReturn } from './return';

const ID = '3f1c0c52-1111-4222-8333-944455556666';
const order = (extra: Record<string, unknown> = {}) => ({ id: ID, version: 2, store: { key: 'mau-reseller-north' }, locale: 'en-US', cart: { id: 'cart-1' }, ...extra });

beforeEach(() => {
  for (const m of [getOrderById, getOrderByNumber, ensureOrderNumber, reconcilePickupBranch]) m.mockReset();
  ensureOrderNumber.mockImplementation(async (o: { orderNumber?: string }) => o.orderNumber ?? 'MA-ABCDEFGH');
});

describe('resolveReturn', () => {
  it('owner customer is redirected without a token', async () => {
    getOrderById.mockResolvedValue(order({ customerId: 'c-1', orderNumber: 'MA-0123ABCD' }));
    const result = await resolveReturn({ orderId: ID }, { customerId: 'c-1' });
    expect(result).toMatchObject({ status: 'ok', path: '/en-US/mau-reseller-north/checkout/confirmation/MA-0123ABCD', cartId: 'cart-1' });
  });
  it('same browser guest is redirected with a token', async () => {
    getOrderById.mockResolvedValue(order({ anonymousId: 'a-1' }));
    const result = await resolveReturn({ orderId: ID }, { anonymousId: 'a-1' });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.path).toMatch(/\/checkout\/confirmation\/MA-ABCDEFGH\?t=ey/);
  });
  it('stranger gets not-found', async () => {
    getOrderById.mockResolvedValue(order({ customerId: 'c-1', anonymousId: 'a-1' }));
    expect(await resolveReturn({ orderId: ID }, { customerId: 'c-2', anonymousId: 'a-2' })).toEqual({ status: 'not-found' });
    expect(ensureOrderNumber).not.toHaveBeenCalled();
  });
  it('malformed id gets not-found', async () => {
    getOrderById.mockResolvedValue(null);
    expect(await resolveReturn({ orderId: '../../etc' }, { customerId: 'c-1' })).toEqual({ status: 'not-found' });
    expect(await resolveReturn({}, { customerId: 'c-1' })).toEqual({ status: 'not-found' });
  });
  it('unknown order gets not-found', async () => {
    getOrderById.mockResolvedValue(null);
    expect(await resolveReturn({ orderId: ID }, { customerId: 'c-1' })).toEqual({ status: 'not-found' });
  });
  it('an order without a store gets not-found', async () => {
    getOrderById.mockResolvedValue(order({ store: undefined, customerId: 'c-1' }));
    expect(await resolveReturn({ orderId: ID }, { customerId: 'c-1' })).toEqual({ status: 'not-found' });
  });
  it('second call returns the same path and the same number', async () => {
    getOrderById.mockResolvedValue(order({ customerId: 'c-1' }));
    const first = await resolveReturn({ orderId: ID }, { customerId: 'c-1' });
    const second = await resolveReturn({ orderId: ID }, { customerId: 'c-1' });
    expect(second).toEqual(first);
  });
  it('resolves by order number as well', async () => {
    getOrderByNumber.mockResolvedValue(order({ customerId: 'c-1', orderNumber: 'MA-0123ABCD' }));
    const result = await resolveReturn({ orderNumber: 'MA-0123ABCD' }, { customerId: 'c-1' });
    expect(result.status).toBe('ok');
  });
  it('falls back to the session locale when the order has none, then to the default', async () => {
    getOrderById.mockResolvedValue(order({ customerId: 'c-1', locale: undefined }));
    const sessionLocale = await resolveReturn({ orderId: ID }, { customerId: 'c-1', locale: 'en-US' });
    expect(sessionLocale.status === 'ok' && sessionLocale.locale).toBe('en-US');
    const fallback = await resolveReturn({ orderId: ID }, { customerId: 'c-1' });
    expect(fallback.status === 'ok' && fallback.locale).toBe('de-DE');
  });
  it('reconciles the pickup branch with the session branch', async () => {
    getOrderById.mockResolvedValue(order({ customerId: 'c-1' }));
    await resolveReturn({ orderId: ID }, { customerId: 'c-1', branchKey: 'mau-br-north-berlin' });
    expect(reconcilePickupBranch).toHaveBeenCalledWith(expect.objectContaining({ id: ID }), 'mau-br-north-berlin');
  });
});
