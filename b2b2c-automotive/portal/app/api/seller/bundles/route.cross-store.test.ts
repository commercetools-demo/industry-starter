import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ listBundles: vi.fn(async () => []), createBundle: vi.fn(async () => ({ key: 'bundle-x', status: 'Draft' })) }));
vi.mock('@/lib/ct/seller/bundles', () => service);

import { GET, POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/bundles', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', name: 'TST-W bundle', discountPercent: 10, components: [{ sku: 'A-1', qty: 1 }, { sku: 'B-2', qty: 2 }], ...extra });

beforeEach(() => {
  asUser('adminA');
  service.listBundles.mockClear();
  service.createBundle.mockClear();
});

describe('/api/seller/bundles', () => {
  it('cross-store: another store is refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(body({ storeKey: other })));
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/bundles?storeKey=${other}`));
    expect(service.createBundle).not.toHaveBeenCalled();
    expect(service.listBundles).not.toHaveBeenCalled();
  });
  it('Buyer gets 403 on both methods', async () => {
    asUser('buyerA');
    expect((await POST(post(body()))).status).toBe(403);
    expect((await GET(makeRequest('/api/seller/bundles?storeKey=store-a'))).status).toBe(403);
    expect(service.createBundle).not.toHaveBeenCalled();
  });
  it('creates a Draft for the session store; the body carries no price, status or publish flag', async () => {
    expect((await POST(post(body()))).status).toBe(201);
    expect(service.createBundle).toHaveBeenCalledWith('store-a', { name: 'TST-W bundle', discountPercent: 10, components: [{ sku: 'A-1', qty: 1 }, { sku: 'B-2', qty: 2 }] });
    for (const extra of [{ price: 1 }, { bundleCents: 1 }, { publish: true }, { status: 'Live' }, { components: [{ sku: 'A-1', qty: 1, retailCents: 1 }] }]) expect((await POST(post(body(extra)))).status).toBe(400);
    expect(service.createBundle).toHaveBeenCalledTimes(1);
  });
  it('a component outside the assortment is a 409 naming the SKU', async () => {
    service.createBundle.mockRejectedValueOnce(new CatalogError(409, 'COMPONENT_NOT_ASSIGNED', 'X-9 is not in the assortment', { sku: 'X-9' }));
    const res = await POST(post(body()));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'COMPONENT_NOT_ASSIGNED', sku: 'X-9' });
  });
});
