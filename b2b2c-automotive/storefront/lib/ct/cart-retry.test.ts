// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cartGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: { inStoreKeyWithStoreKeyValue: () => ({ carts: () => ({ withId: () => ({ get: () => ({ execute: cartGet }) }) }) }) },
  projectKey: 'p',
}));

import { withCartRetry } from './cart-retry';

beforeEach(() => cartGet.mockReset());

describe('withCartRetry: lib/ct/cart-retry', () => {
  it('retries with the latest version after 409', async () => {
    cartGet.mockResolvedValueOnce({ body: { id: 'c', version: 1 } }).mockResolvedValueOnce({ body: { id: 'c', version: 2 } });
    const seen: number[] = [];
    const out = await withCartRetry('mau-reseller-north', 'c', async (cart) => {
      seen.push(cart.version);
      if (cart.version === 1) throw { statusCode: 409 };
      return 'done';
    });
    expect(out).toBe('done');
    expect(seen).toEqual([1, 2]);
    expect(cartGet).toHaveBeenCalledTimes(2);
  });

  it('gives up after three conflicts', async () => {
    cartGet.mockImplementation(async () => ({ body: { id: 'c', version: 9 } }));
    const fn = vi.fn(async () => {
      throw { statusCode: 409 };
    });
    await expect(withCartRetry('mau-reseller-north', 'c', fn)).rejects.toMatchObject({ statusCode: 409 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 400', async () => {
    cartGet.mockResolvedValue({ body: { id: 'c', version: 1 } });
    const fn = vi.fn(async () => {
      throw { statusCode: 400 };
    });
    await expect(withCartRetry('mau-reseller-north', 'c', fn)).rejects.toMatchObject({ statusCode: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
