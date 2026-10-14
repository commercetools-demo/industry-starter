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
const service = vi.hoisted(() => ({ addCustomerNote: vi.fn(async () => []), NOTE_MAX: 1000 }));
vi.mock('@/lib/ct/seller/customers', () => service);

import { POST } from './route';

const ctx = params({ id: 'c1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/customers/c1/notes', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.addCustomerNote.mockClear();
});

describe('POST /api/seller/customers/[id]/notes', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other, text: 'hi' }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a', text: 'hi' }), ctx)).status).toBe(403);
    expect(service.addCustomerNote).not.toHaveBeenCalled();
  });
  it('adds a trimmed note for the session store and user; unknown keys and long text are 400', async () => {
    expect((await POST(post({ storeKey: 'store-a', text: ' TST-V-note ' }), ctx)).status).toBe(201);
    expect(service.addCustomerNote).toHaveBeenCalledWith('store-a', 'c1', 'TST-V-note', 'cust-admin-a');
    expect((await POST(post({ storeKey: 'store-a', text: 'x'.repeat(1001) }), ctx)).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', text: 'ok', by: 'someone' }), ctx)).status).toBe(400);
  });
});
