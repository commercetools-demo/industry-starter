/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ listAssortment: vi.fn(async () => ({ rows: [], total: 0, assigned: 0, totalMaster: 0, capped: false })) }));
vi.mock('@/lib/ct/seller/assortment', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listAssortment.mockClear();
});

describe('GET /api/seller/assortment', () => {
  it('cross-store: a request naming another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden(
      (req) => GET(req),
      (other) => makeRequest(`/api/seller/assortment?storeKey=${other}`),
    );
    expect(service.listAssortment).not.toHaveBeenCalled();
  });

  it('401 without a session, 400 without storeKey, 200 for the own store (Buyer too: read-only)', async () => {
    asUser('nobody');
    expect((await GET(makeRequest('/api/seller/assortment?storeKey=store-a'))).status).toBe(401);
    asUser('adminA');
    expect((await GET(makeRequest('/api/seller/assortment'))).status).toBe(400);
    expect((await GET(makeRequest('/api/seller/assortment?storeKey=store-a&state=blocked&text=pad&offset=10&limit=5'))).status).toBe(200);
    expect(service.listAssortment).toHaveBeenCalledWith('store-a', { state: 'blocked', text: 'pad', offset: 10, limit: 5 });
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/assortment?storeKey=store-a'))).status).toBe(200);
  });

  it('rejects an unknown state and caps the page size', async () => {
    expect((await GET(makeRequest('/api/seller/assortment?storeKey=store-a&state=everything'))).status).toBe(400);
    await GET(makeRequest('/api/seller/assortment?storeKey=store-a&limit=100000'));
    expect(service.listAssortment).toHaveBeenLastCalledWith('store-a', { offset: 0, limit: 200 });
  });
});
