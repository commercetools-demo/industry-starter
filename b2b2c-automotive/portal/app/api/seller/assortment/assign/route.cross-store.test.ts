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
const service = vi.hoisted(() => ({ assignProducts: vi.fn(async () => ({ added: 1 })), resolveFilterIds: vi.fn(async () => ['p9']) }));
vi.mock('@/lib/ct/seller/assortment-write', () => ({ assignProducts: service.assignProducts }));
vi.mock('@/lib/ct/seller/assortment', () => ({ resolveFilterIds: service.resolveFilterIds }));

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/assortment/assign', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.assignProducts.mockClear();
  service.resolveFilterIds.mockClear();
});

describe('POST /api/seller/assortment/assign', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post({ storeKey: other, productIds: ['p1'] }));
    expect(service.assignProducts).not.toHaveBeenCalled();
    expect(service.resolveFilterIds).not.toHaveBeenCalled();
  });

  it('assigns ids, or resolves a filter on the server; sending both or neither is 400', async () => {
    expect((await POST(post({ storeKey: 'store-a', productIds: ['p1'] }))).status).toBe(200);
    expect(service.assignProducts).toHaveBeenCalledWith('store-a', ['p1']);
    expect((await POST(post({ storeKey: 'store-a', filter: { state: 'available' } }))).status).toBe(200);
    expect(service.resolveFilterIds).toHaveBeenCalledWith('store-a', { state: 'available' }, 'assign');
    expect(service.assignProducts).toHaveBeenLastCalledWith('store-a', ['p9']);
    expect((await POST(post({ storeKey: 'store-a' }))).status).toBe(400);
    expect((await POST(post({ storeKey: 'store-a', productIds: ['p1'], filter: {} }))).status).toBe(400);
  });

  it('a blocked upstream part is 409 BLOCKED_UPSTREAM with its code in the body', async () => {
    service.assignProducts.mockRejectedValueOnce(new CatalogError(409, 'BLOCKED_UPSTREAM', 'blocked', { productIds: ['p1'] }));
    const res = await POST(post({ storeKey: 'store-a', productIds: ['p1'] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'BLOCKED_UPSTREAM', productIds: ['p1'] });
  });
});
