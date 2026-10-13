import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ listSubscriptions: vi.fn(async () => ({ rows: [], kpis: {}, renewals: [] })) }));
vi.mock('@/lib/ct/seller/subscriptions', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listSubscriptions.mockClear();
});

describe('GET /api/seller/subscriptions', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/subscriptions?storeKey=${other}`));
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/subscriptions?storeKey=store-a'))).status).toBe(403);
    expect(service.listSubscriptions).not.toHaveBeenCalled();
  });
  it('Admin reads the session store', async () => {
    expect((await GET(makeRequest('/api/seller/subscriptions?storeKey=store-a&locale=de-DE'))).status).toBe(200);
    expect(service.listSubscriptions).toHaveBeenCalledWith('store-a', 'de-DE');
  });
});
