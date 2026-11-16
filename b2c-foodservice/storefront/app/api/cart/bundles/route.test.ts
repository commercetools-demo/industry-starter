// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ add: vi.fn(), refuse: null as null | { code: string; status: number; extra?: Record<string, unknown> } }));

vi.mock('@/lib/ct/cart', () => {
  class LineRejected extends Error {
    constructor(readonly code: string, readonly status: number, readonly extra: Record<string, unknown> = {}) {
      super(code);
    }
  }
  return {
    LineRejected,
    addPresetBundle: async (...args: unknown[]) => {
      h.add(...args);
      if (h.refuse) throw new LineRejected(h.refuse.code, h.refuse.status, h.refuse.extra);
      return { cart: { id: 'cart-1', count: 1 }, session: { anonymousId: 'a', cartId: 'cart-1' } };
    },
  };
});
vi.mock('@/lib/session', () => ({
  getSession: async () => ({ anonymousId: 'a' }),
  getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }),
  createSessionToken: async () => 'token',
  setSessionCookie: (res: Response) => res,
}));
vi.mock('@/lib/ct/inventory', () => ({ SKU_PATTERN: /^[A-Za-z0-9._-]{1,64}$/ }));
vi.mock('@/lib/http/limit', () => ({ limitClient: () => null }));

import { POST } from './route';

const post = (body: unknown) => POST(new Request('http://x/api/cart/bundles', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({}) });
const valid = { sku: '998674532', preset: 0, quantity: 1, fulfilment: 'delivery' };

beforeEach(() => {
  h.add.mockReset();
  h.refuse = null;
});

describe('POST /api/cart/bundles (V-09)', () => {
  it('adds a valid bundle and answers the cart', async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect((await res.json()).cart.id).toBe('cart-1');
    expect(h.add).toHaveBeenCalledWith(expect.anything(), expect.anything(), valid);
  });

  it('refuses a body with a price field, whatever its value', async () => {
    for (const field of ['price', 'externalPrice', 'centAmount']) {
      expect((await post({ ...valid, [field]: 1 })).status).toBe(400);
    }
    expect(h.add).not.toHaveBeenCalled();
  });

  it('refuses a preset outside 0 to 19 and a quantity outside 1 to 99', async () => {
    expect((await post({ ...valid, preset: 20 })).status).toBe(400);
    expect((await post({ ...valid, preset: -1 })).status).toBe(400);
    expect((await post({ ...valid, quantity: 0 })).status).toBe(400);
    expect((await post({ ...valid, quantity: 100 })).status).toBe(400);
    expect(h.add).not.toHaveBeenCalled();
  });

  it('answers 422 bundle_not_subscribable for a subscribe request', async () => {
    const res = await post({ ...valid, fulfilment: 'subscribe', recurrencePolicyKey: 'mcf-every-month' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('bundle_not_subscribable');
    expect(h.add).not.toHaveBeenCalled();
  });

  it('passes a domain refusal through with its code and extras', async () => {
    h.refuse = { code: 'bundle_preset_unavailable', status: 422, extra: { reason: 'no-price' } };
    const res = await post(valid);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: 'bundle_preset_unavailable', reason: 'no-price' } });
  });
});
