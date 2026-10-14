import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ replyToReview: vi.fn(async () => ({ id: 'rv1' })), REPLY_MAX: 1000 }));
vi.mock('@/lib/ct/seller/reviews', () => service);

import { POST } from './route';

const ctx = params({ id: 'rv1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/reviews/rv1/reply', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.replyToReview.mockClear();
});

describe('POST /api/seller/reviews/[id]/reply', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other, text: 'Thanks' }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a', text: 'Thanks' }), ctx)).status).toBe(403);
    expect(service.replyToReview).not.toHaveBeenCalled();
  });
  it('replies for the session store; text over 1,000 characters is 400; a review of another store is 404', async () => {
    expect((await POST(post({ storeKey: 'store-a', text: ' Thanks ' }), ctx)).status).toBe(200);
    expect(service.replyToReview).toHaveBeenCalledWith('store-a', 'rv1', 'Thanks', 'store-a');
    expect((await POST(post({ storeKey: 'store-a', text: 'x'.repeat(1001) }), ctx)).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', text: 'ok', replyBy: 'me' }), ctx)).status).toBe(400);
    service.replyToReview.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    expect((await POST(post({ storeKey: 'store-a', text: 'Thanks' }), params({ id: 'rv-b' }))).status).toBe(404);
  });
});
