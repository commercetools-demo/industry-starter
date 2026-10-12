import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ suggestAudience: vi.fn(async () => ({ ok: true, rule: { all: [] }, text: 'registered', count: 27 })) }));
vi.mock('@/lib/ct/seller/email-campaigns', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/email/campaigns/suggest', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.suggestAudience.mockClear();
});

describe('POST /api/seller/email/campaigns/suggest', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post({ storeKey: other, description: 'registered customers' }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a', description: 'registered customers' }))).status).toBe(403);
    expect(service.suggestAudience).not.toHaveBeenCalled();
  });
  it('returns the rule and count of the session store and persists nothing (the service has no write)', async () => {
    const res = await POST(post({ storeKey: 'store-a', description: 'Customers who bought brake discs but not pads' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, count: 27 });
    expect(service.suggestAudience).toHaveBeenCalledWith('store-a', 'Customers who bought brake discs but not pads');
    expect((await POST(post({ storeKey: 'store-a', description: '' }))).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', description: 'x'.repeat(201) }))).status).toBe(400);
  });
});
