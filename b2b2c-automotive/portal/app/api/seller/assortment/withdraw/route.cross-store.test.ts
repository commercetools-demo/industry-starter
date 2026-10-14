/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ withdrawProducts: vi.fn(async () => ({ removed: 1 })), resolveFilterIds: vi.fn(async () => ['p8', 'p9']) }));
vi.mock('@/lib/ct/seller/assortment-write', () => ({ withdrawProducts: service.withdrawProducts }));
vi.mock('@/lib/ct/seller/assortment', () => ({ resolveFilterIds: service.resolveFilterIds }));

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/assortment/withdraw', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.withdrawProducts.mockClear();
  service.resolveFilterIds.mockClear();
});

describe('POST /api/seller/assortment/withdraw', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post({ storeKey: other, productIds: ['p1'], confirm: true, expectedCount: 1 }));
    expect(service.withdrawProducts).not.toHaveBeenCalled();
  });

  it('passes the confirmation through; a missing count can never match', async () => {
    await POST(post({ storeKey: 'store-a', productIds: ['p1'], confirm: true, expectedCount: 1 }));
    expect(service.withdrawProducts).toHaveBeenCalledWith('store-a', ['p1'], { confirm: true, expectedCount: 1 });
    await POST(post({ storeKey: 'store-a', productIds: ['p1'] }));
    expect(service.withdrawProducts).toHaveBeenLastCalledWith('store-a', ['p1'], { confirm: false, expectedCount: -1 });
  });

  it('"select all N matching the filter" is resolved by the server with the same confirmation', async () => {
    await POST(post({ storeKey: 'store-a', filter: { categoryId: 'cat-brakes', state: 'assigned' }, confirm: true, expectedCount: 2 }));
    expect(service.resolveFilterIds).toHaveBeenCalledWith('store-a', { categoryId: 'cat-brakes', state: 'assigned' }, 'withdraw');
    expect(service.withdrawProducts).toHaveBeenCalledWith('store-a', ['p8', 'p9'], { confirm: true, expectedCount: 2 });
  });

  it('409 CONFIRMATION_REQUIRED carries the impact', async () => {
    service.withdrawProducts.mockRejectedValueOnce(new CatalogError(409, 'CONFIRMATION_REQUIRED', 'Confirm', { count: 3, openCartCount: 2, branches: 1 }));
    const res = await POST(post({ storeKey: 'store-a', productIds: ['p1'] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'CONFIRMATION_REQUIRED', count: 3, openCartCount: 2, branches: 1 });
  });
});
