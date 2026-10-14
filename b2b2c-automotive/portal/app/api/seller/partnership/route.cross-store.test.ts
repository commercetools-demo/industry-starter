import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ getPartnership: vi.fn(async () => ({ rules: [], kpis: {}, flags: [] })) }));
vi.mock('@/lib/ct/seller/partnership', () => service);

import * as route from './route';

beforeEach(() => {
  asUser('adminA');
  service.getPartnership.mockClear();
});

describe('GET /api/seller/partnership', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => route.GET(req), (other) => makeRequest(`/api/seller/partnership?storeKey=${other}`));
    asUser('buyerA');
    expect((await route.GET(makeRequest('/api/seller/partnership?storeKey=store-a'))).status).toBe(403);
    expect(service.getPartnership).not.toHaveBeenCalled();
  });
  it('Admin reads the page data of the session store; the resource is read only', async () => {
    expect((await route.GET(makeRequest('/api/seller/partnership?storeKey=store-a'))).status).toBe(200);
    expect(service.getPartnership).toHaveBeenCalledWith('store-a');
    expect(Object.keys(route).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k))).toEqual(['GET']);
  });
});
