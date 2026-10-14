import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ listCustomers: vi.fn(async () => ({ rows: [], total: 0, kpis: {}, truncated: false })) }));
vi.mock('@/lib/ct/seller/customers', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listCustomers.mockClear();
});

describe('GET /api/seller/customers', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/customers?storeKey=${other}`));
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/customers?storeKey=store-a'))).status).toBe(403);
    asUser('nobody');
    expect((await GET(makeRequest('/api/seller/customers?storeKey=store-a'))).status).toBe(401);
    expect(service.listCustomers).not.toHaveBeenCalled();
  });
  it('Admin reads the checked store with tab, search and paging; an unknown tab falls back to all', async () => {
    expect((await GET(makeRequest('/api/seller/customers?storeKey=store-a&tab=guests&q=anna&offset=50'))).status).toBe(200);
    expect(service.listCustomers).toHaveBeenCalledWith('store-a', { tab: 'guests', q: 'anna', offset: 50, limit: 50 });
    await GET(makeRequest('/api/seller/customers?storeKey=store-a&tab=evil'));
    expect(service.listCustomers).toHaveBeenLastCalledWith('store-a', expect.objectContaining({ tab: 'all' }));
    expect((await GET(makeRequest('/api/seller/customers'))).status).toBe(400);
  });
});
