// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret } from '@/lib/env';
import { signSession } from '@/lib/session-core';

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined) }),
}));
const getCartSummary = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/cart', () => ({ getCartSummary }));

import { GET } from './route';

beforeEach(() => {
  jar.values.clear();
  getCartSummary.mockReset();
});

describe('Cart count reflects quantity: GET /api/cart/summary', () => {
  it('returns the unit count of the session cart', async () => {
    jar.values.set('malva_session', await signSession({ storeKey: 'mau-reseller-north', cartId: 'c1' }, getSessionSecret()));
    getCartSummary.mockResolvedValue({ count: 3 });
    const res = await GET();
    expect(await res.json()).toEqual({ count: 3 });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(getCartSummary).toHaveBeenCalledWith('mau-reseller-north', 'c1');
  });
  it('no session means zero without a commercetools call', async () => {
    expect(await (await GET()).json()).toEqual({ count: 0 });
    expect(getCartSummary).not.toHaveBeenCalled();
  });
  it('commercetools errors are sanitised', async () => {
    jar.values.set('malva_session', await signSession({ storeKey: 'mau-reseller-north', cartId: 'c1' }, getSessionSecret()));
    getCartSummary.mockRejectedValue({ statusCode: 500, message: 'secret' });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"Something went wrong"}');
    error.mockRestore();
  });
});
