import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ validateFile: vi.fn(async () => ({ rows: 1, valid: 1, warnings: 0, errors: 0, importable: 1, mapping: [], issues: [] })) }));
vi.mock('@/lib/ct/seller/product-import', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/import/validate', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', csv: 'sku,price\nTST-W-1,1.00', ...extra });

beforeEach(() => {
  asUser('adminA');
  service.validateFile.mockClear();
});

describe('POST /api/seller/import/validate', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(body({ storeKey: other })));
    asUser('buyerA');
    expect((await POST(post(body()))).status).toBe(403);
    expect(service.validateFile).not.toHaveBeenCalled();
  });
  it('validates the file for the session store with the chosen mapping overrides', async () => {
    expect((await POST(post(body({ overrides: { Foo: 'ignore', Bar: 'sku' } })))).status).toBe(200);
    expect(service.validateFile).toHaveBeenCalledWith('store-a', 'sku,price\nTST-W-1,1.00', { Foo: 'ignore', Bar: 'sku' });
  });
  it('the body is strict: a validated row list, a mapping to fitment or a file over 1 MB is 400', async () => {
    for (const extra of [{ rows: [{ sku: 'X' }] }, { overrides: { Fit: 'fitment' } }, { csv: 'x'.repeat(1_100_001) }]) expect((await POST(post(body(extra)))).status).toBe(400);
    expect(service.validateFile).not.toHaveBeenCalled();
  });
});
