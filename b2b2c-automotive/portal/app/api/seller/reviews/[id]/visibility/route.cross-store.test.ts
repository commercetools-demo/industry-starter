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
const service = vi.hoisted(() => ({ setVisibility: vi.fn(async () => ({ id: 'rv1', visibility: 'hidden' })) }));
vi.mock('@/lib/ct/seller/reviews', () => service);

import { POST } from './route';

const ctx = params({ id: 'rv1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/reviews/rv1/visibility', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.setVisibility.mockClear();
});

describe('POST /api/seller/reviews/[id]/visibility', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other, visibility: 'hidden' }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a', visibility: 'hidden' }), ctx)).status).toBe(403);
    expect(service.setVisibility).not.toHaveBeenCalled();
  });
  it('hides or publishes for the session store; other words are 400; a review of another store is 404', async () => {
    expect((await POST(post({ storeKey: 'store-a', visibility: 'hidden' }), ctx)).status).toBe(200);
    expect(service.setVisibility).toHaveBeenCalledWith('store-a', 'rv1', 'hidden');
    expect((await POST(post({ storeKey: 'store-a', visibility: 'deleted' }), ctx)).status).toBe(400);
    service.setVisibility.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    expect((await POST(post({ storeKey: 'store-a', visibility: 'published' }), params({ id: 'rv-b' }))).status).toBe(404);
  });
});
