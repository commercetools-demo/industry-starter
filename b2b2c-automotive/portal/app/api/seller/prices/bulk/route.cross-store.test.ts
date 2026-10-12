import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({
  previewBulk: vi.fn(async () => ({ rows: [], invalidCount: 0, currency: 'EUR' })),
  publishBulk: vi.fn(async () => ({ written: 2, deleted: 0 })),
}));
vi.mock('@/lib/ct/seller/prices', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/prices/bulk', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', mode: 'percentOfList', value: 108, skus: ['MLV-BP-41001'], dryRun: true, ...extra });

beforeEach(() => {
  asUser('adminA');
  service.previewBulk.mockClear();
  service.publishBulk.mockClear();
});

describe('POST /api/seller/prices/bulk', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(body({ storeKey: other })));
    expect(service.previewBulk).not.toHaveBeenCalled();
    expect(service.publishBulk).not.toHaveBeenCalled();
  });

  it('dry run previews and writes nothing; otherwise it publishes with the confirmation', async () => {
    await POST(post(body()));
    expect(service.previewBulk).toHaveBeenCalledTimes(1);
    expect(service.publishBulk).not.toHaveBeenCalled();
    await POST(post(body({ dryRun: false, confirm: true, expectedCount: 1 })));
    expect(service.publishBulk).toHaveBeenCalledWith('store-a', expect.objectContaining({ confirm: true, expectedCount: 1, mode: 'percentOfList', value: 108 }));
  });

  it('strict body: skus or filter, never both; unknown keys are 400; Buyer is refused', async () => {
    expect((await POST(post(body({ filter: {} })))).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', mode: 'setTo', value: 100 }))).status).toBe(400);
    expect((await POST(post(body({ cost: 1 })))).status).toBe(400);
    asUser('buyerA');
    expect((await POST(post(body()))).status).toBe(403);
  });
});
