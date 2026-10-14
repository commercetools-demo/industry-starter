/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({
  getDiscount: vi.fn(async () => ({ id: 'd1' })),
  updateDiscount: vi.fn(async () => ({ id: 'd1' })),
  deleteDiscount: vi.fn(async () => undefined),
}));
vi.mock('@/lib/ct/seller/discounts', () => service);

import { DELETE, GET, PATCH } from './route';

const ctx = (kind = 'cart', id = 'd1') => params({ kind, id });
const rule = { name: { 'en-US': 'Cart -3%' }, condition: { kind: 'always' }, effect: { kind: 'relative', percent: 3 }, stacking: 'Stacking' };
const patch = (storeKey: string, kind = 'cart') => makeRequest(`/api/seller/discounts/${kind}/d1`, { method: 'PATCH', json: { storeKey, rule } });

beforeEach(() => {
  asUser('adminA');
  for (const fn of Object.values(service)) fn.mockClear();
});

describe('/api/seller/discounts/[kind]/[id]', () => {
  it('cross-store: another store is refused and commercetools is never called (read, patch, delete)', async () => {
    await expectCrossStoreForbidden((req) => GET(req, ctx()), (other) => makeRequest(`/api/seller/discounts/cart/d1?storeKey=${other}`));
    await expectCrossStoreForbidden((req) => PATCH(req, ctx()), (other) => patch(other));
    await expectCrossStoreForbidden((req) => DELETE(req, ctx()), (other) => makeRequest(`/api/seller/discounts/cart/d1?storeKey=${other}`, { method: 'DELETE' }));
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it("a discount of another store answers 404 (not 403) and a Malva-funded one answers 403 LOCKED_MALVA_FUNDED to a change", async () => {
    service.getDiscount.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    expect((await GET(makeRequest('/api/seller/discounts/cart/other?storeKey=store-a'), ctx('cart', 'other'))).status).toBe(404);
    service.updateDiscount.mockRejectedValueOnce(new CatalogError(403, 'LOCKED_MALVA_FUNDED', 'Malva-funded discounts cannot be changed'));
    const locked = await PATCH(patch('store-a'), ctx());
    expect(locked.status).toBe(403);
    expect(await locked.json()).toMatchObject({ code: 'LOCKED_MALVA_FUNDED' });
    service.deleteDiscount.mockRejectedValueOnce(new CatalogError(403, 'LOCKED_MALVA_FUNDED', 'x'));
    expect((await DELETE(makeRequest('/api/seller/discounts/cart/d1?storeKey=store-a', { method: 'DELETE' }), ctx())).status).toBe(403);
  });

  it('reads, patches with the kind-specific rule shape and deletes for the own store; an unknown kind is 404', async () => {
    expect((await GET(makeRequest('/api/seller/discounts/cart/d1?storeKey=store-a'), ctx())).status).toBe(200);
    expect((await PATCH(patch('store-a'), ctx())).status).toBe(200);
    expect(service.updateDiscount).toHaveBeenCalledWith('store-a', 'cart', 'd1', rule);
    expect((await PATCH(patch('store-a', 'product'), ctx('product'))).status).toBe(400); // a cart rule is not a product rule
    expect((await DELETE(makeRequest('/api/seller/discounts/cart/d1?storeKey=store-a', { method: 'DELETE' }), ctx())).status).toBe(200);
    expect((await GET(makeRequest('/api/seller/discounts/code/d1?storeKey=store-a'), ctx('code'))).status).toBe(404);
  });

  it('a Buyer may read but not change', async () => {
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/discounts/cart/d1?storeKey=store-a'), ctx())).status).toBe(200);
    expect((await PATCH(patch('store-a'), ctx())).status).toBe(403);
    expect((await DELETE(makeRequest('/api/seller/discounts/cart/d1?storeKey=store-a', { method: 'DELETE' }), ctx())).status).toBe(403);
  });
});
