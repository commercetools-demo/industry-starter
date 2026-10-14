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
const service = vi.hoisted(() => ({ runSubscriptionAction: vi.fn(async () => ({ status: 'Paused' })) }));
vi.mock('@/lib/ct/seller/subscriptions', () => service);

import { POST } from './route';

const ctx = params({ id: 'r1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/subscriptions/r1/pause', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.runSubscriptionAction.mockClear();
});

describe('POST /api/seller/subscriptions/[id]/pause', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.runSubscriptionAction).not.toHaveBeenCalled();
  });
  it('pauses for the session store and user; accepts no state from the client', async () => {
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(200);
    expect(service.runSubscriptionAction).toHaveBeenCalledWith('store-a', 'r1', 'pause', 'cust-admin-a');
    expect((await POST(post({ storeKey: 'store-a', state: 'Active' }), ctx)).status).toBe(400);
  });
  it("another store's subscription is 404 and a wrong state is a 409", async () => {
    service.runSubscriptionAction.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    expect((await POST(post({ storeKey: 'store-a' }), params({ id: 'rb' }))).status).toBe(404);
    service.runSubscriptionAction.mockRejectedValueOnce(new CatalogError(409, 'INVALID_TRANSITION', 'A Canceled subscription cannot be changed this way'));
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(409);
  });
});
