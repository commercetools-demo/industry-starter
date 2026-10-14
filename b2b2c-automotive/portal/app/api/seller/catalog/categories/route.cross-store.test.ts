import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ listCategories: vi.fn(async () => [{ id: 'c1', key: 'k', name: { 'en-US': 'Brakes' } }]) }));
vi.mock('@/lib/ct/seller/catalog-data', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listCategories.mockClear();
});

describe('GET /api/seller/catalog/categories', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden(
      (req) => GET(req),
      (other) => makeRequest(`/api/seller/catalog/categories?storeKey=${other}`),
    );
    expect(service.listCategories).not.toHaveBeenCalled();
  });

  it('the own store gets the categories', async () => {
    expect((await (await GET(makeRequest('/api/seller/catalog/categories?storeKey=store-a'))).json()).categories).toHaveLength(1);
  });
});
