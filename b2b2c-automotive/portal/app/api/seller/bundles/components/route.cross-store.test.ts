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
const service = vi.hoisted(() => ({ listComponentOptions: vi.fn(async () => []) }));
vi.mock('@/lib/ct/seller/bundles', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listComponentOptions.mockClear();
});

describe('GET /api/seller/bundles/components', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/bundles/components?storeKey=${other}`));
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/bundles/components?storeKey=store-a'))).status).toBe(403);
    expect(service.listComponentOptions).not.toHaveBeenCalled();
  });
  it('lists the session store assigned parts, filtered by text', async () => {
    expect((await GET(makeRequest('/api/seller/bundles/components?storeKey=store-a&text=brake'))).status).toBe(200);
    expect(service.listComponentOptions).toHaveBeenCalledWith('store-a', 'brake');
  });
});
