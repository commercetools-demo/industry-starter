import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ setDiscountActive: vi.fn(async () => ({ id: 'd1', isActive: false })) }));
vi.mock('@/lib/ct/seller/discounts', () => service);

import { POST } from './route';

const ctx = (kind = 'product') => params({ kind, id: 'd1' });
const post = (json: Record<string, unknown>, kind = 'product') => makeRequest(`/api/seller/discounts/${kind}/d1/active`, { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.setDiscountActive.mockClear();
});

describe('POST /api/seller/discounts/[kind]/[id]/active', () => {
  it('cross-store: toggling a discount while naming another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx()), (other) => post({ storeKey: other, isActive: false }));
    expect(service.setDiscountActive).not.toHaveBeenCalled();
  });

  it('toggles for the own store; a foreign id is 404; a Malva-funded one is 403; an unfinished draft is 400', async () => {
    expect((await POST(post({ storeKey: 'store-a', isActive: false }), ctx())).status).toBe(200);
    expect(service.setDiscountActive).toHaveBeenCalledWith('store-a', 'product', 'd1', false);
    service.setDiscountActive.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    expect((await POST(post({ storeKey: 'store-a', isActive: true }), ctx())).status).toBe(404);
    service.setDiscountActive.mockRejectedValueOnce(new CatalogError(403, 'LOCKED_MALVA_FUNDED', 'x'));
    expect((await POST(post({ storeKey: 'store-a', isActive: true }), ctx())).status).toBe(403);
    service.setDiscountActive.mockRejectedValueOnce(new CatalogError(400, 'DRAFT_INCOMPLETE', 'Complete the rule before activating it'));
    expect((await POST(post({ storeKey: 'store-a', isActive: true }), ctx())).status).toBe(400);
  });

  it('strict body, known kind, Admin only', async () => {
    expect((await POST(post({ storeKey: 'store-a', isActive: 'yes' }), ctx())).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', isActive: true }, 'code'), ctx('code'))).status).toBe(404);
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a', isActive: true }), ctx())).status).toBe(403);
  });
});
