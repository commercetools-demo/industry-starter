/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({
  getTailoringDetail: vi.fn(async () => ({ productId: 'p1' })),
  saveTailoring: vi.fn(async () => ({ published: true })),
}));
vi.mock('@/lib/ct/seller/tailoring', () => service);

import { GET, PUT } from './route';

const ctx = params({ productId: 'p1' });
const put = (json: Record<string, unknown>) => makeRequest('/api/seller/tailoring/p1', { method: 'PUT', json });

beforeEach(() => {
  asUser('adminA');
  service.getTailoringDetail.mockClear();
  service.saveTailoring.mockClear();
});

describe('/api/seller/tailoring/[productId]', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => PUT(req, ctx), (other) => put({ storeKey: other, name: { 'de-DE': 'x' } }));
    await expectCrossStoreForbidden((req) => GET(req, ctx), (other) => makeRequest(`/api/seller/tailoring/p1?storeKey=${other}`));
    expect(service.saveTailoring).not.toHaveBeenCalled();
    expect(service.getTailoringDetail).not.toHaveBeenCalled();
  });

  it('strict schema rejects sku, fitment and slug with 400', async () => {
    for (const extra of [{ sku: 'X' }, { fitment: [] }, { slug: { 'de-DE': 'x' } }, { specs: {} }]) {
      expect((await PUT(put({ storeKey: 'store-a', name: { 'de-DE': 'x' }, ...extra }), ctx)).status).toBe(400);
    }
    expect(service.saveTailoring).not.toHaveBeenCalled();
  });

  it('saves name, description and images and answers published; Buyer reads but cannot save', async () => {
    const res = await PUT(put({ storeKey: 'store-a', name: { 'de-DE': 'Neu' }, images: [{ url: 'https://cdn.example/a.jpg' }] }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: true });
    expect(service.saveTailoring).toHaveBeenCalledWith('store-a', 'p1', { name: { 'de-DE': 'Neu' }, images: [{ url: 'https://cdn.example/a.jpg' }] }, 'cust-admin-a');
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/tailoring/p1?storeKey=store-a'), ctx)).status).toBe(200);
    expect((await PUT(put({ storeKey: 'store-a', name: { 'de-DE': 'x' } }), ctx)).status).toBe(403);
  });

  it('11 images, an http url and a url with credentials are 400', async () => {
    const images = Array.from({ length: 11 }, (_, i) => ({ url: `https://cdn.example/${i}.jpg` }));
    expect((await PUT(put({ storeKey: 'store-a', images }), ctx)).status).toBe(400);
    expect((await PUT(put({ storeKey: 'store-a', images: [{ url: 'http://cdn.example/a.jpg' }] }), ctx)).status).toBe(400);
    expect((await PUT(put({ storeKey: 'store-a', images: [{ url: 'https://u:p@cdn.example/a.jpg' }] }), ctx)).status).toBe(400);
  });
});
