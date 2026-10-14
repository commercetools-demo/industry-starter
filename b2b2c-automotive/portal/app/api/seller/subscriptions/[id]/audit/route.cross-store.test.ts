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
const service = vi.hoisted(() => ({ listAudit: vi.fn(async () => []) }));
vi.mock('@/lib/ct/seller/subscriptions', () => service);

import { GET } from './route';

const ctx = params({ id: 'r1' });

beforeEach(() => {
  asUser('adminA');
  service.listAudit.mockClear();
});

describe('GET /api/seller/subscriptions/[id]/audit', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req, ctx), (other) => makeRequest(`/api/seller/subscriptions/r1/audit?storeKey=${other}`));
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/subscriptions/r1/audit?storeKey=store-a'), ctx)).status).toBe(403);
    expect(service.listAudit).not.toHaveBeenCalled();
  });
  it("lists the audit of a subscription of the session store; another store's id is 404", async () => {
    expect((await GET(makeRequest('/api/seller/subscriptions/r1/audit?storeKey=store-a'), ctx)).status).toBe(200);
    expect(service.listAudit).toHaveBeenCalledWith('store-a', 'r1');
    service.listAudit.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    expect((await GET(makeRequest('/api/seller/subscriptions/rb/audit?storeKey=store-a'), params({ id: 'rb' }))).status).toBe(404);
  });
});
