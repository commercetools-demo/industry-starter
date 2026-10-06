// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cart', () => ({ updateCart: vi.fn(), withCartRetry: vi.fn() }));
const execute = vi.fn();
const get = vi.fn(() => ({ execute }));
vi.mock('./client', () => ({ getApiRoot: () => ({ shippingMethods: () => ({ matchingCart: () => ({ get }) }) }) }));

import { clearSlot, ensureShippingMethod, setShippingAddress, setSlot, ShippingMethodUnavailableError } from './cart-delivery';
import { updateCart, withCartRetry } from './cart';

const slot = { id: '20261012-10', start: '2026-10-12T10:00:00.000Z', end: '2026-10-12T12:00:00.000Z', holdExpires: '2026-10-12T09:15:00.000Z' };
const base = (over: Record<string, unknown> = {}) => ({ id: 'c1', version: 3, ...over }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(updateCart).mockResolvedValue(base({ version: 4 }));
  get.mockImplementation(() => ({ execute }));
});
const withCart = (cart: unknown) => vi.mocked(withCartRetry).mockImplementation(async (_id, fn) => fn(cart as never));

describe('setSlot', () => {
  it('sets the custom type once when the cart has none, then writes the four fields', async () => {
    withCart(base());
    await setSlot('c1', slot);
    expect(withCartRetry).toHaveBeenCalledWith('c1', expect.any(Function));
    expect(updateCart).toHaveBeenCalledWith('c1', 3, [
      { action: 'setCustomType', type: { typeId: 'type', key: 'cart-delivery' } },
      { action: 'setCustomField', name: 'slotId', value: '20261012-10' },
      { action: 'setCustomField', name: 'slotStart', value: slot.start },
      { action: 'setCustomField', name: 'slotEnd', value: slot.end },
      { action: 'setCustomField', name: 'slotHoldExpires', value: slot.holdExpires },
    ]);
  });

  it('never re-sets the custom type when the cart already has one (it would reset the fields)', async () => {
    withCart(base({ custom: { type: { typeId: 'type', id: 't' }, fields: {} } }));
    await setSlot('c1', slot);
    const actions = vi.mocked(updateCart).mock.calls[0][2];
    expect(actions.map((a) => a.action)).toEqual(['setCustomField', 'setCustomField', 'setCustomField', 'setCustomField']);
  });

  it('a slot without hold expiry removes a stale expiry field', async () => {
    withCart(base({ custom: { type: { typeId: 'type', id: 't' }, fields: { slotHoldExpires: 'old' } } }));
    await setSlot('c1', { id: slot.id, start: slot.start, end: slot.end });
    expect(vi.mocked(updateCart).mock.calls[0][2]).toContainEqual({ action: 'setCustomField', name: 'slotHoldExpires' });
  });

  it('null clears the slot', async () => {
    withCart(base({ custom: { type: { typeId: 'type', id: 't' }, fields: { slotId: 'x' } } }));
    await setSlot('c1', null);
    expect(vi.mocked(updateCart).mock.calls[0][2]).toEqual([{ action: 'setCustomField', name: 'slotId' }]);
  });
});

describe('clearSlot', () => {
  it('removes only the fields that are set (removing an unset field is a 400)', async () => {
    withCart(base({ custom: { type: { typeId: 'type', id: 't' }, fields: { slotId: 'a', slotStart: 'b', slotEnd: 'c', slotHoldExpires: 'd', other: 'keep' } } }));
    await clearSlot('c1');
    expect(vi.mocked(updateCart).mock.calls[0][2]).toEqual(
      ['slotId', 'slotStart', 'slotEnd', 'slotHoldExpires'].map((name) => ({ action: 'setCustomField', name })),
    );
  });

  it('nothing set: no commercetools call', async () => {
    withCart(base());
    await clearSlot('c1');
    withCart(base({ custom: { type: { typeId: 'type', id: 't' }, fields: {} } }));
    await clearSlot('c1');
    expect(updateCart).not.toHaveBeenCalled();
  });
});

describe('setShippingAddress', () => {
  it('sends only the filled fields', async () => {
    withCart(base());
    await setShippingAddress('c1', { firstName: 'Ada', lastName: 'L', streetName: 'Main 1', postalCode: '10001', city: 'NYC', country: 'US' });
    expect(withCartRetry).toHaveBeenCalledWith('c1', expect.any(Function));
    expect(updateCart).toHaveBeenCalledWith('c1', 3, [
      { action: 'setShippingAddress', address: { country: 'US', firstName: 'Ada', lastName: 'L', streetName: 'Main 1', postalCode: '10001', city: 'NYC' } },
    ]);
  });
});

describe('ensureShippingMethod', () => {
  const matching = [{ id: 'm-old', key: 'standard-shipping' }, { id: 'm-std', key: 'standard' }];

  it('picks the key `standard`, not the default 500.00 method', async () => {
    withCart(base());
    execute.mockResolvedValue({ body: { results: matching } });
    await ensureShippingMethod('c1');
    expect(get).toHaveBeenCalledWith({ queryArgs: { cartId: 'c1' } });
    expect(updateCart).toHaveBeenCalledWith('c1', 3, [{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', id: 'm-std' } }]);
  });

  it('already selected: no update', async () => {
    withCart(base({ shippingInfo: { shippingMethod: { id: 'm-std' } } }));
    execute.mockResolvedValue({ body: { results: matching } });
    await ensureShippingMethod('c1');
    expect(updateCart).not.toHaveBeenCalled();
  });

  it('standard does not match the cart: typed error', async () => {
    withCart(base());
    execute.mockResolvedValue({ body: { results: [matching[0]] } });
    await expect(ensureShippingMethod('c1')).rejects.toBeInstanceOf(ShippingMethodUnavailableError);
  });
});
