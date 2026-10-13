import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ getReturn: vi.fn(async () => ({ returnNumber: 'RET-MLV-1-1' })) }));
vi.mock('@/lib/ct/seller/returns', () => service);

import { GET } from './route';

const ctx = params({ number: 'RET-MLV-1-1' });

beforeEach(() => {
  asUser('adminA');
  service.getReturn.mockClear();
});

describe('GET /api/seller/returns/[number]', () => {
  it('cross-store and signed-out requests are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req, ctx), (other) => makeRequest(`/api/seller/returns/RET-MLV-1-1?storeKey=${other}`));
    asUser('nobody');
    expect((await GET(makeRequest('/api/seller/returns/RET-MLV-1-1?storeKey=store-a'), ctx)).status).toBe(401);
    expect(service.getReturn).not.toHaveBeenCalled();
  });
  it("reads the return of the session store; another store's return is 404", async () => {
    expect((await GET(makeRequest('/api/seller/returns/RET-MLV-1-1?storeKey=store-a&locale=de-DE'), ctx)).status).toBe(200);
    expect(service.getReturn).toHaveBeenCalledWith('store-a', 'RET-MLV-1-1', 'de-DE');
    service.getReturn.mockRejectedValueOnce(new CatalogError(404, 'RETURN_NOT_FOUND', 'Return not found'));
    expect((await GET(makeRequest('/api/seller/returns/RET-X-1?storeKey=store-a'), params({ number: 'RET-X-1' }))).status).toBe(404);
  });
});
