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
const service = vi.hoisted(() => ({ listVehicleOptions: vi.fn(async () => []) }));
vi.mock('@/lib/ct/seller/local-products', () => service);

import { GET } from './route';

beforeEach(() => {
  asUser('adminA');
  service.listVehicleOptions.mockClear();
});

describe('GET /api/seller/local-products/vehicles', () => {
  it('cross-store and Buyer are refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => GET(req), (other) => makeRequest(`/api/seller/local-products/vehicles?storeKey=${other}`));
    asUser('buyerA');
    expect((await GET(makeRequest('/api/seller/local-products/vehicles?storeKey=store-a'))).status).toBe(403);
    expect(service.listVehicleOptions).not.toHaveBeenCalled();
  });
  it('Admin reads the vehicle table', async () => {
    expect((await GET(makeRequest('/api/seller/local-products/vehicles?storeKey=store-a'))).status).toBe(200);
  });
});
