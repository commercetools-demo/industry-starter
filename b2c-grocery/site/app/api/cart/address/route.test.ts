// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/lib/mappers/__fixtures__/cart.json';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/ct/cart', async (orig) => ({ ...(await orig<typeof import('@/lib/ct/cart')>()), getCart: vi.fn() }));
vi.mock('@/lib/ct/cart-delivery', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/cart-delivery')>()),
  setShippingAddress: vi.fn(),
  ensureShippingMethod: vi.fn(),
  clearSlot: vi.fn(),
}));
const releaseHold = vi.fn();
vi.mock('@/lib/slots', () => ({ getSlotService: () => ({ releaseHold }) }));

import { PUT } from './route';
import { getCart } from '@/lib/ct/cart';
import { clearSlot, ensureShippingMethod, setShippingAddress, ShippingMethodUnavailableError } from '@/lib/ct/cart-delivery';
import { getMarket, getSession } from '@/lib/session';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const valid = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', postalCode: '10001', city: 'New York', country: 'US' };
const put = (body: unknown) =>
  PUT(new Request('http://localhost/api/cart/address', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const withSlot = () => ({ ...(fixture as Record<string, unknown>), country: 'US' }) as never;
const withoutSlot = () => ({ ...(fixture as Record<string, unknown>), country: 'US', custom: undefined }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue(market);
  vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
  vi.mocked(getCart).mockResolvedValue(withSlot());
  vi.mocked(setShippingAddress).mockImplementation(async () => withSlot());
  vi.mocked(ensureShippingMethod).mockImplementation(async () => withSlot());
  vi.mocked(clearSlot).mockImplementation(async () => withoutSlot());
});

describe('PUT /api/cart/address', () => {
  it.each([
    [{ ...valid, firstName: '' }, 'firstName'],
    [{ ...valid, postalCode: '1234' }, 'postalCode'],
    [{ ...valid, country: 'FR' }, 'country'],
    [{ ...valid, city: undefined }, 'city'],
    [{ ...valid, country: 'DE', postalCode: '10001-1234' }, 'postalCode'],
  ])('invalid input %#: 400 naming the field', async (body, field) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_ADDRESS', fields: [field] });
    expect(setShippingAddress).not.toHaveBeenCalled();
  });

  it('no session cart: 404 CART_NOT_FOUND', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await put(valid);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'CART_NOT_FOUND' });
  });

  it('address in another country than the cart market: 422 COUNTRY_MISMATCH, nothing written', async () => {
    const res = await put({ ...valid, country: 'DE', postalCode: '10115' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'COUNTRY_MISMATCH' });
    expect(setShippingAddress).not.toHaveBeenCalled();
  });

  it('valid address: sets the address and the standard shipping method, returns the cart with the shipping line', async () => {
    const res = await put({ ...valid, postalCode: ' 10001 ', phone: '555' });
    expect(res.status).toBe(200);
    expect(setShippingAddress).toHaveBeenCalledWith('cart-1', { ...valid, phone: '555' });
    expect(ensureShippingMethod).toHaveBeenCalledWith('cart-1');
    const body = await res.json();
    expect(body.slotCleared).toBe(false);
    expect(body.cart.id).toBe('cart-1');
    expect(body.cart.shipping).toEqual({ name: 'Standard', price: { centAmount: 302, currencyCode: 'USD' }, free: false });
  });

  it('free delivery follows the rate: a zero shipping price is mapped as free', async () => {
    const free = { ...(fixture as Record<string, unknown>), shippingInfo: { shippingMethodName: 'Standard', price: { currencyCode: 'USD', centAmount: 0, fractionDigits: 2 } } } as never;
    vi.mocked(ensureShippingMethod).mockResolvedValue(free);
    const body = await (await put(valid)).json();
    expect(body.cart.shipping.free).toBe(true);
  });

  it('unchanged valid address keeps the slot', async () => {
    const res = await put(valid);
    const body = await res.json();
    expect(body.slotCleared).toBe(false);
    expect(body.cart.slot).toMatchObject({ id: '2026-10-12-09' });
    expect(clearSlot).not.toHaveBeenCalled();
    expect(releaseHold).not.toHaveBeenCalled();
  });

  it('undeliverable postcode: 422 UNDELIVERABLE, no shipping method, slot released and cleared', async () => {
    const res = await put({ ...valid, postalCode: '99999' });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'UNDELIVERABLE', slotCleared: true });
    expect(body.cart.slot).toBeUndefined();
    expect(setShippingAddress).toHaveBeenCalledWith('cart-1', expect.objectContaining({ postalCode: '99999' }));
    expect(ensureShippingMethod).not.toHaveBeenCalled();
    expect(releaseHold).toHaveBeenCalledWith('cart-1');
    expect(clearSlot).toHaveBeenCalledWith('cart-1');
  });

  it('undeliverable postcode without a slot: 422, slotCleared false, nothing to release', async () => {
    vi.mocked(getCart).mockResolvedValue(withoutSlot());
    vi.mocked(setShippingAddress).mockImplementation(async () => withoutSlot());
    const res = await put({ ...valid, postalCode: '00501' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'UNDELIVERABLE', slotCleared: false });
    expect(releaseHold).not.toHaveBeenCalled();
  });

  it('standard shipping method not applicable: 422 SHIPPING_UNAVAILABLE', async () => {
    vi.mocked(ensureShippingMethod).mockRejectedValue(new ShippingMethodUnavailableError('cart-1'));
    const res = await put(valid);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'SHIPPING_UNAVAILABLE' });
  });

  it('commercetools failure: 500 CART_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(setShippingAddress).mockRejectedValue(new Error('boom'));
    const res = await put(valid);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'CART_ERROR' });
  });
});
