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
const service = vi.hoisted(() => ({ listTailoring: vi.fn(async () => ({ rows: [], total: 0 })) }));
vi.mock('@/lib/ct/seller/tailoring', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listTailoring.mockClear();
});

describe('GET /api/seller/tailoring', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden(
      (req) => GET(req),
      (other) => makeRequest(`/api/seller/tailoring?storeKey=${other}`),
    );
    expect(service.listTailoring).not.toHaveBeenCalled();
  });

  it('the own store lists with paging; a Buyer may read', async () => {
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/tailoring?storeKey=store-a&offset=5&limit=10&text=pad'))).status).toBe(200);
    expect(service.listTailoring).toHaveBeenCalledWith('store-a', { text: 'pad', offset: 5, limit: 10 });
  });
});
