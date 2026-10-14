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
const service = vi.hoisted(() => ({ listDiscounts: vi.fn(async () => [{ id: 'd1' }]) }));
vi.mock('@/lib/ct/seller/discounts', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listDiscounts.mockClear();
});

describe('GET /api/seller/discounts', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden(
      (req) => GET(req),
      (other) => makeRequest(`/api/seller/discounts?storeKey=${other}&kind=product`),
    );
    expect(service.listDiscounts).not.toHaveBeenCalled();
  });

  it('lists a kind for the own store (Buyer may read); an unknown kind is 400', async () => {
    asUser('buyerA');
    expect(await (await GET(makeRequest('/api/seller/discounts?storeKey=store-a&kind=cart'))).json()).toEqual({ discounts: [{ id: 'd1' }] });
    expect(service.listDiscounts).toHaveBeenCalledWith('store-a', 'cart');
    expect((await GET(makeRequest('/api/seller/discounts?storeKey=store-a&kind=code'))).status).toBe(400);
  });
});
