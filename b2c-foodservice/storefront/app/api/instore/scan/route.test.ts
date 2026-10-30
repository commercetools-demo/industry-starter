// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('@/lib/session', () => ({ getMarket: async () => ({ country: 'US', currency: 'USD', locale: 'en-US' }) }));
vi.mock('@/lib/ct/instore-scan', () => ({ getScanProduct: h.lookup }));

import { GET } from './route';

const call = (qs: string) => GET(new Request(`http://localhost/api/instore/scan${qs}`), { params: Promise.resolve({}) });
const product = { sku: 'MCF-POD-EMBER-50', name: 'Ember', availability: { state: 'in', quantity: 40 } };

beforeEach(() => {
  vi.stubEnv('APP_MODE', 'instore');
  h.lookup.mockReset();
  h.lookup.mockImplementation(async (sku: string) => (sku === 'MCF-POD-EMBER-50' ? product : null));
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/instore/scan (workstream R)', () => {
  it('a known SKU answers the product, never cached, in the session market', async () => {
    const res = await call('?sku=MCF-POD-EMBER-50');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ product });
    expect(h.lookup).toHaveBeenCalledWith('MCF-POD-EMBER-50', 'en-US');
  });

  it('Unknown SKU is a 404 with the safe error body', async () => {
    const res = await call('?sku=NOPE-1');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });

  it('text that is not a SKU is a 400 and nothing is looked up', async () => {
    for (const qs of ['', '?sku=', '?sku=a%20b', '?sku=%22or%22', `?sku=${'x'.repeat(65)}`, '?sku=https%3A%2F%2Fx.test']) {
      const res = await call(qs);
      expect(res.status, qs).toBe(400);
      expect((await res.json()).error.code).toBe('validation_failed');
    }
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it('the website has no such feature: 404 in every case', async () => {
    vi.stubEnv('APP_MODE', 'website');
    expect((await call('?sku=MCF-POD-EMBER-50')).status).toBe(404);
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it('a server error is the safe 5xx envelope without details', async () => {
    h.lookup.mockRejectedValueOnce(new Error('secret detail'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await call('?sku=MCF-POD-EMBER-50');
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret detail');
    spy.mockRestore();
  });
});
