// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.hoisted(() => vi.fn());
const withId = vi.hoisted(() => vi.fn(() => ({ get: () => ({ execute }) })));
const inStoreKey = vi.hoisted(() => vi.fn(() => ({ carts: () => ({ withId }) })));
vi.mock('./client', () => ({ apiRoot: { inStoreKeyWithStoreKeyValue: inStoreKey }, projectKey: 'p' }));

import { getCartSummary } from './cart';

beforeEach(() => {
  execute.mockReset();
  inStoreKey.mockClear();
});

describe('Cart count reflects quantity: lib/ct/cart', () => {
  it('counts units not lines', async () => {
    execute.mockResolvedValue({ body: { lineItems: [{ quantity: 2 }, { quantity: 1 }] } });
    expect(await getCartSummary('mau-reseller-north', 'cart-1')).toEqual({ count: 3 });
    expect(inStoreKey).toHaveBeenCalledWith({ storeKey: 'mau-reseller-north' });
    expect(withId).toHaveBeenCalledWith({ ID: 'cart-1' });
  });
  it('no cart means zero', async () => {
    expect(await getCartSummary('mau-reseller-north', undefined)).toEqual({ count: 0 });
    expect(execute).not.toHaveBeenCalled();
  });
  it('deleted cart means zero', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    expect(await getCartSummary('mau-reseller-north', 'gone')).toEqual({ count: 0 });
  });
  it('other errors are rethrown', async () => {
    execute.mockRejectedValue({ statusCode: 500 });
    await expect(getCartSummary('mau-reseller-north', 'c')).rejects.toBeDefined();
  });
});
