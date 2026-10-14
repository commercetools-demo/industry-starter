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
const service = vi.hoisted(() => ({ createCoopDiscount: vi.fn(async () => ({ id: 'd1', key: 'coop-x-store-a', code: 'X-STORE-A', isActive: false })) }));
vi.mock('@/lib/ct/seller/campaigns', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/campaigns/brake/discount', { method: 'POST', json });
const ctx = params({ key: 'brake' });

beforeEach(() => {
  asUser('adminA');
  service.createCoopDiscount.mockClear();
});

describe('POST /api/seller/campaigns/[key]/discount', () => {
  it('cross-store: the forged store key is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post({ storeKey: other }));
    expect(service.createCoopDiscount).not.toHaveBeenCalled();
  });
  it('Buyer gets 403; Admin creates it for the session store only', async () => {
    asUser('buyerA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(403);
    expect(service.createCoopDiscount).not.toHaveBeenCalled();
    asUser('adminA');
    expect((await POST(post({ storeKey: 'store-a' }), ctx)).status).toBe(201);
    expect(service.createCoopDiscount).toHaveBeenCalledWith('store-a', 'brake');
  });
  it('the body is strict: a value, code or sortOrder from the client is 400 and never reaches the service', async () => {
    for (const extra of [{ permyriad: 9999 }, { code: 'FREE' }, { sortOrder: '0.99' }, { isActive: true }]) {
      expect((await POST(post({ storeKey: 'store-a', ...extra }), ctx)).status).toBe(400);
    }
    expect(service.createCoopDiscount).not.toHaveBeenCalled();
  });
  it('an ended campaign and an existing discount are 409 with their codes; a strange key is 404', async () => {
    service.createCoopDiscount.mockRejectedValueOnce(new CatalogError(409, 'CAMPAIGN_ENDED', 'This campaign has ended'));
    const res = await POST(post({ storeKey: 'store-a' }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'CAMPAIGN_ENDED' });
    expect((await POST(post({ storeKey: 'store-a' }), params({ key: '../x' }))).status).toBe(404);
  });
});
