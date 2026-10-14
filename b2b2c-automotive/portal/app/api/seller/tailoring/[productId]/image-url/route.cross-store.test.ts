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
const service = vi.hoisted(() => ({ checkImageUrl: vi.fn(async (url: string) => ({ ok: true, width: 900, height: 700, mime: 'image/png', url })) }));
vi.mock('@/lib/ct/seller/tailoring', () => service);

import { POST } from './route';

const ctx = params({ productId: 'p1' });
const post = (storeKey: string, url: string) => makeRequest('/api/seller/tailoring/p1/image-url', { method: 'POST', json: { storeKey, url } });

beforeEach(() => {
  asUser('adminA');
  service.checkImageUrl.mockClear();
});

describe('POST /api/seller/tailoring/[productId]/image-url', () => {
  it('cross-store: another store is refused and nothing is fetched', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post(other, 'https://cdn.example/a.png'));
    expect(service.checkImageUrl).not.toHaveBeenCalled();
  });

  it('a valid https address is validated and returned with its size; it saves nothing', async () => {
    const res = await POST(post('store-a', 'https://cdn.example/a.png'), ctx);
    expect(await res.json()).toEqual({ url: 'https://cdn.example/a.png', width: 900, height: 700 });
  });

  it('http, a private address in the guard and a query string are refused', async () => {
    for (const url of ['http://cdn.example/a.png', 'https://cdn.example/a.png?w=1', 'https://u:p@cdn.example/a.png']) {
      const res = await POST(post('store-a', url), ctx);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'IMAGE_URL_REFUSED' });
    }
    expect(service.checkImageUrl).not.toHaveBeenCalled();
    service.checkImageUrl.mockRejectedValueOnce(new CatalogError(400, 'IMAGE_URL_REFUSED', 'refused'));
    expect((await POST(post('store-a', 'https://internal.example/a.png'), ctx)).status).toBe(400);
  });

  it('a Buyer is refused', async () => {
    asUser('buyerA');
    expect((await POST(post('store-a', 'https://cdn.example/a.png'), ctx)).status).toBe(403);
  });
});
