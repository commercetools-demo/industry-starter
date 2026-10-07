// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from '@/lib/mappers/__fixtures__/cart.json';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/ct/cart', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/cart')>()),
  getCart: vi.fn(),
  createCart: vi.fn(),
  addLineItem: vi.fn(),
  withCartRetry: vi.fn(),
}));
vi.mock('@/lib/config/features', async (orig) => ({ ...(await orig<typeof import('@/lib/config/features')>()), subscriptionsEnabled: vi.fn(() => true) }));
vi.mock('@/lib/ct/availability', () => ({ getAvailableQuantity: vi.fn() }));
vi.mock('@/lib/ct/search', () => ({ getProductBySku: vi.fn() }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: vi.fn().mockResolvedValue([]) }));

import { POST } from './route';
import { subscriptionsEnabled } from '@/lib/config/features';
import { getAvailableQuantity } from '@/lib/ct/availability';
import { addLineItem, createCart, getCart, withCartRetry } from '@/lib/ct/cart';
import { getCategoryTree } from '@/lib/ct/categories';
import { getProductBySku } from '@/lib/ct/search';
import { getMarket, getSession, updateSession } from '@/lib/session';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const post = (body: unknown) =>
  POST(new Request('http://localhost/api/cart/line-items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const cart = (over: Record<string, unknown> = {}) => ({ ...(fixture as Record<string, unknown>), ...over }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue(market);
  vi.mocked(getSession).mockResolvedValue({});
  vi.mocked(getCategoryTree).mockResolvedValue([]);
  vi.mocked(subscriptionsEnabled).mockReturnValue(true);
  vi.mocked(getProductBySku).mockResolvedValue({ storage: 'chilled', categoryIds: [], recurringEligible: true } as never);
  vi.mocked(getAvailableQuantity).mockResolvedValue(10);
  vi.mocked(addLineItem).mockResolvedValue(cart());
  vi.mocked(withCartRetry).mockImplementation(async (id, fn) => fn(cart({ id })));
});

