import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ resetTailoring: vi.fn(async () => undefined) }));
vi.mock('@/lib/ct/seller/tailoring', () => service);

import { POST } from './route';

const ctx = params({ productId: 'p1' });
const post = (storeKey: string) => makeRequest('/api/seller/tailoring/p1/reset', { method: 'POST', json: { storeKey } });

beforeEach(() => {
  asUser('adminA');
  service.resetTailoring.mockClear();
});

describe('POST /api/seller/tailoring/[productId]/reset', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post(other));
    expect(service.resetTailoring).not.toHaveBeenCalled();
  });

  it('the own store resets; a Buyer is refused', async () => {
    expect((await POST(post('store-a'), ctx)).status).toBe(200);
    expect(service.resetTailoring).toHaveBeenCalledWith('store-a', 'p1');
    asUser('buyerA');
    expect((await POST(post('store-a'), ctx)).status).toBe(403);
  });
});
