/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({
  listReturns: vi.fn(async () => ({ rows: [], kpis: {} })),
  createReturn: vi.fn(async () => ({ returnNumber: 'RET-1-1', tracking: 'RT-20261012-ABCDE' })),
}));
vi.mock('@/lib/ct/seller/returns', () => service);

import { GET, POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/returns', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', orderNumber: 'MLV-1', items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'defective', comment: 'TST-V-return', ...extra });

beforeEach(() => {
  asUser('adminA');
  service.listReturns.mockClear();
  service.createReturn.mockClear();
});

describe('GET /api/seller/returns', () => {
  it('cross-store is refused before any commercetools call; a Buyer may read (R: returns.view is for both roles)', async () => {
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/returns?storeKey=${other}`));
    expect(service.listReturns).not.toHaveBeenCalled();
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/returns?storeKey=store-a&tab=closed'))).status).toBe(200);
    expect(service.listReturns).toHaveBeenCalledWith('store-a', 'closed', 'en-US');
  });
});

describe('POST /api/seller/returns', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(body({ storeKey: other })));
    asUser('buyerA');
    expect((await POST(post(body()))).status).toBe(403);
    expect(service.createReturn).not.toHaveBeenCalled();
  });
  it('records a return for the session store and answers the number and tracking id', async () => {
    const response = await POST(post(body()));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ returnNumber: 'RET-1-1', tracking: 'RT-20261012-ABCDE' });
    expect(service.createReturn).toHaveBeenCalledWith('store-a', { orderNumber: 'MLV-1', items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'defective', comment: 'TST-V-return' });
  });
  it('validates reason, items and unknown fields; the window and order errors come from the service', async () => {
    for (const bad of [{ reason: 'because' }, { items: [] }, { items: [{ lineItemId: 'l1', quantity: 0 }] }, { status: 'refunded' }, { comment: 'x'.repeat(501) }]) {
      expect((await POST(post(body(bad)))).status).toBe(400);
    }
    expect(service.createReturn).not.toHaveBeenCalled();
    service.createReturn.mockRejectedValueOnce(new CatalogError(409, 'RETURN_WINDOW_CLOSED', 'The 30-day return window has closed'));
    const response = await POST(post(body()));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'RETURN_WINDOW_CLOSED' });
    service.createReturn.mockRejectedValueOnce(new CatalogError(404, 'ORDER_NOT_FOUND', 'Order not found'));
    expect((await POST(post(body({ orderNumber: 'OF-B' })))).status).toBe(404);
  });
});
