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
const service = vi.hoisted(() => ({ listReviews: vi.fn(async () => ({ rows: [], kpis: {} })) }));
vi.mock('@/lib/ct/seller/reviews', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listReviews.mockClear();
});

describe('GET /api/seller/reviews', () => {
  it('cross-store and signed-out requests are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/reviews?storeKey=${other}`));
    asUser('nobody');
    expect((await GET(makeRequest('/api/seller/reviews?storeKey=store-a'))).status).toBe(401);
    expect(service.listReviews).not.toHaveBeenCalled();
  });
  it('lists the session store with the chosen tab (a Buyer may read: reviews.view is for both roles); unknown tabs fall back to latest', async () => {
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/reviews?storeKey=store-a&tab=lowest'))).status).toBe(200);
    expect(service.listReviews).toHaveBeenCalledWith('store-a', 'lowest', 'en-US');
    await GET(makeRequest('/api/seller/reviews?storeKey=store-a&tab=nope'));
    expect(service.listReviews).toHaveBeenLastCalledWith('store-a', 'latest', 'en-US');
  });
});
