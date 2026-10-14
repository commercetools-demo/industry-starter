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
const service = vi.hoisted(() => ({ assortmentImpact: vi.fn(async () => ({ count: 2, openCartCount: 1, branches: 3 })) }));
vi.mock('@/lib/ct/seller/assortment', () => service);

import { POST } from './route';

const post = (storeKey: string, extra: Record<string, unknown> = {}) => makeRequest('/api/seller/assortment/impact', { method: 'POST', json: { storeKey, productIds: ['p1', 'p2'], ...extra } });

beforeEach(() => {
  asUser('adminA');
  service.assortmentImpact.mockClear();
});

describe('POST /api/seller/assortment/impact', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(other));
    expect(service.assortmentImpact).not.toHaveBeenCalled();
  });

  it('the own store gets the counts; a Buyer is refused; unknown keys are 400', async () => {
    expect(await (await POST(post('store-a'))).json()).toEqual({ count: 2, openCartCount: 1, branches: 3 });
    expect((await POST(post('store-a', { extra: 1 }))).status).toBe(400);
    asUser('buyerA');
    expect((await POST(post('store-a'))).status).toBe(403);
  });
});
