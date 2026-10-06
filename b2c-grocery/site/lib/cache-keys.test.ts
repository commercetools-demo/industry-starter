import { describe, it, expect } from 'vitest';
import * as keys from './cache-keys';

describe('cache keys', () => {
  it('static keys are distinct', () => {
    const values = [keys.KEY_CART, keys.KEY_ACCOUNT, keys.KEY_ORDERS, keys.KEY_ADDRESSES, keys.KEY_WISHLIST, keys.KEY_RECURRING];
    expect(new Set(values).size).toBe(values.length);
  });
  it('keyOrdersPage: page 1 is KEY_ORDERS, later pages are distinct and clearable by prefix', () => {
    expect(keys.keyOrdersPage(1)).toBe(keys.KEY_ORDERS);
    expect(keys.keyOrdersPage(2)).not.toBe(keys.keyOrdersPage(3));
    expect(keys.keyOrdersPage(2).startsWith('orders:')).toBe(true);
    expect(keys.KEY_PROFILE).not.toBe(keys.KEY_ACCOUNT);
  });
  it('keyOrder is per order and distinct from KEY_ORDERS', () => {
    expect(keys.keyOrder('a')).not.toBe(keys.keyOrder('b'));
    expect(keys.keyOrder('a')).not.toBe(keys.KEY_ORDERS);
  });
});
