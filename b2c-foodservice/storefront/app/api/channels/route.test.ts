// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Store } from '@/lib/types';
import { CLOSED_ALL_WEEK } from '@/lib/hours';

const session = vi.hoisted(() => ({ value: {} as Record<string, string>, market: { country: 'US', currency: 'USD', locale: 'en-US' } }));

vi.mock('@/lib/session', () => ({
  getSession: async () => session.value,
  getMarket: async () => session.market,
}));

const store = (key: string, country = 'US'): Store => ({
  id: key, key, name: key, addressLine: 'x', city: 'New York', postalCode: '10001', country,
  hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 15,
});
vi.mock('@/lib/ct/channels', () => ({
  getStoresForCountry: async (country: string) =>
    country === 'US' ? [store('mcf-store-a'), store('mcf-store-b')] : [],
}));

import { GET } from './route';

const call = (qs = '') => GET(new Request(`http://localhost/api/channels${qs}`), { params: Promise.resolve({}) });

beforeEach(() => {
  session.value = {};
  session.market = { country: 'US', currency: 'USD', locale: 'en-US' };
});

describe('GET /api/channels', () => {
  it('filters by session country', async () => {
    const us = await (await call()).json();
    expect(us.stores).toHaveLength(2);
    expect(us.selectedKey).toBeNull();
    session.market = { country: 'CA', currency: 'CAD', locale: 'en-CA' };
    expect(await (await call()).json()).toEqual({ stores: [], selectedKey: null });
  });

  it('Canada market returns no stores', async () => {
    expect(await (await call('?country=CA')).json()).toEqual({ stores: [], selectedKey: null });
  });

  it('returns the stored selection when it belongs to the country', async () => {
    session.value = { collectionStoreKey: 'mcf-store-b' };
    expect((await (await call()).json()).selectedKey).toBe('mcf-store-b');
  });

  it('selectedKey dropped when store is in another country', async () => {
    session.value = { collectionStoreKey: 'mcf-store-b' };
    expect((await (await call('?country=CA')).json()).selectedKey).toBeNull();
  });

  it('rejects an unknown country', async () => {
    const res = await call('?country=DE');
    expect(res.status).toBe(400);
    expect((await call('?country=us')).status).toBe(400);
  });
});
