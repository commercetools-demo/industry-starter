import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ getChain: vi.fn(async () => ({ masterCount: 1, approvedCount: 1, resellerCount: 1, branchCount: 1 })) }));
vi.mock('@/lib/ct/seller/assortment', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.getChain.mockClear();
});

describe('GET /api/seller/assortment/chain', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden(
      (req) => GET(req),
      (other) => makeRequest(`/api/seller/assortment/chain?storeKey=${other}`),
    );
    expect(service.getChain).not.toHaveBeenCalled();
  });

  it('the own store gets the chain', async () => {
    const res = await GET(makeRequest('/api/seller/assortment/chain?storeKey=store-a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ masterCount: 1 });
  });
});
