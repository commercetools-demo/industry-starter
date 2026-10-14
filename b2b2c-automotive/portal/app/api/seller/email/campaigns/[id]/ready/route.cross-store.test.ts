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
const service = vi.hoisted(() => ({ markReady: vi.fn(async () => ({ id: 'c1', status: 'Ready', recipientCount: 5 })) }));
vi.mock('@/lib/ct/seller/email-campaigns', () => service);

import { POST } from './route';

const ctx = params({ id: 'c1abc' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/email/campaigns/c1abc/ready', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.markReady.mockClear();
});

describe('POST /api/seller/email/campaigns/[id]/ready', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.markReady).not.toHaveBeenCalled();
  });
  it('marks the campaign of the session store ready; the count cannot be sent; a strange id is 404', async () => {
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(200);
    expect(service.markReady).toHaveBeenCalledWith('store-a', 'c1abc');
    expect((await POST(post({ storeKey: 'store-a', recipientCount: 1000 }), ctx)).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a' }), params({ id: 'a/b' }))).status).toBe(404);
  });
});
