import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ getOrderForReturn: vi.fn(async () => ({ orderNumber: 'MLV-1', lines: [] })) }));
vi.mock('@/lib/ct/seller/returns', () => service);

import { GET } from './route';

const ctx = params({ number: 'MLV-1' });

beforeEach(() => {
  asUser('adminA');
  service.getOrderForReturn.mockClear();
});

describe('GET /api/seller/orders/[number]', () => {
  it('cross-store and signed-out requests are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req, ctx), (other) => makeRequest(`/api/seller/orders/MLV-1?storeKey=${other}`));
    asUser('nobody');
    expect((await GET(makeRequest('/api/seller/orders/MLV-1?storeKey=store-a'), ctx)).status).toBe(401);
    expect(service.getOrderForReturn).not.toHaveBeenCalled();
  });
  it('reads the order of the session store; an order of another store is "Order not found"', async () => {
    expect((await GET(makeRequest('/api/seller/orders/MLV-1?storeKey=store-a'), ctx)).status).toBe(200);
    expect(service.getOrderForReturn).toHaveBeenCalledWith('store-a', 'MLV-1');
    service.getOrderForReturn.mockRejectedValueOnce(new CatalogError(404, 'ORDER_NOT_FOUND', 'Order not found'));
    expect((await GET(makeRequest('/api/seller/orders/X?storeKey=store-a'), params({ number: 'X' }))).status).toBe(404);
  });
});
