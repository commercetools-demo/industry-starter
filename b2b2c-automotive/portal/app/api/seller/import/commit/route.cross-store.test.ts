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
const service = vi.hoisted(() => ({ commitImport: vi.fn(async () => ({ imported: 1, failed: [], skipped: 0, containers: [] })) }));
vi.mock('@/lib/ct/seller/product-import', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/import/commit', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', csv: 'sku,price\nTST-W-1,1.00', ...extra });

beforeEach(() => {
  asUser('adminA');
  service.commitImport.mockClear();
});

describe('POST /api/seller/import/commit', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(body({ storeKey: other })));
    asUser('buyerA');
    expect((await POST(post(body()))).status).toBe(403);
    expect(service.commitImport).not.toHaveBeenCalled();
  });
  it('imports the file for the session store; the client cannot send validated rows, keys or prices', async () => {
    expect((await POST(post(body()))).status).toBe(200);
    expect(service.commitImport).toHaveBeenCalledWith('store-a', 'sku,price\nTST-W-1,1.00', { overrides: undefined });
    for (const extra of [{ rows: [{ sku: 'X', priceCents: 1 }] }, { items: [] }, { dryRun: false }]) expect((await POST(post(body(extra)))).status).toBe(400);
    expect(service.commitImport).toHaveBeenCalledTimes(1);
  });
});
