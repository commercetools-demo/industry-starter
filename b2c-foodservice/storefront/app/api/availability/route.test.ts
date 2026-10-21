// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: async () => [{ id: 'c1', key: 'mcf-store-a' }] }));
vi.mock('@/lib/ct/inventory', () => ({
  SKU_PATTERN: /^[A-Za-z0-9._-]{1,64}$/,
  getStoreAvailability: async (sku: string) => ({
    sku, ship: 'in', stores: [{ storeKey: 'mcf-store-a', state: 'out', quantity: 0 }],
  }),
}));

import { GET } from './route';

const call = (qs: string) => GET(new Request(`http://localhost/api/availability${qs}`), { params: Promise.resolve({}) });

describe('GET /api/availability', () => {
  it('response is no-store', async () => {
    const res = await call('?sku=ABC-1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ sku: 'ABC-1', ship: 'in' });
  });

  it('invalid sku is a 400 with the safe error body', async () => {
    for (const qs of ['', '?sku=', '?sku=a%20b', '?sku=%22or%22']) {
      const res = await call(qs);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('validation_failed');
    }
  });
});
