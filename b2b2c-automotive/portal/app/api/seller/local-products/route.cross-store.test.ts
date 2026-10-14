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
const service = vi.hoisted(() => ({ listLocalProducts: vi.fn(async () => []), createLocalProduct: vi.fn(async () => ({ key: 'k', sku: 'TST-W-1', status: 'live' })) }));
vi.mock('@/lib/ct/seller/local-products', () => service);

import { GET, POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/local-products', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', name: { 'de-DE': 'Teil', 'en-US': 'Part' }, sku: 'TST-W-1', priceCents: 1290, categoryKey: 'mau-cat-brakes', type: 'Local part', ...extra });

beforeEach(() => {
  asUser('adminA');
  service.listLocalProducts.mockClear();
  service.createLocalProduct.mockClear();
});

describe('/api/seller/local-products', () => {
  it('cross-store: another store is refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(body({ storeKey: other })));
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/local-products?storeKey=${other}`));
    expect(service.createLocalProduct).not.toHaveBeenCalled();
    expect(service.listLocalProducts).not.toHaveBeenCalled();
  });
  it('Buyer gets 403 on both methods', async () => {
    asUser('buyerA');
    expect((await POST(post(body()))).status).toBe(403);
    expect((await GET(makeRequest('/api/seller/local-products?storeKey=store-a'))).status).toBe(403);
    expect(service.createLocalProduct).not.toHaveBeenCalled();
  });
  it('a body with publish: true (or a review state, owner, prices) is 400 and never reaches the service', async () => {
    for (const extra of [{ publish: true }, { reviewState: 'approved' }, { 'review-state': 'approved' }, { ownerStore: 'store-b' }, { prices: [{ value: 1 }] }]) {
      expect((await POST(post(body(extra)))).status).toBe(400);
    }
    expect(service.createLocalProduct).not.toHaveBeenCalled();
  });
  it('creates for the session store (the store key is not part of the product input)', async () => {
    expect((await POST(post(body({ fitment: ['A|B|1|2|x'], brandName: 'Brand' })))).status).toBe(201);
    expect(service.createLocalProduct).toHaveBeenCalledWith('store-a', { name: { 'de-DE': 'Teil', 'en-US': 'Part' }, sku: 'TST-W-1', priceCents: 1290, categoryKey: 'mau-cat-brakes', type: 'Local part', brandName: 'Brand', fitment: ['A|B|1|2|x'] });
  });
  it('a duplicate SKU is 409 with field sku and the generic text', async () => {
    service.createLocalProduct.mockRejectedValueOnce(new CatalogError(409, 'SKU_IN_USE', 'SKU already in use', { field: 'sku' }));
    const res = await POST(post(body()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'SKU already in use', code: 'SKU_IN_USE', field: 'sku' });
  });
});
