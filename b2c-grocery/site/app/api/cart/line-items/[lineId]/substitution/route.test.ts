// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from '@/lib/mappers/__fixtures__/cart.json';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/ct/cart', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/cart')>()),
  getCart: vi.fn(),
  setLineItemSubstitution: vi.fn(),
  withCartRetry: vi.fn(),
}));

import { PATCH } from './route';
import { getCart, setLineItemSubstitution, withCartRetry } from '@/lib/ct/cart';
import { getMarket, getSession } from '@/lib/session';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const cart = () => fixture as never;
const patch = (lineId: string, body: unknown) =>
  PATCH(new Request('http://localhost/api/cart/line-items/x/substitution', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ lineId }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue(market);
  vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
  vi.mocked(getCart).mockResolvedValue(cart());
  vi.mocked(setLineItemSubstitution).mockResolvedValue(cart());
  vi.mocked(withCartRetry).mockImplementation(async (_id, fn) => fn(cart()));
});

describe('PATCH /api/cart/line-items/[lineId]/substitution', () => {
  it.each(['maybe', '', 3, null])('Invalid value %s: 400 and nothing is written', async (preference) => {
    const res = await patch('line-bananas', { preference });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_PREFERENCE');
    expect(setLineItemSubstitution).not.toHaveBeenCalled();
  });

  it('Change preference: writes the preference through withCartRetry and returns the cart', async () => {
    const res = await patch('line-bananas', { preference: 'none' });
    expect(res.status).toBe(200);
    expect(setLineItemSubstitution).toHaveBeenCalledWith(expect.anything(), 'line-bananas', 'none');
    expect((await res.json()).cart.id).toBe('cart-1');
  });

  it('no cart in the session: 404', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    expect((await patch('line-bananas', { preference: 'none' })).status).toBe(404);
  });

  it('unknown line: 404 LINE_NOT_FOUND', async () => {
    const res = await patch('nope', { preference: 'none' });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('LINE_NOT_FOUND');
  });
});
