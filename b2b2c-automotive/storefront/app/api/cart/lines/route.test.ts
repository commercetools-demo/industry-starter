// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

const getSession = vi.hoisted(() => vi.fn());
const updateSession = vi.hoisted(() => vi.fn());
const getLocale = vi.hoisted(() => vi.fn());
const getShellContext = vi.hoisted(() => vi.fn());
const addLineToCart = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({ getSession, updateSession, getLocale }));
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));
vi.mock('@/lib/ct/cart', () => ({ addLineToCart }));

import { POST } from './route';

const branches = [{ key: 'mau-br-b', channelId: 'ch-b' }, { key: 'mau-br-a', channelId: 'ch-a' }];
const post = (body: unknown) => makeRequest('/api/cart/lines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  for (const m of [getSession, updateSession, getLocale, getShellContext, addLineToCart]) m.mockReset();
  getSession.mockResolvedValue({ storeKey: 'mau-reseller-north', branchKey: 'mau-br-b' } satisfies Session);
  getLocale.mockResolvedValue({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  getShellContext.mockResolvedValue({ storeId: 's1', branches, retailChannelId: 'ch-r', settings: {}, countries: [] });
  addLineToCart.mockResolvedValue({ cartId: 'cart-9', count: 3 });
  updateSession.mockImplementation(async (patch: (s: Session) => Session) => patch({ storeKey: 'mau-reseller-north' }));
});

describe('Add to cart from a card: POST /api/cart/lines', () => {
  it('adds the line with the market and the branch scope of the session', async () => {
    const res = await POST(post({ sku: 'MLV-BP-41001', quantity: 3 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cartId: 'cart-9', count: 3 });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(addLineToCart).toHaveBeenCalledWith(
      { storeKey: 'mau-reseller-north', locale: 'de-DE', currency: 'EUR', country: 'DE', scope: { branchKey: 'mau-br-b', branchChannelId: 'ch-b', retailChannelId: 'ch-r' } },
      expect.objectContaining({ storeKey: 'mau-reseller-north' }),
      { sku: 'MLV-BP-41001', quantity: 3 },
    );
  });

  it('session gets the cart id and a minted anonymous id', async () => {
    addLineToCart.mockResolvedValue({ cartId: 'cart-9', count: 1, anonymousId: 'anon-1' });
    await POST(post({ sku: 'A1B', quantity: 1 }));
    const patch = updateSession.mock.calls[0][0] as (s: Session) => Session;
    expect(patch({ storeKey: 'mau-reseller-north' })).toEqual({ storeKey: 'mau-reseller-north', cartId: 'cart-9', anonymousId: 'anon-1' });
  });

  it('session keeps its anonymous id when none was minted', async () => {
    await POST(post({ sku: 'A1B', quantity: 1 }));
    const patch = updateSession.mock.calls[0][0] as (s: Session) => Session;
    expect(patch({ anonymousId: 'old' })).toEqual({ anonymousId: 'old', cartId: 'cart-9' });
  });

  it('rejects quantity 0 and 100', async () => {
    for (const quantity of [0, 100, 1.5, -1, '2']) expect((await POST(post({ sku: 'A1B', quantity }))).status).toBe(400);
    expect(addLineToCart).not.toHaveBeenCalled();
  });

  it('rejects a missing or oversized sku and a bad recurrence key', async () => {
    expect((await POST(post({ quantity: 1 }))).status).toBe(400);
    expect((await POST(post({ sku: 'x'.repeat(65), quantity: 1 }))).status).toBe(400);
    expect((await POST(post({ sku: 'A1B', quantity: 1, recurrencePolicyKey: 'bad key!' }))).status).toBe(400);
    expect(addLineToCart).not.toHaveBeenCalled();
  });

  it('passes a valid recurrence policy key through', async () => {
    await POST(post({ sku: 'A1B', quantity: 1, recurrencePolicyKey: 'mau-rp-monthly' }));
    expect(addLineToCart.mock.calls[0][2]).toEqual({ sku: 'A1B', quantity: 1, recurrencePolicyKey: 'mau-rp-monthly' });
  });

  it('maps MissingPrice to 422 price-unavailable', async () => {
    addLineToCart.mockRejectedValue(new ApiError(422, 'price-unavailable'));
    const res = await POST(post({ sku: 'A1B', quantity: 1 }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'price-unavailable' });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('unknown sku is 404 and a version conflict after the retry is 409', async () => {
    addLineToCart.mockRejectedValueOnce(new ApiError(404, 'Not found'));
    expect((await POST(post({ sku: 'A1B', quantity: 1 }))).status).toBe(404);
    addLineToCart.mockRejectedValueOnce({ statusCode: 409 });
    expect((await POST(post({ sku: 'A1B', quantity: 1 }))).status).toBe(409);
  });

  it('no store in the session is 404 without a commercetools call', async () => {
    getSession.mockResolvedValue({});
    expect((await POST(post({ sku: 'A1B', quantity: 1 }))).status).toBe(404);
    expect(addLineToCart).not.toHaveBeenCalled();
  });

  it('commercetools errors are sanitised', async () => {
    addLineToCart.mockRejectedValue({ statusCode: 500, message: 'secret' });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(post({ sku: 'A1B', quantity: 1 }));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"Something went wrong"}');
    error.mockRestore();
  });
});
