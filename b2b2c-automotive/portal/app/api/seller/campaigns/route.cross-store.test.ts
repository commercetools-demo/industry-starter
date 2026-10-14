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
const service = vi.hoisted(() => ({ listCampaigns: vi.fn(async () => []) }));
vi.mock('@/lib/ct/seller/campaigns', () => service);

import * as route from './route';

beforeEach(() => {
  asUser('adminA');
  service.listCampaigns.mockClear();
});

describe('GET /api/seller/campaigns', () => {
  it('cross-store: another store is refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => route.GET(req), (other) => makeRequest(`/api/seller/campaigns?storeKey=${other}`));
    expect(service.listCampaigns).not.toHaveBeenCalled();
  });
  it('Buyer gets 403, Admin gets the list for the session store', async () => {
    asUser('buyerA');
    expect((await route.GET(makeRequest('/api/seller/campaigns?storeKey=store-a'))).status).toBe(403);
    asUser('adminA');
    expect((await route.GET(makeRequest('/api/seller/campaigns?storeKey=store-a'))).status).toBe(200);
    expect(service.listCampaigns).toHaveBeenCalledWith('store-a');
    expect((await route.GET(makeRequest('/api/seller/campaigns'))).status).toBe(400);
  });
  it('there is no edit route: only GET is exported, so a PUT or PATCH is answered 405 by Next', () => {
    expect(Object.keys(route).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k))).toEqual(['GET']);
  });
});
