import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ listTemplates: vi.fn(async () => []), listEvents: vi.fn(async () => []) }));
vi.mock('@/lib/ct/seller/email-templates', () => service);
vi.mock('@/lib/theme/brand', () => ({ getBrand: vi.fn(async () => ({ primary: '#112233', logoUrl: null, storeName: 'Store A' })) }));

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listTemplates.mockClear();
  service.listEvents.mockClear();
});

describe('GET /api/seller/email/templates', () => {
  it('cross-store: another store is refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/email/templates?storeKey=${other}`));
    expect(service.listTemplates).not.toHaveBeenCalled();
    expect(service.listEvents).not.toHaveBeenCalled();
  });
  it('Buyer gets 403; Admin gets templates, events and brand of the session store', async () => {
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/email/templates?storeKey=store-a'))).status).toBe(403);
    asUser('adminA');
    const res = await GET(makeRequest('/api/seller/email/templates?storeKey=store-a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ templates: [], events: [], brand: { primary: '#112233' } });
    expect(service.listTemplates).toHaveBeenCalledWith('store-a');
  });
});
