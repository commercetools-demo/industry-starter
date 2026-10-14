import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ getCustomerDetail: vi.fn(async () => ({ id: 'c1' })) }));
vi.mock('@/lib/ct/seller/customers', () => service);

import { GET } from './route';

const ctx = params({ id: 'c1' });

beforeEach(() => {
  asUser('adminA');
  service.getCustomerDetail.mockClear();
});

describe('GET /api/seller/customers/[id]', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req, ctx), (other) => makeRequest(`/api/seller/customers/c1?storeKey=${other}`));
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/customers/c1?storeKey=store-a'), ctx)).status).toBe(403);
    expect(service.getCustomerDetail).not.toHaveBeenCalled();
  });
  it('customer of other store is 404: the service is asked for the session store only', async () => {
    service.getCustomerDetail.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    const response = await GET(makeRequest('/api/seller/customers/c-of-b?storeKey=store-a'), params({ id: 'c-of-b' }));
    expect(response.status).toBe(404);
    expect(service.getCustomerDetail).toHaveBeenCalledWith('store-a', 'c-of-b', ['admin'], 'en-US');
  });
  it('refuses an unusual id as not found before reading', async () => {
    expect((await GET(makeRequest('/api/seller/customers/x?storeKey=store-a'), params({ id: 'a/../b' }))).status).toBe(404);
    expect(service.getCustomerDetail).not.toHaveBeenCalled();
  });
});
