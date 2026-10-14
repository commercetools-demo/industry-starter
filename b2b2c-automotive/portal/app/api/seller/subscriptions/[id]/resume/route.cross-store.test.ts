import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ runSubscriptionAction: vi.fn(async () => ({ status: 'Active' })) }));
vi.mock('@/lib/ct/seller/subscriptions', () => service);

import { POST } from './route';

const ctx = params({ id: 'r1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/subscriptions/r1/resume', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.runSubscriptionAction.mockClear();
});

describe('POST /api/seller/subscriptions/[id]/resume', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.runSubscriptionAction).not.toHaveBeenCalled();
  });
  it('resumes for the session store; a body state is refused', async () => {
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(200);
    expect(service.runSubscriptionAction).toHaveBeenCalledWith('store-a', 'r1', 'resume', 'cust-admin-a');
    expect((await POST(post({ storeKey: 'store-a', state: 'Canceled' }), ctx)).status).toBe(400);
  });
});
