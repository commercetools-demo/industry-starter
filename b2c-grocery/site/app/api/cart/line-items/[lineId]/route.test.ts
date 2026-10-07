// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from '@/lib/mappers/__fixtures__/cart.json';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/ct/cart', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/cart')>()),
  getCart: vi.fn(),
  changeLineItemQuantity: vi.fn(),
  removeLineItem: vi.fn(),
  withCartRetry: vi.fn(),
}));
vi.mock('@/lib/ct/availability', () => ({ getAvailableQuantity: vi.fn() }));

import { DELETE, PATCH } from './route';
import { getAvailableQuantity } from '@/lib/ct/availability';
import { changeLineItemQuantity, getCart, removeLineItem, withCartRetry } from '@/lib/ct/cart';
import { getMarket, getSession, updateSession } from '@/lib/session';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const ctx = (lineId: string) => ({ params: Promise.resolve({ lineId }) });
const patch = (lineId: string, body: unknown) =>
  PATCH(new Request('http://localhost/api/cart/line-items/x', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx(lineId));
const del = (lineId: string) => DELETE(new Request('http://localhost/api/cart/line-items/x', { method: 'DELETE' }), ctx(lineId));
const cart = () => fixture as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue(market);
  vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
  vi.mocked(getCart).mockResolvedValue(cart());
  vi.mocked(getAvailableQuantity).mockResolvedValue(10);
  vi.mocked(changeLineItemQuantity).mockResolvedValue(cart());
  vi.mocked(removeLineItem).mockResolvedValue(cart());
  vi.mocked(withCartRetry).mockImplementation(async (_id, fn) => fn(cart()));
});

describe('PATCH /api/cart/line-items/[lineId]', () => {
  it.each([0, -3, 2.5, 'x'])('bad quantity %s: 400', async (quantity) => {
    expect((await patch('line-bananas', { quantity })).status).toBe(400);
    expect(changeLineItemQuantity).not.toHaveBeenCalled();
  });

  it('Increase quantity: updates through withCartRetry and returns the server cart', async () => {
    const res = await patch('line-bananas', { quantity: 5 });
    expect(res.status).toBe(200);
    expect(changeLineItemQuantity).toHaveBeenCalledWith('cart-1', 4, 'line-bananas', 5);
    expect((await res.json()).cart.id).toBe('cart-1');
  });

  it('Ask for more than available: 409 with available, cart unchanged', async () => {
    vi.mocked(getAvailableQuantity).mockResolvedValue(4);
    const res = await patch('line-bananas', { quantity: 5 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'INSUFFICIENT_STOCK', available: 4 });
    expect(changeLineItemQuantity).not.toHaveBeenCalled();
  });

  it('checks stock for the line SKU', async () => {
    await patch('line-bananas', { quantity: 2 });
    expect(getAvailableQuantity).toHaveBeenCalledWith('BANANAS-500G');
  });

  it('no cart in the session: 404', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    expect((await patch('line-bananas', { quantity: 2 })).status).toBe(404);
  });

  it('non-Active cart: clears the session and returns { cart: null }', async () => {
    vi.mocked(getCart).mockResolvedValue(null);
    const res = await patch('line-bananas', { quantity: 2 });
    expect(await res.json()).toEqual({ cart: null });
    expect(updateSession).toHaveBeenCalledWith({ cartId: undefined }, expect.anything());
  });

  it('unknown line: 404', async () => {
    expect((await patch('nope', { quantity: 2 })).status).toBe(404);
  });
});

describe('DELETE /api/cart/line-items/[lineId]', () => {
  it('removes the line and returns the server cart', async () => {
    const res = await del('line-milk');
    expect(res.status).toBe(200);
    expect(removeLineItem).toHaveBeenCalledWith('cart-1', 4, 'line-milk');
    expect((await res.json()).cart.id).toBe('cart-1');
  });

  it('unknown line: 404 and nothing removed', async () => {
    expect((await del('nope')).status).toBe(404);
    expect(removeLineItem).not.toHaveBeenCalled();
  });

  it('non-Active cart: clears the session', async () => {
    vi.mocked(getCart).mockResolvedValue(null);
    const res = await del('line-milk');
    expect(await res.json()).toEqual({ cart: null });
    expect(updateSession).toHaveBeenCalledWith({ cartId: undefined }, expect.anything());
  });
});
