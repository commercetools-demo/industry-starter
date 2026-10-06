// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/lib/mappers/__fixtures__/cart.json';

vi.mock('@/lib/cart-api', async (orig) => ({ ...(await orig<typeof import('@/lib/cart-api')>()), getSessionCart: vi.fn() }));
vi.mock('@/lib/ct/availability', () => ({ getAvailableQuantity: vi.fn() }));
vi.mock('@/lib/ct/cart-delivery', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/cart-delivery')>()),
  clearSlot: vi.fn(),
  ensureShippingMethod: vi.fn(),
}));
vi.mock('@/lib/ct/checkout-session', () => ({ createCheckoutSession: vi.fn() }));
vi.mock('@/lib/slots/days', () => ({ getSlotDays: vi.fn() }));
const holdSlot = vi.fn();
vi.mock('@/lib/slots', () => ({ getSlotService: () => ({ holdSlot }) }));

import { POST } from './route';
import { getSessionCart } from '@/lib/cart-api';
import { getAvailableQuantity } from '@/lib/ct/availability';
import { clearSlot, ensureShippingMethod, ShippingMethodUnavailableError } from '@/lib/ct/cart-delivery';
import { createCheckoutSession } from '@/lib/ct/checkout-session';
import { getSlotDays } from '@/lib/slots/days';

const base = fixture as unknown as { lineItems: { id: string; quantity: number; variant: { sku: string } }[]; custom?: unknown };
const slotFields = { slotId: '20261013-10', slotStart: 's', slotEnd: 'e', slotHoldExpires: '2026-10-12T09:15:00.000Z' };
const readyCart = {
  ...base,
  id: 'cart-1',
  shippingAddress: { country: 'US', postalCode: '10001' },
  custom: { type: { typeId: 'type', id: 't' }, fields: slotFields },
} as never;
const days = [{ date: '2026-10-13', slots: [] }];
const post = () => POST();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSessionCart).mockResolvedValue(readyCart);
  vi.mocked(getAvailableQuantity).mockResolvedValue(1000);
  vi.mocked(ensureShippingMethod).mockResolvedValue(readyCart);
  vi.mocked(clearSlot).mockResolvedValue(readyCart);
  vi.mocked(getSlotDays).mockResolvedValue({ ok: true, days });
  holdSlot.mockResolvedValue({ ok: true, expires: new Date('2026-10-12T09:15:00.000Z') });
  vi.mocked(createCheckoutSession).mockResolvedValue({ sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' });
});

const noSessionCreated = () => expect(createCheckoutSession).not.toHaveBeenCalled();

describe('POST /api/checkout/session', () => {
  it('No cart (400): NO_CART and no session', async () => {
    vi.mocked(getSessionCart).mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'NO_CART' });
    noSessionCreated();
  });

  it('Empty cart: 400 EMPTY_CART', async () => {
    vi.mocked(getSessionCart).mockResolvedValue({ ...(readyCart as object), lineItems: [] } as never);
    const res = await post();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'EMPTY_CART' });
    noSessionCreated();
  });

  it('Line out of stock: 409 UNAVAILABLE_LINES names the lines', async () => {
    const [first] = base.lineItems;
    vi.mocked(getAvailableQuantity).mockImplementation(async (sku) => (sku === first.variant.sku ? first.quantity - 1 : 1000));
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'UNAVAILABLE_LINES', lines: [first.id] });
    expect(holdSlot).not.toHaveBeenCalled();
    noSessionCreated();
  });

  it('Missing address: 422 NO_ADDRESS', async () => {
    vi.mocked(getSessionCart).mockResolvedValue({ ...(readyCart as object), shippingAddress: undefined } as never);
    const res = await post();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'NO_ADDRESS' });
    noSessionCreated();
  });

  it('Undeliverable address: 422 NO_ADDRESS', async () => {
    vi.mocked(getSessionCart).mockResolvedValue({ ...(readyCart as object), shippingAddress: { country: 'US', postalCode: '00123' } } as never);
    expect((await post()).status).toBe(422);
    noSessionCreated();
  });

  it('Missing slot: 422 NO_SLOT without a hold', async () => {
    vi.mocked(getSessionCart).mockResolvedValue({ ...(readyCart as object), custom: undefined } as never);
    const res = await post();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'NO_SLOT' });
    expect(holdSlot).not.toHaveBeenCalled();
    noSessionCreated();
  });

  it('Shipping method not applicable: 422 SHIPPING_UNAVAILABLE', async () => {
    vi.mocked(ensureShippingMethod).mockRejectedValue(new ShippingMethodUnavailableError('cart-1'));
    const res = await post();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'SHIPPING_UNAVAILABLE' });
    noSessionCreated();
  });

  it('Slot filled (handoff): clears the slot, answers 409 SLOT_FULL with fresh days, no session', async () => {
    holdSlot.mockResolvedValue({ ok: false, reason: 'FULL' });
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'SLOT_FULL', days });
    expect(clearSlot).toHaveBeenCalledWith('cart-1');
    expect(getSlotDays).toHaveBeenCalledWith({ shippingAddress: { country: 'US', postalCode: '10001' } });
    noSessionCreated();
  });

  it('Ready cart: holds the slot for 15 minutes, then creates the session and returns the ids', async () => {
    const order: string[] = [];
    holdSlot.mockImplementation(async () => {
      order.push('hold');
      return { ok: true, expires: new Date() };
    });
    vi.mocked(createCheckoutSession).mockImplementation(async () => {
      order.push('create');
      return { sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' };
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' });
    expect(holdSlot).toHaveBeenCalledWith('20261013-10', 'cart-1', 15);
    expect(createCheckoutSession).toHaveBeenCalledWith('cart-1');
    expect(order).toEqual(['hold', 'create']);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('Sessions API failure: 500 CHECKOUT_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createCheckoutSession).mockRejectedValue(new Error('boom'));
    const res = await post();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'CHECKOUT_ERROR' });
  });
});