describe('POST /api/cart/line-items', () => {
  it.each([0, -1, 1.5, '2', null])('bad quantity %s: 400', async (quantity) => {
    const res = await post({ sku: 'MILK-1L', quantity });
    expect(res.status).toBe(400);
    expect(addLineItem).not.toHaveBeenCalled();
  });

  it('missing sku: 400', async () => {
    expect((await post({ quantity: 1 })).status).toBe(400);
  });

  it('anonymous first add: creates the cart, adds the line and writes cartId and anonymousId to the session', async () => {
    vi.mocked(createCart).mockResolvedValue(cart({ id: 'cart-new', version: 1, anonymousId: 'anon-77' }));
    vi.mocked(addLineItem).mockResolvedValue(cart({ id: 'cart-new', version: 2, anonymousId: 'anon-77' }));
    const res = await post({ sku: 'MILK-1L', quantity: 2 });
    expect(res.status).toBe(200);
    expect(createCart).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD', country: 'US', locale: 'en-US' }));
    expect(addLineItem).toHaveBeenCalledWith('cart-new', 1, { sku: 'MILK-1L', quantity: 2, substitutionPreference: 'allow-similar' });
    expect(updateSession).toHaveBeenCalledWith({ cartId: 'cart-new', anonymousId: 'anon-77' }, expect.anything());
    expect((await res.json()).cart.id).toBe('cart-new');
  });

  it('existing cart: adds through withCartRetry and does not create a cart', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getCart).mockResolvedValue(cart());
    const res = await post({ sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: 'weekly' });
    expect(res.status).toBe(200);
    expect(createCart).not.toHaveBeenCalled();
    expect(addLineItem).toHaveBeenCalledWith('cart-1', 4, { sku: 'MILK-1L', quantity: 1, substitutionPreference: 'allow-similar', recurrencePolicyKey: 'weekly' });
  });

  it('Subscribe: an eligible product with a valid key adds the line with that policy (the cart layer sets Dynamic)', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getCart).mockResolvedValue(cart());
    expect((await post({ sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: 'every-2-weeks' })).status).toBe(200);
    expect(addLineItem).toHaveBeenCalledWith('cart-1', 4, expect.objectContaining({ recurrencePolicyKey: 'every-2-weeks' }));
  });

  it('Ineligible product: 400 NOT_RECURRING_ELIGIBLE and nothing is added', async () => {
    vi.mocked(getProductBySku).mockResolvedValue({ storage: 'ambient', categoryIds: [], recurringEligible: false } as never);
    const res = await post({ sku: 'BANANAS-500G', quantity: 1, recurrencePolicyKey: 'weekly' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'NOT_RECURRING_ELIGIBLE' });
    expect(addLineItem).not.toHaveBeenCalled();
    expect(createCart).not.toHaveBeenCalled();
  });

  it.each(['daily', 'Weekly', 5, true])('Unknown key %s: 400 INVALID_RECURRENCE', async (key) => {
    const res = await post({ sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: key });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_RECURRENCE' });
    expect(addLineItem).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ''])('One-time (%s): the request carries no recurrence key', async (key) => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getCart).mockResolvedValue(cart());
    expect((await post({ sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: key })).status).toBe(200);
    expect(vi.mocked(addLineItem).mock.calls[0][2]).not.toHaveProperty('recurrencePolicyKey');
  });

  it('flag off: a recurrence request is refused (400 INVALID_RECURRENCE), one-time still works', async () => {
    vi.mocked(subscriptionsEnabled).mockReturnValue(false);
    expect((await post({ sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: 'weekly' })).status).toBe(400);
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getCart).mockResolvedValue(cart());
    expect((await post({ sku: 'MILK-1L', quantity: 1 })).status).toBe(200);
  });

  it('Over-ask: 409 INSUFFICIENT_STOCK with the available quantity, cart unchanged', async () => {
    vi.mocked(getAvailableQuantity).mockResolvedValue(3);
    const res = await post({ sku: 'MILK-1L', quantity: 4 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'INSUFFICIENT_STOCK', available: 3 });
    expect(createCart).not.toHaveBeenCalled();
    expect(addLineItem).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('Add three: existing quantity counts toward the request (2 in bag + 2 > 3 available)', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getCart).mockResolvedValue(cart()); // BANANAS-500G x2 in the fixture
    vi.mocked(getAvailableQuantity).mockResolvedValue(3);
    const res = await post({ sku: 'BANANAS-500G', quantity: 2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'INSUFFICIENT_STOCK', available: 3 });
    const ok = await post({ sku: 'BANANAS-500G', quantity: 1 });
    expect(ok.status).toBe(200);
  });

  it('out of stock (no inventory): 409 with available 0', async () => {
    vi.mocked(getAvailableQuantity).mockResolvedValue(0);
    const res = await post({ sku: 'CHEDDAR', quantity: 1 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'INSUFFICIENT_STOCK', available: 0 });
  });

  it('ambient household product gets substitution preference none', async () => {
    vi.mocked(getProductBySku).mockResolvedValue({ storage: 'ambient', categoryIds: [] } as never);
    vi.mocked(createCart).mockResolvedValue(cart({ version: 1 }));
    await post({ sku: 'SOAP', quantity: 1 });
    expect(addLineItem).toHaveBeenCalledWith(expect.anything(), 1, expect.objectContaining({ substitutionPreference: 'none' }));
  });

  it('unknown sku: 404', async () => {
    vi.mocked(getProductBySku).mockResolvedValue(null);
    expect((await post({ sku: 'NOPE', quantity: 1 })).status).toBe(404);
  });

  it('stale session cart (non-Active): a new cart is created', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-old' });
    vi.mocked(getCart).mockResolvedValue(null);
    vi.mocked(createCart).mockResolvedValue(cart({ id: 'cart-new', version: 1 }));
    vi.mocked(addLineItem).mockResolvedValue(cart({ id: 'cart-new', version: 2 }));
    const res = await post({ sku: 'MILK-1L', quantity: 1 });
    expect(res.status).toBe(200);
    expect(createCart).toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ cartId: 'cart-new' }), expect.anything());
  });
});
