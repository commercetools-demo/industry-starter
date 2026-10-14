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
const service = vi.hoisted(() => ({ publishBundle: vi.fn(async () => ({ key: 'bundle-x', status: 'Live' })) }));
vi.mock('@/lib/ct/seller/bundles', () => service);

import { POST } from './route';

const ctx = params({ key: 'bundle-store-a-x' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/bundles/bundle-store-a-x/publish', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.publishBundle.mockClear();
});

describe('POST /api/seller/bundles/[key]/publish', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.publishBundle).not.toHaveBeenCalled();
  });
  it('publishes within the session store; a strange key is 404', async () => {
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(200);
    expect(service.publishBundle).toHaveBeenCalledWith('store-a', 'bundle-store-a-x');
    expect((await POST(post({ storeKey: 'store-a' }), params({ key: 'a b' }))).status).toBe(404);
  });
});
