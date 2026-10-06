import { describe, expect, it } from 'vitest';
import { canCheckout, checkoutBlock, isSlotActive } from './cart-rules';
import { cartLine, makeCart } from '@/test/cart';

const slot = (holdExpires?: string) => ({ id: '20261012-10', start: 's', end: 'e', ...(holdExpires ? { holdExpires } : {}) });
const now = new Date('2026-10-12T09:00:00Z');
const address = { firstName: 'Ada', streetName: '1 Main', postalCode: '10001', city: 'NYC', country: 'US' };
const ready = (over = {}) => makeCart({ shippingAddress: address, slot: slot('2026-10-12T09:10:00Z'), ...over });

describe('isSlotActive', () => {
  it('no slot: false', () => expect(isSlotActive(undefined, now)).toBe(false));
  it('hold in the future: true', () => expect(isSlotActive(slot('2026-10-12T09:10:00Z'), now)).toBe(true));
  it('hold expired: false', () => expect(isSlotActive(slot('2026-10-12T09:00:00Z'), now)).toBe(false));
  it('no hold info: true', () => expect(isSlotActive(slot(), now)).toBe(true));
});

describe('canCheckout', () => {
  it('address, slot and stock: allowed', () => {
    expect(canCheckout(ready(), now)).toBe(true);
    expect(checkoutBlock(ready(), now)).toBeNull();
  });
  it('no lines: EMPTY', () => expect(checkoutBlock(ready({ lines: [] }), now)).toBe('EMPTY'));
  it('out-of-stock line: blocked', () => {
    const cart = ready({ lines: [cartLine(), cartLine({ id: 'l2', inStock: false })] });
    expect(checkoutBlock(cart, now)).toBe('OUT_OF_STOCK');
    expect(canCheckout(cart, now)).toBe(false);
  });
  it('no address: blocked', () => expect(checkoutBlock(ready({ shippingAddress: undefined }), now)).toBe('NO_ADDRESS'));
  it('address without postcode: blocked', () =>
    expect(checkoutBlock(ready({ shippingAddress: { ...address, postalCode: undefined } }), now)).toBe('NO_ADDRESS'));
  it.each(['99999', '00123'])('undeliverable postcode %s: blocked', (postalCode) => {
    expect(checkoutBlock(ready({ shippingAddress: { ...address, postalCode } }), now)).toBe('UNDELIVERABLE');
  });
  it('no slot: blocked', () => expect(checkoutBlock(ready({ slot: undefined }), now)).toBe('NO_SLOT'));
  it('slot hold expired: blocked', () => expect(checkoutBlock(ready({ slot: slot('2026-10-12T08:59:00Z') }), now)).toBe('NO_SLOT'));
});
