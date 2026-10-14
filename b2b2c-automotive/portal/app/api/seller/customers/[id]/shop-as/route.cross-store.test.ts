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
const service = vi.hoisted(() => ({ startShopAs: vi.fn(async () => ({ token: 'jwt', name: 'Anna Muster', jti: 'j1' })) }));
vi.mock('@/lib/ct/seller/impersonation', () => service);

import { POST } from './route';

const ctx = params({ id: 'c1' });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/customers/c1/shop-as', { method: 'POST', json });

beforeEach(() => {
  asUser('adminA');
  service.startShopAs.mockClear();
  vi.stubEnv('STOREFRONT_ORIGIN', 'https://shop.example.com/');
});

describe('POST /api/seller/customers/[id]/shop-as', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.startShopAs).not.toHaveBeenCalled();
  });
  it('hands the token over in the response body for a POST form, never in a URL, and sets the banner name', async () => {
    const response = await POST(post({ storeKey: 'store-a' }), ctx);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { action: string; token: string };
    expect(body).toEqual({ action: 'https://shop.example.com/api/impersonate', token: 'jwt' });
    expect(body.action).not.toContain('jwt');
    expect(service.startShopAs).toHaveBeenCalledWith('store-a', 'c1', 'cust-admin-a');
  });
  it('a customer of another store is 404 and a missing secret is reported, both without a token', async () => {
    service.startShopAs.mockRejectedValueOnce(new CatalogError(404, 'NOT_FOUND', 'Not found'));
    expect((await POST(post({ storeKey: 'store-a' }), params({ id: 'c-of-b' }))).status).toBe(404);
    service.startShopAs.mockRejectedValueOnce(new CatalogError(409, 'NOT_CONFIGURED', 'Shop as customer is not set up for this portal'));
    const response = await POST(post({ storeKey: 'store-a' }), ctx);
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain('jwt');
  });
});
