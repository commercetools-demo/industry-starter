import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: [] as Array<{ keys: string[]; opts: { revalidate: number; tags: string[] } }> }));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, keys: string[], opts: { revalidate: number; tags: string[] }) => {
    calls.list.push({ keys, opts });
    return fn;
  },
}));
const project = vi.hoisted(() => ({ body: { countries: ['US', 'CA'], currencies: ['USD', 'CAD'], languages: ['en-US', 'en-CA'] } }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: { get: () => ({ execute: async () => ({ body: project.body }) }) },
}));

import {
  KEY_ACCOUNT, KEY_CART, KEY_CART_COUNT, TAG, TTL, keyAvailability, keyCart, keyChannels,
  keyOrder, keyOrders, keyShippingMethods,
} from '@/lib/cache-keys';
import { cachedPublic } from '@/lib/ct/public-cache';
import { fetchMarkets } from '@/lib/ct/project';

beforeEach(() => {
  project.body = { countries: ['US', 'CA'], currencies: ['USD', 'CAD'], languages: ['en-US', 'en-CA'] };
});

describe('cache keys', () => {
  it('Base keys KEY_CART, KEY_CART_COUNT and KEY_ACCOUNT are exported strings (other workstreams import them)', () => {
    expect([KEY_CART, KEY_CART_COUNT, KEY_ACCOUNT]).toEqual(['cart', 'cart-count', 'account']);
  });

  it('Keys of per-person data contain the customer id', () => {
    expect(keyOrders('u1')).toContain('u1');
    expect(keyOrder('u1', 'o1')).toEqual(['order', 'u1', 'o1']);
    expect(keyCart('u1')).toContain('u1');
    expect(keyCart(null)).toEqual(['cart', 'guest']);
  });

  it('Two customers never share a key', () => {
    expect(keyOrders('u1')).not.toEqual(keyOrders('u2'));
    expect(keyCart('u1')).not.toEqual(keyCart('u2'));
  });

  it('Market-scoped keys contain country and currency', () => {
    expect(keyShippingMethods('US', 'USD')).toEqual(['shipping-methods', 'US', 'USD']);
    expect(keyChannels('CA')).toContain('CA');
    expect(keyAvailability('sku', 'US', null)).toEqual(['availability', 'sku', 'US', 'online']);
  });
});

describe('cachedPublic', () => {
  it('cachedPublic sets the TTL and the tag of its kind', () => {
    cachedPublic('categories', ['cats'], async () => 1);
    const last = calls.list.at(-1);
    expect(last?.keys).toEqual(['cats']);
    expect(last?.opts).toEqual({ revalidate: TTL.categories, tags: [TAG.categories] });
  });

  it('Only public kinds can be cached (kind is one of the TTL keys)', () => {
    expect(Object.keys(TTL).sort()).toEqual(
      ['attributeLabels', 'categories', 'channels', 'project', 'recurrencePolicies', 'shippingMethods'],
    );
    expect(Object.keys(TAG).sort()).toEqual(Object.keys(TTL).sort());
  });
});

describe('getMarkets', () => {
  it('getMarkets keeps only markets the project supports', async () => {
    project.body = { countries: ['US'], currencies: ['USD', 'CAD'], languages: ['en-US', 'en-CA'] };
    expect((await fetchMarkets()).map((m) => m.country)).toEqual(['US']);
  });

  it('getMarkets matches languages case-insensitively', async () => {
    project.body = { countries: ['US', 'CA'], currencies: ['USD', 'CAD'], languages: ['en-us', 'EN-ca'] };
    expect((await fetchMarkets()).map((m) => m.country)).toEqual(['US', 'CA']);
  });
});
