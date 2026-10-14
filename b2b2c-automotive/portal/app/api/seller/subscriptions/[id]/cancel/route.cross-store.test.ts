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
const service = vi.hoisted(() => ({ runSubscriptionAction: vi.fn(async () => ({ status: 'Canceled' })) }));
vi.mock('@/lib/ct/seller/subscriptions', () => service);

import { POST } from './route';

const ctx = params({ id: 'r1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/subscriptions/r1/cancel', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.runSubscriptionAction.mockClear();
});

describe('POST /api/seller/subscriptions/[id]/cancel', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other, confirm: true }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a', confirm: true }), ctx)).status).toBe(403);
    expect(service.runSubscriptionAction).not.toHaveBeenCalled();
  });
  it('needs the confirmation and ignores or refuses a state from the client', async () => {
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', confirm: false }), ctx)).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', confirm: true, state: 'Active' }), ctx)).status).toBe(400);
    expect(service.runSubscriptionAction).not.toHaveBeenCalled();
    expect((await POST(post({ storeKey: 'store-a', confirm: true }), ctx)).status).toBe(200);
    expect(service.runSubscriptionAction).toHaveBeenCalledWith('store-a', 'r1', 'cancel', 'cust-admin-a');
  });
});
