// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { checkoutNow, isBeforeSameDayCutoff, newYorkMinutes } from '@/lib/checkout/config';

let shop: FakeShop;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (shop.apiRoot as Record<string, unknown>)[p as string] }) }));

import { getOptionsForCart } from './shipping-options';

// 2026-10-08 is in daylight time: New York = UTC-4.
const at = (hhmmNy: string) => new Date(`2026-10-08T${hhmmNy}:00-04:00`);
const keys = async (cartId: string, now: Date) => (await getOptionsForCart(cartId, now)).map((o) => o.key);

beforeEach(() => {
  shop = createFakeShop();
});

describe('checkout-page: delivery options for the cart (Q-01)', () => {
  it('asks the platform which methods match the cart and never lists a method the platform did not return', async () => {
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state: 'CA' } });
    expect(await keys(cart.id, at('09:00'))).toEqual(['mlv-standard']);
    expect(shop.matchingCalls).toEqual([cart.id]);
  });

  it('offers standard FREE and same-day $5.00 in a same-day state before the cut-off', async () => {
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state: 'NY' } });
    const options = await getOptionsForCart(cart.id, at('13:59'));
    expect(options.map((o) => [o.key, o.price.centAmount])).toEqual([
      ['mlv-standard', 0],
      ['mlv-same-day', 500],
    ]);
  });

  it('withdraws same-day at exactly 14:00 New York and after', async () => {
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state: 'NY' } });
    expect(await keys(cart.id, at('14:00'))).toEqual(['mlv-standard']);
    expect(await keys(cart.id, at('18:30'))).toEqual(['mlv-standard']);
  });

  it.each(['NY', 'TX', 'IL'])('same-day is offered in %s', async (state) => {
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state } });
    expect(await keys(cart.id, at('08:00'))).toContain('mlv-same-day');
  });

  it('out-of-state address: no same-day even before the cut-off', async () => {
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state: 'CA' } });
    expect(await keys(cart.id, at('08:00'))).not.toContain('mlv-same-day');
  });

  it('an address no method serves gives an empty list', async () => {
    shop.unserved.add('AK');
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state: 'AK' } });
    expect(await getOptionsForCart(cart.id, at('08:00'))).toEqual([]);
  });
});

describe('checkout config: cut-off in America/New_York', () => {
  it('follows daylight saving time: 14:00 EST in winter is 19:00 UTC', () => {
    expect(isBeforeSameDayCutoff(new Date('2026-01-15T18:59:00Z'))).toBe(true);
    expect(isBeforeSameDayCutoff(new Date('2026-01-15T19:00:00Z'))).toBe(false);
    expect(isBeforeSameDayCutoff(new Date('2026-07-15T17:59:00Z'))).toBe(true);
    expect(isBeforeSameDayCutoff(new Date('2026-07-15T18:00:00Z'))).toBe(false);
  });

  it('newYorkMinutes is minutes since local midnight', () => {
    expect(newYorkMinutes(at('00:05'))).toBe(5);
    expect(newYorkMinutes(at('23:59'))).toBe(23 * 60 + 59);
  });

  it('SAME_DAY_NOW_OVERRIDE is used in development and ignored in production or when malformed', () => {
    const real = new Date('2026-10-08T20:00:00Z');
    expect(checkoutNow({ SAME_DAY_NOW_OVERRIDE: '2026-10-08T10:00:00-04:00', NODE_ENV: 'development' }, real).toISOString()).toBe('2026-10-08T14:00:00.000Z');
    expect(checkoutNow({ SAME_DAY_NOW_OVERRIDE: '2026-10-08T10:00:00-04:00', NODE_ENV: 'production' }, real)).toBe(real);
    expect(checkoutNow({ SAME_DAY_NOW_OVERRIDE: 'not a date' }, real)).toBe(real);
    expect(checkoutNow({}, real)).toBe(real);
  });
});
