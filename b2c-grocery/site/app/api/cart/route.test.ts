// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from '@/lib/mappers/__fixtures__/cart.json';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/ct/cart', async (orig) => ({ ...(await orig<typeof import('@/lib/ct/cart')>()), getCart: vi.fn() }));

import { GET } from './route';
import { getCart } from '@/lib/ct/cart';
import { getMarket, getSession, updateSession } from '@/lib/session';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue(market);
});

describe('GET /api/cart', () => {
  it('anonymous visitor without a cart id: { cart: null } and no commercetools call', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cart: null });
    expect(getCart).not.toHaveBeenCalled();
  });

  it('returns the full mapped cart for an anonymous session', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1', anonymousId: 'anon-1' });
    vi.mocked(getCart).mockResolvedValue(fixture as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const { cart } = await res.json();
    expect(cart.id).toBe('cart-1');
    expect(cart.itemCount).toBe(2);
    expect(cart.total).toEqual({ centAmount: 1047, currencyCode: 'USD' });
  });

  it('non-Active cart: clears cartId from the session and returns { cart: null }', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-old' });
    vi.mocked(getCart).mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ cart: null });
    expect(updateSession).toHaveBeenCalledWith({ cartId: undefined }, expect.anything());
  });

  it('commercetools failure: 500 with an error code', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getCart).mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'CART_ERROR' });
  });
});
