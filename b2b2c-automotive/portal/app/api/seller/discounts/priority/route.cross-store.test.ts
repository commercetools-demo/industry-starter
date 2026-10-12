import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ reorderDiscounts: vi.fn(async () => ({ changed: 2 })) }));
vi.mock('@/lib/ct/seller/discounts', () => service);

import { PUT } from './route';

const put = (json: Record<string, unknown>) => makeRequest('/api/seller/discounts/priority', { method: 'PUT', json });

beforeEach(() => {
  asUser('adminA');
  service.reorderDiscounts.mockClear();
});

describe('PUT /api/seller/discounts/priority', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => PUT(req), (other) => put({ storeKey: other, kind: 'product', orderedIds: ['a', 'b'] }));
    expect(service.reorderDiscounts).not.toHaveBeenCalled();
  });

  it('saves the order for the own store; a stale list is 409; Buyer is refused', async () => {
    expect(await (await PUT(put({ storeKey: 'store-a', kind: 'product', orderedIds: ['b', 'a'] }))).json()).toEqual({ changed: 2 });
    expect(service.reorderDiscounts).toHaveBeenCalledWith('store-a', 'product', ['b', 'a']);
    service.reorderDiscounts.mockRejectedValueOnce(new CatalogError(409, 'STALE_LIST', 'The list changed, reload it and try again'));
    const stale = await PUT(put({ storeKey: 'store-a', kind: 'cart', orderedIds: ['x'] }));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'STALE_LIST' });
    expect((await PUT(put({ storeKey: 'store-a', kind: 'code', orderedIds: [] }))).status).toBe(400);
    asUser('buyerA');
    expect((await PUT(put({ storeKey: 'store-a', kind: 'product', orderedIds: [] }))).status).toBe(403);
  });
});
