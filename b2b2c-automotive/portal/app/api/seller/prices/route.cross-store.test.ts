import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({
  listPrices: vi.fn(async () => ({ rows: [], total: 0, currency: 'EUR', currencies: ['EUR'] })),
  publishPrices: vi.fn(async () => ({ written: 1, deleted: 0 })),
}));
vi.mock('@/lib/ct/seller/prices', () => service);

import { GET, PUT } from './route';

const put = (json: Record<string, unknown>) => makeRequest('/api/seller/prices', { method: 'PUT', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', changes: [{ sku: 'MLV-BP-41001', centAmount: 9000 }], confirm: true, expectedCount: 1, ...extra });

beforeEach(() => {
  asUser('adminA');
  service.listPrices.mockClear();
  service.publishPrices.mockClear();
});

describe('/api/seller/prices', () => {
  it('cross-store: user of store A changing a part in store B gets 403 and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => PUT(req), (other) => put(body({ storeKey: other })));
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/prices?storeKey=${other}`));
    expect(service.publishPrices).not.toHaveBeenCalled();
    expect(service.listPrices).not.toHaveBeenCalled();
  });

  it('ignores client supplied list, cost and currency (strict schema, 400)', async () => {
    for (const extra of [{ list: 1 }, { cost: 1 }, { changes: [{ sku: 'MLV-BP-41001', centAmount: 9000, currencyCode: 'USD' }] }, { changes: [{ sku: 'MLV-BP-41001', centAmount: 9000, list: 9450 }] }, { currency: 'GBP' }]) {
      expect((await PUT(put(body(extra)))).status).toBe(400);
    }
    expect(service.publishPrices).not.toHaveBeenCalled();
  });

  it('order of checks: 403 before validation before the count 409', async () => {
    const invalid = { changes: [{ sku: 'MLV-BP-41001', centAmount: 'free' }] };
    expect((await PUT(put(body({ storeKey: 'store-b', ...invalid })))).status).toBe(403);
    expect((await PUT(put(body(invalid)))).status).toBe(400);
    service.publishPrices.mockRejectedValueOnce(new CatalogError(409, 'CONFIRMATION_REQUIRED', 'Confirm', { count: 1 }));
    expect((await PUT(put(body({ confirm: false })))).status).toBe(409);
  });

  it('a valid publish reaches the service; a violation answers 400 with the list', async () => {
    expect((await PUT(put(body()))).status).toBe(200);
    expect(service.publishPrices).toHaveBeenCalledWith('store-a', { currency: undefined, changes: [{ sku: 'MLV-BP-41001', centAmount: 9000 }], confirm: true, expectedCount: 1 });
    service.publishPrices.mockRejectedValueOnce(new CatalogError(400, 'INVALID_MONEY', 'Enter a price above zero with at most two decimals', { violations: [{ sku: 'MLV-BP-41001', attemptedCents: 0, code: 'INVALID_MONEY' }] }));
    const res = await PUT(put(body({ changes: [{ sku: 'MLV-BP-41001', centAmount: 0 }] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Enter a price above zero with at most two decimals', code: 'INVALID_MONEY', violations: [{ sku: 'MLV-BP-41001', attemptedCents: 0, code: 'INVALID_MONEY' }] });
  });

  it('null deletes the override; GET reads for everyone, PUT is Admin only', async () => {
    await PUT(put(body({ changes: [{ sku: 'MLV-BP-41001', centAmount: null }] })));
    expect(service.publishPrices).toHaveBeenLastCalledWith('store-a', expect.objectContaining({ changes: [{ sku: 'MLV-BP-41001', centAmount: null }] }));
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/prices?storeKey=store-a&currency=USD'))).status).toBe(200);
    expect(service.listPrices).toHaveBeenCalledWith('store-a', { currency: 'USD', text: undefined, offset: 0, limit: 50 });
    expect((await GET(makeRequest('/api/seller/prices?storeKey=store-a&currency=GBP'))).status).toBe(400);
    expect((await PUT(put(body()))).status).toBe(403);
  });
});
