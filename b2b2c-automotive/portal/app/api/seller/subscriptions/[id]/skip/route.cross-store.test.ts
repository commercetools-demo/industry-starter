import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ runSubscriptionAction: vi.fn(async () => ({ status: 'Active' })) }));
vi.mock('@/lib/ct/seller/subscriptions', () => service);

import { POST } from './route';

const ctx = params({ id: 'r1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/subscriptions/r1/skip', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.runSubscriptionAction.mockClear();
});

describe('POST /api/seller/subscriptions/[id]/skip', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.runSubscriptionAction).not.toHaveBeenCalled();
  });
  it('skips for the session store; a skip on a paused subscription is a 409 NOT_ACTIVE', async () => {
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(200);
    expect(service.runSubscriptionAction).toHaveBeenCalledWith('store-a', 'r1', 'skip', 'cust-admin-a');
    service.runSubscriptionAction.mockRejectedValueOnce(new CatalogError(409, 'NOT_ACTIVE', 'Only an active subscription can skip a renewal'));
    const response = await POST(post({ storeKey: 'store-a' }), ctx);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'NOT_ACTIVE' });
  });
});
