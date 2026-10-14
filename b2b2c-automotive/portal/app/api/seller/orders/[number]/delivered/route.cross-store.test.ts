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
const service = vi.hoisted(() => ({ markDelivered: vi.fn(async () => ({ deliveredAt: '2026-10-12T10:00:00.000Z' })) }));
vi.mock('@/lib/ct/seller/returns', () => service);

import { POST } from './route';

const ctx = params({ number: 'MLV-1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/orders/MLV-1/delivered', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.markDelivered.mockClear();
});

describe('POST /api/seller/orders/[number]/delivered', () => {
  it('mark delivered: cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.markDelivered).not.toHaveBeenCalled();
  });
  it("Admin marks an order of the session store; another store's order is 404; a delivery date cannot be sent", async () => {
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(200);
    expect(service.markDelivered).toHaveBeenCalledWith('store-a', 'MLV-1');
    service.markDelivered.mockRejectedValueOnce(new CatalogError(404, 'ORDER_NOT_FOUND', 'Order not found'));
    expect((await POST(post({ storeKey: 'store-a' }), params({ number: 'MLV-OF-B' }))).status).toBe(404);
    expect((await POST(post({ storeKey: 'store-a', deliveredAt: '2020-01-01' }), ctx)).status).toBe(400);
  });
});
