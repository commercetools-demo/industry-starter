// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/lib/mappers/__fixtures__/cart.json';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn(), updateSession: vi.fn() }));
vi.mock('@/lib/cart-api', async (orig) => ({ ...(await orig<typeof import('@/lib/cart-api')>()), getSessionCart: vi.fn() }));
vi.mock('@/lib/ct/cart-delivery', () => ({ setSlot: vi.fn(), clearSlot: vi.fn() }));
vi.mock('@/lib/slots/days', () => ({ getSlotDays: vi.fn() }));
const holdSlot = vi.fn();
const releaseHold = vi.fn();
vi.mock('@/lib/slots', () => ({ getSlotService: () => ({ holdSlot, releaseHold }) }));

import { DELETE, PUT } from './route';
import { getSessionCart } from '@/lib/cart-api';
import { clearSlot, setSlot } from '@/lib/ct/cart-delivery';
import { getMarket } from '@/lib/session';
import { getSlotDays } from '@/lib/slots/days';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const cart = { ...(fixture as Record<string, unknown>), id: 'cart-1' } as never;
const noSlotCart = { ...(fixture as Record<string, unknown>), custom: undefined } as never;
const put = (body: unknown) =>
  PUT(new Request('http://localhost/api/cart/slot', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const days = [{ date: '2026-10-13', slots: [{ id: '20261013-12', start: 's', end: 'e', remaining: 4 }] }];
const expires = new Date('2026-10-12T09:15:00.000Z');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue(market);
  vi.mocked(getSessionCart).mockResolvedValue({ ...(cart as object), shippingAddress: { country: 'US', postalCode: '10001' } } as never);
  vi.mocked(getSlotDays).mockResolvedValue({ ok: true, days });
  holdSlot.mockResolvedValue({ ok: true, expires });
  vi.mocked(setSlot).mockResolvedValue(cart);
  vi.mocked(clearSlot).mockResolvedValue(noSlotCart);
});

describe('PUT /api/cart/slot', () => {
  it.each([{}, { slotId: '' }, { slotId: 5 }])('invalid body %j: 400', async (body) => {
    expect((await put(body)).status).toBe(400);
    expect(holdSlot).not.toHaveBeenCalled();
  });

  it('unknown slot id: 400 UNKNOWN_SLOT without a hold', async () => {
    const res = await put({ slotId: '20261013-09' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'UNKNOWN_SLOT' });
    expect(holdSlot).not.toHaveBeenCalled();
  });

  it('Pick a slot: holds it for 15 minutes and writes the fields, returns the cart', async () => {
    const res = await put({ slotId: '20261013-10' });
    expect(res.status).toBe(200);
    expect(holdSlot).toHaveBeenCalledWith('20261013-10', 'cart-1', 15);
    expect(setSlot).toHaveBeenCalledWith('cart-1', {
      id: '20261013-10',
      start: '2026-10-13T10:00:00.000Z',
      end: '2026-10-13T12:00:00.000Z',
      holdExpires: '2026-10-12T09:15:00.000Z',
    });
    const body = await res.json();
    expect(body.cart.id).toBe('cart-1');
    expect(body.cart.slot).toBeDefined();
  });

  it('No capacity: 409 SLOT_FULL with fresh days, nothing written', async () => {
    holdSlot.mockResolvedValue({ ok: false, reason: 'FULL' });
    const res = await put({ slotId: '20261013-10' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'SLOT_FULL', days });
    expect(setSlot).not.toHaveBeenCalled();
  });

  it('hold says UNKNOWN (for example the window already started): 400 UNKNOWN_SLOT', async () => {
    holdSlot.mockResolvedValue({ ok: false, reason: 'UNKNOWN' });
    const res = await put({ slotId: '20261013-10' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'UNKNOWN_SLOT' });
  });

  it('no address: 400 NO_ADDRESS, no hold', async () => {
    vi.mocked(getSlotDays).mockResolvedValue({ ok: false, error: 'NO_ADDRESS' });
    const res = await put({ slotId: '20261013-10' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'NO_ADDRESS' });
    expect(holdSlot).not.toHaveBeenCalled();
  });

  it('undeliverable address: 422', async () => {
    vi.mocked(getSlotDays).mockResolvedValue({ ok: false, error: 'UNDELIVERABLE' });
    expect((await put({ slotId: '20261013-10' })).status).toBe(422);
  });

  it('no cart: 404 CART_NOT_FOUND', async () => {
    vi.mocked(getSessionCart).mockResolvedValue(null);
    const res = await put({ slotId: '20261013-10' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'CART_NOT_FOUND' });
  });

  it('writing the cart fails: the hold is released again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(setSlot).mockRejectedValue(new Error('boom'));
    const res = await put({ slotId: '20261013-10' });
    expect(res.status).toBe(500);
    expect(releaseHold).toHaveBeenCalledWith('cart-1');
  });
});

describe('DELETE /api/cart/slot', () => {
  it('releases the hold and clears the fields', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(releaseHold).toHaveBeenCalledWith('cart-1');
    expect(clearSlot).toHaveBeenCalledWith('cart-1');
    expect((await res.json()).cart.slot).toBeUndefined();
  });

  it('no cart: 404', async () => {
    vi.mocked(getSessionCart).mockResolvedValue(null);
    expect((await DELETE()).status).toBe(404);
    expect(releaseHold).not.toHaveBeenCalled();
  });
});
