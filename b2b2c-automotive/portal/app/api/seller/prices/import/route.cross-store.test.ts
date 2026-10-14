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
const service = vi.hoisted(() => ({
  previewChanges: vi.fn(async () => ({ rows: [], invalidCount: 0, currency: 'EUR' })),
  publishPrices: vi.fn(async () => ({ written: 2, deleted: 0 })),
}));
vi.mock('@/lib/ct/seller/prices', () => service);

import { POST } from './route';

const post = (json: Record<string, unknown>) => makeRequest('/api/seller/prices/import', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', csv: 'sku;price\nMLV-BP-41001;90,00\nMLV-OF-44001;12.90', dryRun: true, ...extra });

beforeEach(() => {
  asUser('adminA');
  service.previewChanges.mockClear();
  service.publishPrices.mockClear();
});

describe('POST /api/seller/prices/import', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(body({ storeKey: other })));
    expect(service.previewChanges).not.toHaveBeenCalled();
    expect(service.publishPrices).not.toHaveBeenCalled();
  });

  it('previews the parsed rows, then publishes them through publishPrices with the count', async () => {
    await POST(post(body()));
    expect(service.previewChanges).toHaveBeenCalledWith('store-a', { currency: undefined, changes: [{ sku: 'MLV-BP-41001', centAmount: 9000 }, { sku: 'MLV-OF-44001', centAmount: 1290 }] });
    await POST(post(body({ dryRun: false, confirm: true, expectedCount: 2 })));
    expect(service.publishPrices).toHaveBeenCalledWith('store-a', expect.objectContaining({ confirm: true, expectedCount: 2 }));
  });

  it('a bad CSV is 400 CSV_INVALID with the problem lines and nothing is written', async () => {
    const res = await POST(post(body({ csv: 'MLV-BP-41001;abc', dryRun: false, confirm: true, expectedCount: 1 })));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'CSV_INVALID', problems: [{ line: 1 }] });
    expect(service.publishPrices).not.toHaveBeenCalled();
    expect((await POST(post(body({ csv: '' })))).status).toBe(400);
  });
});
