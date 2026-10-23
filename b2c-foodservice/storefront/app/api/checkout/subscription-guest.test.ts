// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ jar: new Map<string, string>(), view: vi.fn(), payCart: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/cart', () => ({ getCartView: h.view }));
vi.mock('@/lib/ct/orders', () => ({ getOrderByNumber: vi.fn(async () => null) }));
vi.mock('@/lib/ct/checkout-session', () => ({ createCheckoutSession: h.create }));
vi.mock('@/lib/ct/checkout', async () => {
  const { checkoutBlockers } = await import('@/lib/checkout/guards');
  return {
    getPaymentCart: h.payCart,
    isCollectReady: () => true,
    totalCentsOf: (c: { total: number }) => c.total,
    firstBlocker: (cart: Parameters<typeof checkoutBlockers>[0], s: { customerId?: string }) => checkoutBlockers(cart, s)[0] ?? null,
  };
});

import { POST as session } from './session/route';
import { checkoutBlockers, subscribeNeedsAccount } from '@/lib/checkout/guards';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';
import { usd, viewCart, viewLine } from '@/test/cart';

const sub = viewLine({ id: 's1', fulfilment: 'subscribe', unitPrice: usd(1500), recurrence: { policyId: 'rp', schedule: { unit: 'Months', value: 1 } } });
const ship = viewLine({ id: 'd1', fulfilment: 'delivery' });

describe('guest rule for subscribe lines (Q-N-4)', () => {
  it('guest with a subscribe line gets the sign_in_required blocker', () => {
    expect(subscribeNeedsAccount(viewCart([sub, ship]), {})).toBe(true);
    expect(checkoutBlockers(viewCart([sub, ship]), {}).map((b) => b.code)).toEqual(['sign_in_required']);
  });

  it('signed-in customer with a subscribe line has no blocker', () => {
    expect(subscribeNeedsAccount(viewCart([sub]), { customerId: 'c1' })).toBe(false);
    expect(checkoutBlockers(viewCart([sub]), { customerId: 'c1' })).toEqual([]);
  });

  it('bag without subscribe lines is unchanged', () => {
    expect(checkoutBlockers(viewCart([ship]), {})).toEqual([]);
  });

  describe('POST /api/checkout/session', () => {
    beforeEach(async () => {
      h.jar.clear();
      for (const f of [h.view, h.payCart, h.create]) f.mockReset();
      h.payCart.mockResolvedValue({ id: 'cart-1', total: 1500, lineItems: [{}] });
      h.create.mockResolvedValue({ id: 'sess-1', projectKey: 'p', region: 'r', expiresAt: null });
    });
    const post = () => session(new Request('http://x/api', { method: 'POST', body: JSON.stringify({ expectedTotalCents: 1500 }) }), { params: Promise.resolve({}) });
    const setSession = async (s: Record<string, string>) => h.jar.set(SESSION_COOKIE, await createSessionToken(s));

    it('session handler answers 401 sign_in_required for a guest bag with a subscribe line', async () => {
      await setSession({ anonymousId: 'anon', cartId: 'cart-1', country: 'US', currency: 'USD', locale: 'en-US' });
      h.view.mockResolvedValue({ cart: viewCart([sub]), session: {} });
      const res = await post();
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('sign_in_required');
      expect(h.create).not.toHaveBeenCalled();
    });

    it('a signed-in customer reaches the hosted session', async () => {
      await setSession({ customerId: 'c1', cartId: 'cart-1', country: 'US', currency: 'USD', locale: 'en-US' });
      h.view.mockResolvedValue({ cart: viewCart([sub]), session: {} });
      expect((await post()).status).toBe(200);
    });
  });
});
